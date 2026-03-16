package com.cortex.api.service;

import com.cortex.api.entity.BatchedEmailEvent;
import com.cortex.api.entity.User;
import com.cortex.api.repository.BatchedEmailEventRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Background cron that dispatches the 60-minute collaboration digest email.
 *
 * <h3>Window lifecycle</h3>
 * <ol>
 *   <li>Editor performs action → {@link NotificationService#logBatchedAction} creates /
 *       increments a {@link BatchedEmailEvent} row.</li>
 *   <li>60 minutes after {@code first_action_at} the row becomes eligible.</li>
 *   <li>This cron fires every 5 minutes, picks up eligible rows, marks them
 *       {@code processed = true}, and dispatches a summary email to the folder owner.</li>
 * </ol>
 *
 * <h3>Failure isolation</h3>
 * <p>Every event is processed inside its own {@code try/catch}. An SMTP timeout or
 * provider outage logs an error but does NOT stop the remaining events from being
 * processed. The {@code processed = true} flag is written to the database
 * <em>before</em> the email is dispatched ("at-most-once" delivery semantics).
 *
 * <h3>Horizontal-scaling caution (Step 7)</h3>
 * <p>If multiple instances of this service run simultaneously each instance will
 * independently pick up the same rows from the database and may issue duplicate
 * emails. Mitigation: introduce a distributed lock (ShedLock with the
 * {@code shedlock_default} PostgreSQL table, or a Redis {@code SET NX EX} lock)
 * around {@link #processBatchedEmails}. See Limitations for details.
 */
@Service
public class EmailBatchProcessor {

    private static final Logger log = LoggerFactory.getLogger(EmailBatchProcessor.class);

    private static final DateTimeFormatter HUMAN_FORMAT =
            DateTimeFormatter.ofPattern("MMM d, yyyy 'at' HH:mm z").withZone(ZoneOffset.UTC);

    /**
     * Batch window length in minutes.
     * Must match {@link NotificationService#BATCH_WINDOW_MINUTES}.
     */
    static final int WINDOW_MINUTES = 60;

    private final BatchedEmailEventRepository batchRepo;
    private final EmailService emailService;

    public EmailBatchProcessor(BatchedEmailEventRepository batchRepo,
                                EmailService emailService) {
        this.batchRepo    = batchRepo;
        this.emailService = emailService;
    }

    /**
     * Sweep the database every 5 minutes for digest events whose 60-minute window
     * has expired, dispatch a summary email for each, and mark them processed.
     *
     * <p>The method is {@code @Transactional} so the {@code processed = true} save
     * and the async email dispatch happen atomically from the database's perspective:
     * the row is committed as processed before the email is handed off to the async
     * executor thread, preventing double-send on the next cron tick.
     */
    @Scheduled(cron = "0 0/5 * * * ?")
    @Transactional
    public void processBatchedEmails() {
        Instant cutoff = Instant.now().minus(WINDOW_MINUTES, ChronoUnit.MINUTES);
        List<BatchedEmailEvent> readyBatches = batchRepo.findReadyToProcess(cutoff);

        if (readyBatches.isEmpty()) {
            log.debug("[Email Cron] No digest events ready (cutoff={})", cutoff);
            return;
        }

        log.info("[Email Cron] {} digest event(s) ready for dispatch (cutoff={})",
                readyBatches.size(), cutoff);

        int dispatched = 0;
        int failed     = 0;

        for (BatchedEmailEvent batch : readyBatches) {
            try {
                String ownerEmail  = batch.getOwner().getEmail();
                String editorName  = resolveDisplayName(batch.getEditor());

                // ── Mark processed BEFORE dispatch ─────────────────────────────────────
                // Writing the flag first prevents a second cron tick (or a concurrent
                // instance) from re-sending the same digest if email dispatch is slow.
                batch.setProcessed(true);
                batch.setProcessedAt(Instant.now());
                batchRepo.save(batch);

                // ── Dispatch the digest (EmailService is @Async → separate thread) ─────
                emailService.sendActivityDigestEmail(
                        ownerEmail,
                        editorName,
                        batch.getFolderName(),
                        String.valueOf(batch.getFolderId()),
                        batch.getActionCount(),
                        batch.getFirstActionAt(),
                        batch.getLastActionAt()
                );

                log.info("[Email Cron] Digest dispatched — batch={} owner={} editor='{}' actions={}",
                        batch.getId(), obfuscate(ownerEmail), editorName, batch.getActionCount());
                dispatched++;

            } catch (Exception e) {
                // ── Swallow: email failure MUST NOT crash the cron or degrade UX ───────
                // The 'processed = true' flag is already saved, so this batch won't be
                // retried. For production, implement a dead-letter queue / retry counter.
                log.error("[Email Cron] ⚠ SMTP failure for batch={} — {} (NOT retried; check SMTP config)",
                        batch.getId(), e.getMessage(), e);
                failed++;
            }
        }

        log.info("[Email Cron] Sweep complete — dispatched={} failed={}", dispatched, failed);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static String resolveDisplayName(User user) {
        if (user.getFullName() != null && !user.getFullName().isBlank()) return user.getFullName();
        return user.getEmail();
    }

    /** Replace most of the email with asterisks for GDPR-safe logging. */
    static String obfuscate(String email) {
        if (email == null || !email.contains("@")) return "***";
        int at = email.indexOf('@');
        if (at <= 1) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }
}
