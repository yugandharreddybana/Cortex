package com.cortex.api.controller;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Request body for {@code POST /api/bookmarks}.
 *
 * <p>Required fields: {@code highlightId} and {@code selectedText}.
 * All other fields are optional metadata the client may supply.
 */
public class CreateBookmarkRequest {

    /** PK of the AI {@code Highlight} (conversation) being bookmarked. */
    @NotNull(message = "highlightId is required")
    private Long highlightId;

    /**
     * Client-side message/turn ID (e.g. DOM {@code data-message-id} attribute).
     * Optional — used to jump to the exact conversation bubble.
     */
    private String messageId;

    /** The full text the user selected. */
    @NotBlank(message = "selectedText must not be blank")
    private String selectedText;

    /** Start character offset of the selection within the message node (0-based). */
    private Integer startOffset;

    /** End character offset (exclusive) of the selection. */
    private Integer endOffset;

    /**
     * Short surrounding context snippet (≤ 200 chars) for fuzzy re-anchoring.
     * If omitted, the service auto-derives it from {@code selectedText}.
     */
    private String quoteSnippet;

    /** Human-readable label shown in the bookmark panel. */
    private String label;

    /** Hex highlight color (e.g. {@code #FFD700}). Defaults to yellow if omitted. */
    private String color;

    /** Free-form user note. */
    private String note;

    // ── Getters & Setters ────────────────────────────────────────────────────

    public Long getHighlightId() { return highlightId; }
    public void setHighlightId(Long highlightId) { this.highlightId = highlightId; }

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
}
