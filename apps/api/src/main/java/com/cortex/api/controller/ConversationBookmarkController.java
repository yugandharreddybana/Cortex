package com.cortex.api.controller;

import com.cortex.api.entity.ConversationBookmark;
import com.cortex.api.service.ConversationBookmarkService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * REST controller for the Conversation Bookmark plugin.
 *
 * <h2>Endpoints</h2>
 * <pre>
 *   GET    /api/bookmarks                    – list all bookmarks for the current user
 *   GET    /api/bookmarks?highlightId={id}   – list bookmarks scoped to one AI highlight
 *   POST   /api/bookmarks                    – create a new bookmark from a text selection
 *   GET    /api/bookmarks/{id}/navigate      – resolve anchor data to re-highlight saved text
 *   PATCH  /api/bookmarks/{id}               – update label / color / note
 *   DELETE /api/bookmarks/{id}               – soft-delete a bookmark
 * </pre>
 *
 * <p>All endpoints require the caller to be authenticated via the existing JWT
 * filter chain.  The caller's user-ID is resolved from the {@link Authentication}
 * principal name, which matches the pattern used throughout this codebase.
 */
@RestController
@RequestMapping("/api/bookmarks")
public class ConversationBookmarkController {

    private final ConversationBookmarkService bookmarkService;

    @Autowired
    public ConversationBookmarkController(ConversationBookmarkService bookmarkService) {
        this.bookmarkService = bookmarkService;
    }

    // ─────────────────────────────────────────────────── GET /api/bookmarks ──

    /**
     * List all non-deleted bookmarks for the authenticated user.
     * Pass {@code ?highlightId=<id>} to scope the result to one AI highlight.
     */
    @GetMapping
    public ResponseEntity<List<ConversationBookmark>> list(
            Authentication auth,
            @RequestParam(required = false) Long highlightId) {

        Long callerId = resolveCaller(auth);

        List<ConversationBookmark> result = (highlightId != null)
                ? bookmarkService.listByHighlight(callerId, highlightId)
                : bookmarkService.listByUser(callerId);

        return ResponseEntity.ok(result);
    }

    // ────────────────────────────────────────────────── POST /api/bookmarks ──

    /**
     * Create a new bookmark from a user text selection.
     *
     * <p>Example request body:
     * <pre>{@code
     * {
     *   "highlightId": 42,
     *   "messageId":   "msg-7",
     *   "selectedText": "Revenue rose sharply in Q3",
     *   "startOffset": 14,
     *   "endOffset":   40,
     *   "quoteSnippet": "Revenue rose sharply in Q3 due to enterprise upgrades",
     *   "label": "Q3 revenue note",
     *   "color": "#FFD700"
     * }
     * }</pre>
     */
    @PostMapping
    public ResponseEntity<ConversationBookmark> create(
            Authentication auth,
            @Valid @RequestBody CreateBookmarkRequest req) {

        Long callerId = resolveCaller(auth);
        ConversationBookmark created = bookmarkService.create(callerId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // ─────────────────────────────────── GET /api/bookmarks/{id}/navigate ──

    /**
     * Return the navigation payload for a bookmark so the frontend can:
     * <ol>
     *   <li>Open the correct AI conversation.</li>
     *   <li>Scroll to the saved message bubble.</li>
     *   <li>Re-apply the text highlight range.</li>
     * </ol>
     */
    @GetMapping("/{id}/navigate")
    public ResponseEntity<BookmarkNavigateResponse> navigate(
            Authentication auth,
            @PathVariable Long id) {

        Long callerId = resolveCaller(auth);
        return ResponseEntity.ok(bookmarkService.navigate(callerId, id));
    }

    // ──────────────────────────────────────── PATCH /api/bookmarks/{id} ──

    /**
     * Update the user-facing metadata of a bookmark (label, color, note).
     *
     * <p>Anchor fields (messageId, selectedText, offsets) are intentionally
     * immutable — delete and recreate if the selection must change.
     *
     * <p>Example request body (all fields optional):
     * <pre>{@code
     * { "label": "Updated label", "color": "#00BFFF", "note": "See slide 12" }
     * }</pre>
     */
    @PatchMapping("/{id}")
    public ResponseEntity<ConversationBookmark> update(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        Long callerId = resolveCaller(auth);
        ConversationBookmark updated = bookmarkService.update(
                callerId, id,
                body.get("label"),
                body.get("color"),
                body.get("note")
        );
        return ResponseEntity.ok(updated);
    }

    // ─────────────────────────────────────── DELETE /api/bookmarks/{id} ──

    /**
     * Soft-delete a bookmark.  The record is retained in the database but
     * excluded from all subsequent API responses.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            Authentication auth,
            @PathVariable Long id) {

        Long callerId = resolveCaller(auth);
        bookmarkService.delete(callerId, id);
        return ResponseEntity.noContent().build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Resolve the numeric user-ID from the JWT principal.
     * The principal name is stored as the user's ID string by {@link com.cortex.api.service.JwtService}.
     */
    private Long resolveCaller(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
