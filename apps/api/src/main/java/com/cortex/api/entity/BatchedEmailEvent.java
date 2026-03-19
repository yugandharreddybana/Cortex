package com.cortex.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Deferred e-mail event for the 60-minute collaboration digest window.
 *
 * <p>When an editor performs high-volume actions (creates highlights, renames
 * subfolders, deletes items) inside a shared folder we do <strong>not</strong>
 * send one email per action; instead we accumulate a single
 * {@code BatchedEmailEvent} row for the {@code (owner, editor, folder)} triple.
 *
 * <p>A {@link com.cortex.api.service.EmailBatchProcessor} cron fires every 5
 * minutes and dispatches a summary email for every row whose
 * {@code first_action_at} is strictly older than 60 minutes.
 *
 * <p>After dispatch the row is marked {@code processed = true} (never hard-deleted;
 * kept for audit trail).
 *
 * <p>Multiple rows for the same triple are intentional: if an editor is active,
 * pauses for more than 60 minutes, then becomes active again, a second window
 * row is created so the owner receives a correctly scoped digest for each period.
 *
 * <h3>Index strategy</h3>
 * <ul>
 *   <li>{@code idx_bee_unprocessed_first_action} — covering index for the cron
 *       sweep ({@code WHERE processed = false AND first_action_at < ?}).</li>
 *   <li>{@code idx_bee_owner_editor_folder} — covering index for the upsert
 *       lookup in {@link com.cortex.api.service.NotificationService#logBatchedAction}.</li>
 * </ul>
 */
@Entity
@Table(
    name = "batched_email_events",
    indexes = {
        @Index(name = "idx_bee_unprocessed_first_action", columnList = "processed, first_action_at"),
        @Index(name = "idx_bee_owner_editor_folder",      columnList = "owner_user_id, editor_user_id, folder_id")
    }
)
public class BatchedEmailEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Folder owner who will receive the summary email. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    /** Collaborator whose actions are being aggregated. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "editor_user_id", nullable = false)
    private User editor;

    /**
     * Stored as a plain string (not a foreign key) so rows survive folder
     * deletion and remain useful for the email deep-link.
     */
    @Column(name = "folder_id", nullable = false)
    private Long folderId;

    /**
     * Folder name captured at the time of the first action in this window.
     * Denormalised so the cron doesn't need a JOIN at send-time, and the
     * name is preserved even if the folder is later renamed or deleted.
     */
    @Column(name = "folder_name", nullable = false)
    private String folderName;

    /** Running total of collaboration actions accumulated in this 60-minute window. */
    @Column(name = "action_count", nullable = false)
    private int actionCount = 1;

    /** Timestamp of the first action that opened this window; used as the cron cutoff. */
    @Column(name = "first_action_at", nullable = false)
    private Instant firstActionAt;

    /** Updated on every increment; shown in the digest email as "last active at …". */
    @Column(name = "last_action_at", nullable = false)
    private Instant lastActionAt;

    /** {@code true} once the cron has successfully dispatched the summary email. */
    @Column(name = "processed", nullable = false)
    private boolean processed = false;

    /** Populated by the cron when this record is processed; {@code null} until then. */
    @Column(name = "processed_at")
    private Instant processedAt;

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public Long getId() { return id; }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }

    public User getEditor() { return editor; }
    public void setEditor(User editor) { this.editor = editor; }

    public Long getFolderId() { return folderId; }
    public void setFolderId(Long folderId) { this.folderId = folderId; }

    public String getFolderName() { return folderName; }
    public void setFolderName(String folderName) { this.folderName = folderName; }

    public int getActionCount() { return actionCount; }
    public void setActionCount(int actionCount) { this.actionCount = actionCount; }

    public Instant getFirstActionAt() { return firstActionAt; }
    public void setFirstActionAt(Instant firstActionAt) { this.firstActionAt = firstActionAt; }

    public Instant getLastActionAt() { return lastActionAt; }
    public void setLastActionAt(Instant lastActionAt) { this.lastActionAt = lastActionAt; }

    public boolean isProcessed() { return processed; }
    public void setProcessed(boolean processed) { this.processed = processed; }

    public Instant getProcessedAt() { return processedAt; }
    public void setProcessedAt(Instant processedAt) { this.processedAt = processedAt; }
}
