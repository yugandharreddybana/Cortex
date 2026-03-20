package com.cortex.api;

import com.cortex.api.entity.BatchedEmailEvent;
import com.cortex.api.entity.Notification;
import com.cortex.api.entity.User;
import com.cortex.api.repository.BatchedEmailEventRepository;
import com.cortex.api.repository.NotificationRepository;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.service.EmailBatchProcessor;
import com.cortex.api.service.EmailService;
import com.cortex.api.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;


import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Phase 3 — Notification Engine integration tests.
 *
 * Covers:
 *  1. 60-minute aggregation window: 10 rapid actions produce exactly 1 BatchedEmailEvent
 *     with action_count = 10.
 *  2. Critical-path email: triggerFolderAccessGrantedEmail() calls EmailService immediately,
 *     bypassing the batch queue (no BatchedEmailEvent row created).
 *  3. Failure isolation: EmailService.sendActivityDigestEmail() throwing during cron sweep
 *     does NOT prevent the BatchedEmailEvent from being marked processed = true.
 */
@DataJpaTest
public class NotificationEngineIntegrationTest {

    @Autowired private BatchedEmailEventRepository batchRepo;
    @Autowired private NotificationRepository notifRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private NotificationService notificationService;
    @Autowired private EmailBatchProcessor emailBatchProcessor;
    @MockBean EmailService emailService;
    @MockBean SimpMessagingTemplate messagingTemplate;

    private User owner;
    private User editor;

    @BeforeEach
    void setUp() {
        owner  = saveUser("owner@engine.test");
        editor = saveUser("editor@engine.test");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. 60-minute aggregation window
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("10 rapid actions for the same (owner, editor, folder) triple produce exactly 1 batch row with action_count = 10")
    void test_60minWindow_aggregatesRapidActions() {
        Long   folderId   = 1001L;
        String folderName = "Project Alpha";

        for (int i = 0; i < 10; i++) {
            notificationService.logBatchedAction(owner, editor, folderId, folderName);
        }

        List<BatchedEmailEvent> rows = batchRepo.findAll();
        assertEquals(1, rows.size(),
                "Expected exactly 1 batch window for rapid actions within 60 minutes");

        BatchedEmailEvent event = rows.get(0);
        assertEquals(10, event.getActionCount(),
                "action_count must equal the number of logBatchedAction() calls");
        assertFalse(event.isProcessed(), "Row must remain unprocessed until cron fires");
        assertEquals(owner.getId(),  event.getOwner().getId());
        assertEquals(editor.getId(), event.getEditor().getId());
        assertEquals(folderId,       event.getFolderId());
        assertEquals(folderName,     event.getFolderName());
    }

    @Test
    @DisplayName("Actions from two different editors on the same folder create two separate batch rows")
    void test_60minWindow_separateRowsPerEditor() {
        User editor2  = saveUser("editor2@engine.test");
        Long folderId = 2001L;

        notificationService.logBatchedAction(owner, editor,  folderId, "Shared Folder");
        notificationService.logBatchedAction(owner, editor2, folderId, "Shared Folder");

        List<BatchedEmailEvent> rows = batchRepo.findAll();
        assertEquals(2, rows.size(),
                "Each (owner, editor, folder) triple must have its own batch row");
    }

    @Test
    @DisplayName("A new batch window is created when the previous 60-minute window has expired")
    void test_60minWindow_expiredWindowOpensNewRow() {
        Long folderId = 3001L;

        // Simulate a batch row that was created 90 minutes ago (outside the 60-min upsert window)
        BatchedEmailEvent staleRow = new BatchedEmailEvent();
        Instant ninetyMinsAgo = Instant.now().minus(90, ChronoUnit.MINUTES);
        staleRow.setOwner(owner);
        staleRow.setEditor(editor);
        staleRow.setFolderId(folderId);
        staleRow.setFolderName("Stale Folder");
        staleRow.setActionCount(5);
        staleRow.setFirstActionAt(ninetyMinsAgo);
        staleRow.setLastActionAt(ninetyMinsAgo.plus(10, ChronoUnit.MINUTES));
        staleRow.setProcessed(false);
        batchRepo.save(staleRow);

        // New action — should open a fresh window, not increment the stale row
        notificationService.logBatchedAction(owner, editor, folderId, "Stale Folder");

        List<BatchedEmailEvent> rows = batchRepo.findAll();
        assertEquals(2, rows.size(),
                "Expired window must not be reused; a new row must be created");

        BatchedEmailEvent freshRow = rows.stream()
                .filter(r -> r.getActionCount() == 1).findFirst().orElseThrow();
        assertEquals(1, freshRow.getActionCount());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Critical-path email bypasses batch queue
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("triggerFolderAccessGrantedEmail() calls EmailService immediately and creates no BatchedEmailEvent")
    void test_shareGrant_triggersImmediateEmail_noBatchRow() {
        Long   folderId   = 4001L;
        String folderName = "Critical Folder";

        notificationService.triggerFolderAccessGrantedEmail(editor, owner, folderName, folderId);

        // EmailService.sendFolderAccessGrantedEmail() must have been called once
        verify(emailService, times(1))
                .sendFolderAccessGrantedEmail(
                        eq(editor.getEmail()),
                        any(),
                        eq(folderName),
                        eq(String.valueOf(folderId))
                );

        // No BatchedEmailEvent should have been created (this is NOT a batched action)
        assertEquals(0, batchRepo.count(),
                "Critical-path email must NOT create a BatchedEmailEvent row");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Failure isolation — SMTP down must not prevent marking processed = true
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("EmailService.sendActivityDigestEmail() throwing does not prevent batch row being marked processed")
    void test_emailFailure_batchStillMarkedProcessed() {
        Long folderId = 5001L;

        // Create a batch row older than 60 minutes so it's eligible for cron processing
        BatchedEmailEvent event = new BatchedEmailEvent();
        Instant ninetyMinsAgo = Instant.now().minus(90, ChronoUnit.MINUTES);
        event.setOwner(owner);
        event.setEditor(editor);
        event.setFolderId(folderId);
        event.setFolderName("Crash Folder");
        event.setActionCount(3);
        event.setFirstActionAt(ninetyMinsAgo);
        event.setLastActionAt(ninetyMinsAgo.plus(15, ChronoUnit.MINUTES));
        event.setProcessed(false);
        batchRepo.save(event);

        // Arrange: EmailService throws on dispatch
        doThrow(new RuntimeException("SMTP connection refused"))
                .when(emailService)
                .sendActivityDigestEmail(anyString(), anyString(), anyString(),
                        anyString(), anyInt(), any(Instant.class), any(Instant.class));

        // Act: run the cron
        emailBatchProcessor.processBatchedEmails();

        // Assert: despite the SMTP failure, the row must be marked processed = true
        batchRepo.findAll().forEach(r -> {
            if (r.getFolderId().equals(folderId)) {
                assertTrue(r.isProcessed(),
                        "Row must be marked processed=true even when EmailService throws");
                assertNotNull(r.getProcessedAt(),
                        "processedAt must be set when the row is marked processed");
            }
        });
    }

    @Test
    @DisplayName("createInstantNotification() persists a Notification with correct actionType and actorId")
    void test_createInstantNotification_persistsCorrectly() {
        Long folderId = 6001L;

        Notification saved = notificationService.createInstantNotification(
                owner, editor, "DELETED", folderId,
                "editor@engine.test deleted your shared folder \"My Folder\"",
                "/dashboard"
        );

        assertNotNull(saved.getId());
        assertEquals("DELETED",           saved.getActionType());
        assertEquals(folderId,             saved.getTargetEntityId());
        assertEquals(editor.getId(),       saved.getActorId());
        assertEquals("FOLDER_ACTIVITY",   saved.getType());
        assertFalse(saved.isRead());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private User saveUser(String email) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash("hashed-password");
        u.setEmailHash(email.hashCode() + "");
        u.setEncryptedEmail(email);
        return userRepo.save(u);
    }

    // ── Test wiring ──────────────────────────────────────────────────────────

    @TestConfiguration
    static class TestConfig {

        @Bean
        EmailService emailService() {
            return mock(EmailService.class);
        }

        @Bean
        NotificationService notificationService(
                NotificationRepository notifRepo,
                BatchedEmailEventRepository batchRepo,
                SimpMessagingTemplate messaging,
                EmailService emailService
        ) {
            return new NotificationService(notifRepo, batchRepo, messaging, emailService);
        }

        @Bean
        EmailBatchProcessor emailBatchProcessor(
                BatchedEmailEventRepository batchRepo,
                EmailService emailService
        ) {
            return new EmailBatchProcessor(batchRepo, emailService);
        }
    }
}
