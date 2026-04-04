package com.cortex.api.controller;

import com.cortex.api.dto.CommentDTO;
import com.cortex.api.dto.ReactionDTO;
import com.cortex.api.service.CommentService;
import com.cortex.api.service.CommentReactionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.List;

@RestController
@RequestMapping("/api/v1/highlights/{highlightId}/comments")
public class CommentController {
    
    private static final Logger log = LoggerFactory.getLogger(CommentController.class);

    private final CommentService commentService;
    private final CommentReactionService reactionService;
 
    public CommentController(CommentService commentService, CommentReactionService reactionService) {
        this.commentService = commentService;
        this.reactionService = reactionService;
    }

    /**
     * GET /api/v1/highlights/{highlightId}/comments
     * Fetch all comments on a highlight.
     */
    @GetMapping
    @PreAuthorize("@securityService.hasHighlightAccess(#highlightId, 'VIEWER')")
    public List<CommentDTO> getComments(Authentication auth, @PathVariable Long highlightId) {
        log.info("[Comment] Fetching comments for highlight {}", highlightId);
        return commentService.getCommentsDTOByHighlight(highlightId);
    }

    /**
     * POST /api/v1/highlights/{highlightId}/comments
     * Add a comment to a highlight.
     */
    @PostMapping
    @PreAuthorize("@securityService.hasHighlightAccess(#highlightId, 'COMMENTER')")
    public ResponseEntity<CommentDTO> addComment(
            Authentication auth,
            @PathVariable Long highlightId,
            @RequestBody CommentRequest request
    ) {
        Long userId = Long.parseLong(auth.getName());
        log.info("[Comment] User {} adding comment to highlight {}", userId, highlightId);
        CommentDTO comment = commentService.addComment(highlightId, request.text, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(comment);
    }

    /**
     * PUT /api/v1/highlights/{highlightId}/comments/{commentId}
     * Update an existing comment.
     */
    @PutMapping("/{commentId}")
    @PreAuthorize("@securityService.hasHighlightAccess(#highlightId, 'COMMENTER')")
    public ResponseEntity<CommentDTO> updateComment(
            Authentication auth,
            @PathVariable Long highlightId,
            @PathVariable Long commentId,
            @RequestBody CommentRequest request
    ) {
        Long userId = Long.parseLong(auth.getName());
        log.info("[Comment] User {} updating comment {}", userId, commentId);
        CommentDTO updated = commentService.updateComment(commentId, userId, request.text);
        return ResponseEntity.ok(updated);
    }

    /**
     * DELETE /api/v1/highlights/{highlightId}/comments/{commentId}
     * Delete a comment.
     */
    @DeleteMapping("/{commentId}")
    @PreAuthorize("@securityService.hasHighlightAccess(#highlightId, 'VIEWER')")
    public ResponseEntity<Void> deleteComment(
            Authentication auth,
            @PathVariable Long highlightId,
            @PathVariable Long commentId
    ) {
        Long userId = Long.parseLong(auth.getName());
        log.info("[Comment] User {} deleting comment {}", userId, commentId);
        commentService.deleteComment(commentId, userId);
        return ResponseEntity.noContent().build();
    }
 
    /**
     * POST /api/v1/highlights/{highlightId}/comments/{commentId}/reactions
     * Toggle a reaction on a comment.
     */
    @PostMapping("/{commentId}/reactions")
    @PreAuthorize("@securityService.hasHighlightAccess(#highlightId, 'VIEWER')")
    public List<ReactionDTO> toggleReaction(
            Authentication auth,
            @PathVariable Long highlightId,
            @PathVariable Long commentId,
            @RequestBody ReactionRequest request
    ) {
        Long userId = Long.parseLong(auth.getName());
        return reactionService.toggleReaction(commentId, userId, request.emoji);
    }

    // ── DTOs ──

    public static class CommentRequest {
        public String text;
    }
 
    public static class ReactionRequest {
        public String emoji;
    }
}
