package com.cortex.api.service;

import com.cortex.api.controller.CreateBookmarkRequest;
import com.cortex.api.controller.BookmarkNavigateResponse;
import com.cortex.api.entity.ConversationBookmark;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.User;
import com.cortex.api.repository.ConversationBookmarkRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/**
 * Business logic for the Conversation Bookmark plugin.
 *
 * <p>Design decisions:
 * <ul>
 *   <li>A bookmark can only be created on a {@link Highlight} that belongs to the
 *       requesting user ({@code highlight.user.id == callerId}).  Shared highlights
 *       are out of scope for V1.</li>
 *   <li>Soft-deletion is used so that the record stays in the database for
 *       potential restore / audit purposes, matching the Highlight pattern.</li>
 *   <li>The {@code navigate} method returns all data the client needs to:
 *       (a) open the correct conversation, (b) scroll to the right message,
 *       and (c) re-apply the highlight range — without an extra round-trip.</li>
 * </ul>
 */
@Service
public class ConversationBookmarkService {

    private static final Logger log = LoggerFactory.getLogger(ConversationBookmarkService.class);

    private final ConversationBookmarkRepository bookmarkRepository;
    private final HighlightRepository highlightRepository;
    private final UserRepository userRepository;

    @Autowired
    public ConversationBookmarkService(
            ConversationBookmarkRepository bookmarkRepository,
            HighlightRepository highlightRepository,
            UserRepository userRepository) {
        this.bookmarkRepository = bookmarkRepository;
        this.highlightRepository = highlightRepository;
        this.userRepository = userRepository;
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    /**
     * List all non-deleted bookmarks owned by the caller, newest first.
     */
    public List<ConversationBookmark> listByUser(Long callerId) {
        return bookmarkRepository.findAllByUserId(callerId);
    }

    /**
     * List all non-deleted bookmarks for a specific AI highlight owned by the caller.
     */
    public List<ConversationBookmark> listByHighlight(Long callerId, Long highlightId) {
        // Validate the highlight belongs to the caller
        resolveOwnedHighlight(callerId, highlightId);
        return bookmarkRepository.findByUserIdAndHighlightId(callerId, highlightId);
    }

    /**
     * Return the navigation payload for a single bookmark.
     * The client uses this to scroll to the saved text selection and re-highlight it.
     *
     * @param callerId   ID of the requesting user
     * @param bookmarkId PK of the bookmark
     * @return a {@link BookmarkNavigateResponse} with all anchor data
     */
    public BookmarkNavigateResponse navigate(Long callerId, Long bookmarkId) {
        ConversationBookmark bm = resolveOwnedBookmark(callerId, bookmarkId);
        Highlight h = bm.getHighlight();

        return new BookmarkNavigateResponse(
                bm.getId(),
                h.getId(),
                h.getChatUrl(),
                h.getChatName(),
                bm.getMessageId(),
                bm.getSelectedText(),
                bm.getStartOffset(),
                bm.getEndOffset(),
                bm.getQuoteSnippet(),
                bm.getLabel(),
                bm.getColor()
        );
    }

    // ── Write ────────────────────────────────────────────────────────────────

    /**
     * Create a new bookmark from a user text selection.
     *
     * @param callerId ID of the requesting user
     * @param req      validated request body
     * @return the persisted {@link ConversationBookmark}
     */
    @Transactional
    public ConversationBookmark create(Long callerId, CreateBookmarkRequest req) {
        User caller = resolveUser(callerId);
        Highlight highlight = resolveOwnedHighlight(callerId, req.getHighlightId());

        if (!highlight.isAI()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bookmarks can only be placed on AI conversation highlights"
            );
        }

        ConversationBookmark bm = new ConversationBookmark();
        bm.setUser(caller);
        bm.setHighlight(highlight);
        bm.setMessageId(req.getMessageId());
        bm.setSelectedText(req.getSelectedText());
        bm.setStartOffset(req.getStartOffset());
        bm.setEndOffset(req.getEndOffset());

        // Auto-derive quoteSnippet if the caller did not supply one
        if (req.getQuoteSnippet() != null && !req.getQuoteSnippet().isBlank()) {
            bm.setQuoteSnippet(truncate(req.getQuoteSnippet(), 200));
        } else {
            bm.setQuoteSnippet(truncate(req.getSelectedText(), 200));
        }

        bm.setLabel(req.getLabel());
        bm.setColor(req.getColor() != null ? req.getColor() : "#FFD700");
        bm.setNote(req.getNote());

        ConversationBookmark saved = bookmarkRepository.save(bm);
        log.info("[Bookmark] Created bookmark id={} on highlight={} for user={}",
                saved.getId(), highlight.getId(), callerId);
        return saved;
    }

    /**
     * Partially update a bookmark's user-facing metadata (label, color, note).
     * Anchor fields (messageId, selectedText, offsets) are intentionally immutable
     * after creation — the user should delete and recreate if the selection changes.
     */
    @Transactional
    public ConversationBookmark update(Long callerId, Long bookmarkId,
                                       String label, String color, String note) {
        ConversationBookmark bm = resolveOwnedBookmark(callerId, bookmarkId);

        if (label != null) bm.setLabel(label);
        if (color != null) bm.setColor(color);
        if (note  != null) bm.setNote(note);
        bm.setUpdatedAt(Instant.now());

        return bookmarkRepository.save(bm);
    }

    /**
     * Soft-delete a bookmark.
     */
    @Transactional
    public void delete(Long callerId, Long bookmarkId) {
        ConversationBookmark bm = resolveOwnedBookmark(callerId, bookmarkId);
        bm.setDeleted(true);
        bm.setDeletedAt(Instant.now());
        bookmarkRepository.save(bm);
        log.info("[Bookmark] Soft-deleted bookmark id={} by user={}", bookmarkId, callerId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private User resolveUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private Highlight resolveOwnedHighlight(Long callerId, Long highlightId) {
        Highlight h = highlightRepository.findById(highlightId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Highlight not found"));
        if (!h.getUser().getId().equals(callerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You do not have access to this highlight");
        }
        if (h.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.GONE,
                    "The parent highlight has been deleted");
        }
        return h;
    }

    private ConversationBookmark resolveOwnedBookmark(Long callerId, Long bookmarkId) {
        return bookmarkRepository.findByIdAndUserId(bookmarkId, callerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Bookmark not found or not owned by you"));
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
