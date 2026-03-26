package com.cortex.api.controller;

import com.cortex.api.entity.Comment;
import com.cortex.api.service.CommentService;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/highlights/{highlightId}/comments")
public class CommentController {
    
    private static final Logger log = LoggerFactory.getLogger(CommentController.class);

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    /**
     * GET /api/v1/highlights/{highlightId}/comments
     * Fetch all comments on a highlight.
     */
    @GetMapping
    @Transactional
    public List<CommentDTO> getComments(Authentication auth, @PathVariable Long highlightId) {
        log.info("[Comment] Fetching comments for highlight {}", highlightId);
        return commentService.getCommentsByHighlight(highlightId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    /**
     * POST /api/v1/highlights/{highlightId}/comments
     * Add a comment to a highlight.
     * RBAC: Only EDITOR and OWNER can comment (403 for VIEWER).
     */
    @PostMapping
    @Transactional
    public ResponseEntity<CommentDTO> addComment(
            Authentication auth,
            @PathVariable Long highlightId,
            @RequestBody CommentRequest request
    ) {
        Long userId = Long.parseLong(auth.getName());
        log.info("[Comment] User {} adding comment to highlight {}", userId, highlightId);

        try {
            Comment comment = commentService.addComment(highlightId, request.text, userId);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDTO(comment));
        } catch (Exception e) {
            log.error("[Comment] Error adding comment", e);
            throw e;
        }
    }

    /**
     * PUT /api/v1/highlights/{highlightId}/comments/{commentId}
     * Update an existing comment.
     */
    @PutMapping("/{commentId}")
    public ResponseEntity<CommentDTO> updateComment(
            Authentication auth,
            @PathVariable Long highlightId,
            @PathVariable Long commentId,
            @RequestBody CommentRequest request
    ) {
        Long userId = Long.parseLong(auth.getName());
        log.info("[Comment] User {} updating comment {}", userId, commentId);

        try {
            Comment updated = commentService.updateComment(commentId, userId, request.text);
            return ResponseEntity.ok(toDTO(updated));
        } catch (Exception e) {
            log.error("[Comment] Error updating comment", e);
            throw e;
        }
    }

    /**
     * DELETE /api/v1/highlights/{highlightId}/comments/{commentId}
     * Delete a comment (author or highlight owner only).
     */
    @DeleteMapping("/{commentId}")
    @Transactional
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

    // ── Helpers ──

    private CommentDTO toDTO(Comment c) {
        CommentDTO dto = new CommentDTO();
        dto.id = c.getId();
        dto.highlightId = c.getHighlight().getId();
        dto.authorId = c.getAuthor().getId();
        dto.authorEmail = c.getAuthor().getEmail();
        dto.authorFullName = c.getAuthor().getFullName();
        dto.text = c.getText();
        dto.createdAt = c.getCreatedAt();
        return dto;
    }

    // ── DTOs ──

    public static class CommentRequest {
        public String text;
    }

    public static class CommentDTO {
        public Long id;
        public Long highlightId;
        public Long authorId;
        public String authorEmail;
        public String authorFullName;
        public String text;
        public Instant createdAt;
    }
}
