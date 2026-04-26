package com.cortex.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Represents a user-created bookmark anchored to a specific text selection
 * within an AI conversation (i.e. within a {@link Highlight} that has
 * {@code isAI = true} and a non-null {@code chatUrl}).
 *
 * <p>A bookmark stores:
 * <ul>
 *   <li>A reference to the parent {@link Highlight} (the AI conversation card).</li>
 *   <li>An optional logical {@code messageId} so the client can identify the
 *       specific bubble/turn inside that conversation.</li>
 *   <li>The raw {@code selectedText} plus character {@code startOffset} /
 *       {@code endOffset} so the client can reconstruct the exact DOM range.</li>
 *   <li>A short {@code quoteSnippet} (≤ 200 chars) used as a fuzzy fallback when
 *       the text has changed slightly since the bookmark was created.</li>
 *   <li>Optional {@code label}, {@code color}, and {@code note} fields for
 *       user-facing organisation.</li>
 * </ul>
 *
 * <p>Bookmarks are soft-deleted: setting {@code isDeleted = true} hides the
 * record from all API queries without removing it from the database, matching
 * the pattern used by {@link Highlight}.
 */
@Entity
@Table(name = "conversation_bookmarks")
public class ConversationBookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Owner ──────────────────────────────────────────────────────────────

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // ── Anchor ─────────────────────────────────────────────────────────────

    /**
     * The AI highlight (conversation) this bookmark belongs to.
     * Must have {@code isAI = true}.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "highlight_id", nullable = false)
    private Highlight highlight;

    /**
     * Client-side logical message/turn identifier within the conversation
     * (e.g. the DOM {@code data-message-id} attribute value).
     * Optional — the client falls back to offset-only matching when null.
     */
    @Column(name = "message_id", length = 255)
    private String messageId;

    // ── Text range ─────────────────────────────────────────────────────────

    /** The full text the user highlighted at save time. */
    @Column(name = "selected_text", nullable = false, columnDefinition = "TEXT")
    private String selectedText;

    /**
     * Character offset of the start of the selection inside the message node
     * (0-based, relative to the raw {@code textContent} of the message element).
     */
    @Column(name = "start_offset")
    private Integer startOffset;

    /**
     * Character offset of the end of the selection (exclusive), matching the
     * semantics of {@code Range.endOffset} in the browser.
     */
    @Column(name = "end_offset")
    private Integer endOffset;

    /**
     * Short excerpt (≤ 200 chars) extracted from the surrounding sentence.
     * Used for fuzzy text re-anchoring if the message content is regenerated.
     */
    @Column(name = "quote_snippet", length = 200)
    private String quoteSnippet;

    // ── User-facing metadata ───────────────────────────────────────────────

    /** Human-readable label shown in the bookmark panel (max 120 chars). */
    @Column(name = "label", length = 120)
    private String label;

    /**
     * Hex color string (e.g. {@code #FFD700}) used to render the highlight
     * marker in the conversation view.  Defaults to yellow.
     */
    @Column(name = "color", length = 20)
    private String color = "#FFD700";

    /** Free-form user note attached to this bookmark. */
    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    // ── Auditing ────────────────────────────────────────────────────────────

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // ── Soft delete ─────────────────────────────────────────────────────────

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    // ── Getters & Setters ────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Highlight getHighlight() { return highlight; }
    public void setHighlight(Highlight highlight) { this.highlight = highlight; }

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public String getSelectedText() { return selectedText; }
    public void setSelectedText(String selectedText) { this.selectedText = selectedText; }

    public Integer getStartOffset() { return startOffset; }
    public void setStartOffset(Integer startOffset) { this.startOffset = startOffset; }

    public Integer getEndOffset() { return endOffset; }
    public void setEndOffset(Integer endOffset) { this.endOffset = endOffset; }

    public String getQuoteSnippet() { return quoteSnippet; }
    public void setQuoteSnippet(String quoteSnippet) { this.quoteSnippet = quoteSnippet; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
