package com.cortex.api.service;

import com.cortex.api.entity.Comment;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.User;
import com.cortex.api.repository.CommentRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Comment Service: Handles comment creation with RBAC and notifications.
 * 
 * RBAC Rules:
 * - OWNER: Can read, write, and see all comments
 * - EDITOR: Can read and write comments
 * - VIEWER: Can read comments only (403 on POST)
 */
@Service
public class CommentService {
    
    private static final Logger log = LoggerFactory.getLogger(CommentService.class);

    private final CommentRepository commentRepo;
    private final HighlightRepository highlightRepo;
    private final UserRepository userRepo;
    private final EmailService emailService;
    private final SecurityService securityService;

    public CommentService(
            CommentRepository commentRepo,
            HighlightRepository highlightRepo,
            UserRepository userRepo,
            EmailService emailService,
            SecurityService securityService
    ) {
        this.commentRepo = commentRepo;
        this.highlightRepo = highlightRepo;
        this.userRepo = userRepo;
        this.emailService = emailService;
        this.securityService = securityService;
    }

    /**
     * Add a comment to a highlight.
     * Enforces RBAC: Only OWNER and EDITOR roles can comment.
     * Triggers email notification to the highlight owner.
     */
    @Transactional
    public Comment addComment(Long highlightId, String text, Long authorId) {
        log.info("[Comment] User {} adding comment to highlight {}", authorId, highlightId);

        // 1. Verify highlight exists
        Highlight highlight = highlightRepo.findById(highlightId)
                .orElseThrow(() -> {
                    log.warn("[Comment] Highlight {} not found", highlightId);
                    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Highlight not found");
                });

        // 2. Get author user
        User author = userRepo.findById(authorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        // 3. RBAC: Only OWNER can comment on highlights they don't own
        // This is a simplified version; in production, you'd check sharing permissions
        Long highlightOwnerId = highlight.getUser().getId();
        
        if (!highlightOwnerId.equals(authorId)) {
            // Check if user has at least COMMENTER access
            if (!securityService.hasHighlightAccess(highlightId, "COMMENTER")) {
                log.warn("[RBAC] User {} attempted comment on highlight {} they don't have access to", 
                        authorId, highlightId);
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You must have commenter or editor access to add comments to this highlight.");
            }
        }

        // 4. Create comment
        Comment comment = new Comment();
        comment.setHighlight(highlight);
        comment.setAuthor(author);
        comment.setText(text);
        Comment saved = commentRepo.save(comment);

        log.info("[Comment] Saved comment {} on highlight {}", saved.getId(), highlightId);

        // 5. Send notification email (async) to highlight owner
        String ownerEmail = highlight.getUser().getEmail();
        emailService.sendCommentNotification(
                ownerEmail,
                author.getEmail(),
                String.valueOf(highlightId),
                highlight.getText().substring(0, Math.min(100, highlight.getText().length())),
                text
        );
        log.info("[Email] Queued comment notification to {}", ownerEmail);

        return saved;
    }

    /**
     * Get all comments on a highlight.
     */
    public List<Comment> getCommentsByHighlight(Long highlightId) {
        return commentRepo.findByHighlightIdOrderByCreatedAtAsc(highlightId);
    }

    /**
     * Get all comments authored by a user.
     */
    public List<Comment> getCommentsByAuthor(Long userId) {
        return commentRepo.findByAuthorIdOrderByCreatedAtDesc(userId);
    }

    /**
     * Update an existing comment.
     * Only the author can update their comment.
     */
    @Transactional
    public Comment updateComment(Long commentId, Long requesterId, String newText) {
        Comment comment = commentRepo.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        if (!comment.getAuthor().getId().equals(requesterId)) {
            log.warn("[RBAC] User {} attempted unauthorized comment update on comment {}", requesterId, commentId);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only edit your own comments");
        }

        comment.setText(newText);
        Comment saved = commentRepo.save(comment);
        log.info("[Comment] Updated comment {} by author {}", commentId, requesterId);
        return saved;
    }

    /**
     * Delete a comment (author or highlight owner only).
     */
    @Transactional
    public void deleteComment(Long commentId, Long requesterId) {
        Comment comment = commentRepo.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        // Only the author or highlight owner can delete
        Long authorId = comment.getAuthor().getId();
        Long highlightOwnerId = comment.getHighlight().getUser().getId();

        if (!authorId.equals(requesterId) && !highlightOwnerId.equals(requesterId)) {
            log.warn("[RBAC] User {} attempted unauthorized comment deletion", requesterId);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete this comment");
        }

        commentRepo.delete(comment);
        log.info("[Comment] Deleted comment {} by request of {}", commentId, requesterId);
    }
}
