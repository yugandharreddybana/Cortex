package com.cortex.api.controller;

/**
 * Payload returned by {@code GET /api/bookmarks/{id}/navigate}.
 *
 * <p>Contains everything the frontend needs to:
 * <ol>
 *   <li>Open the correct conversation ({@code chatUrl} / {@code chatName}).</li>
 *   <li>Scroll to the right message bubble ({@code messageId}).</li>
 *   <li>Re-apply the text highlight range ({@code selectedText}, {@code startOffset},
 *       {@code endOffset}, {@code quoteSnippet}).</li>
 * </ol>
 */
public class BookmarkNavigateResponse {

    private final Long bookmarkId;
    private final Long highlightId;
    private final String chatUrl;
    private final String chatName;
    private final String messageId;
    private final String selectedText;
    private final Integer startOffset;
    private final Integer endOffset;
    private final String quoteSnippet;
    private final String label;
    private final String color;

    public BookmarkNavigateResponse(
            Long bookmarkId,
            Long highlightId,
            String chatUrl,
            String chatName,
            String messageId,
            String selectedText,
            Integer startOffset,
            Integer endOffset,
            String quoteSnippet,
            String label,
            String color) {
        this.bookmarkId   = bookmarkId;
        this.highlightId  = highlightId;
        this.chatUrl      = chatUrl;
        this.chatName     = chatName;
        this.messageId    = messageId;
        this.selectedText = selectedText;
        this.startOffset  = startOffset;
        this.endOffset    = endOffset;
        this.quoteSnippet = quoteSnippet;
        this.label        = label;
        this.color        = color;
    }

    public Long getBookmarkId()   { return bookmarkId; }
    public Long getHighlightId()  { return highlightId; }
    public String getChatUrl()    { return chatUrl; }
    public String getChatName()   { return chatName; }
    public String getMessageId()  { return messageId; }
    public String getSelectedText() { return selectedText; }
    public Integer getStartOffset() { return startOffset; }
    public Integer getEndOffset()   { return endOffset; }
    public String getQuoteSnippet() { return quoteSnippet; }
    public String getLabel()        { return label; }
    public String getColor()        { return color; }
}
