package com.cortex.api.service;

import com.cortex.api.dto.CommentDTO;
import com.cortex.api.dto.ReactionDTO;
import com.cortex.api.entity.Comment;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.User;
import com.cortex.api.repository.CommentRepository;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

/**
 * Comment Service: Handles comment creation with RBAC and notifications.
 */
@Service
public class CommentService {
    
    private static final Logger log = LoggerFactory.getLogger(CommentService.class);

    private final CommentRepository commentRepo;
    private final HighlightRepository highlightRepo;
    private final UserRepository userRepo;
    private final EmailService emailService;
    private final SecurityService securityService;
    private final NotificationService notificationService;
    private final FolderRepository folderRepo;
    private final CommentReactionService reactionService;

    public CommentService(
            CommentRepository commentRepo,
            HighlightRepository highlightRepo,
            UserRepository userRepo,
            EmailService emailService,
            SecurityService securityService,
            NotificationService notificationService,
            FolderRepository folderRepo,
            CommentReactionService reactionService
    ) {
        this.commentRepo = commentRepo;
        this.highlightRepo = highlightRepo;
        this.userRepo = userRepo;
        this.emailService = emailService;
        this.securityService = securityService;
        this.notificationService = notificationService;
        this.folderRepo = folderRepo;
        this.reactionService = reactionService;
    }

    @Transactional
    public CommentDTO addComment(Long highlightId, String text, Long authorId) {
        log.info("[Comment] User {} adding comment to highlight {}", authorId, highlightId);

        Highlight highlight = highlightRepo.findById(highlightId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Highlight not found"));

        User author = userRepo.findById(java.util.Objects.requireNonNull(authorId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        if (!securityService.hasHighlightAccess(highlightId, "COMMENTER")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You must have commenter access.");
        }

        Comment comment = new Comment();
        comment.setHighlight(highlight);
        comment.setAuthor(author);
        comment.setText(text);
        Comment saved = commentRepo.save(comment);

        // --- Notifications ---
        if (highlight.getFolderId() != null) {
            folderRepo.findById(highlight.getFolderId()).ifPresent(f -> {
                notificationService.notifyAllFolderMembers(author, f, highlight, "added a comment", text, "COMMENT_MODIFIED");
            });
        } else {
            // Private highlight fallback: Notification to owner
            User owner = highlight.getUser();
            if (!owner.getId().equals(authorId)) {
                emailService.sendCommentNotification(
                    owner.getEmail(),
                    author.getFullName() != null ? author.getFullName() : author.getEmail(),
                    String.valueOf(highlightId),
                    highlight.getText().substring(0, Math.min(100, highlight.getText().length())),
                    text
                );
            }
        }

        CommentDTO dto = toDTO(saved);
        notificationService.broadcastResourceActivity("highlight", highlightId, "COMMENT_ADDED", dto);
        return dto;
    }

    @Transactional
    public CommentDTO updateComment(Long commentId, Long requesterId, String newText) {
        Comment comment = commentRepo.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        if (!comment.getAuthor().getId().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only edit your own comments");
        }

        comment.setText(newText);
        Comment saved = commentRepo.save(comment);

        // --- Notifications ---
        Highlight h = saved.getHighlight();
        if (h.getFolderId() != null) {
            folderRepo.findById(h.getFolderId()).ifPresent(f -> {
                notificationService.notifyAllFolderMembers(comment.getAuthor(), f, h, "updated their comment", newText, "COMMENT_MODIFIED");
            });
        }

        CommentDTO dto = toDTO(saved);
        notificationService.broadcastResourceActivity("highlight", h.getId(), "COMMENT_UPDATED", dto);
        return dto;
    }

    @Transactional
    public void deleteComment(Long commentId, Long requesterId) {
        Comment comment = commentRepo.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (!comment.getAuthor().getId().equals(requesterId) && !securityService.hasHighlightAccess(comment.getHighlight().getId(), "EDITOR")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        Highlight h = comment.getHighlight();
        User author = comment.getAuthor();

        // --- Notifications ---
        if (h.getFolderId() != null) {
            folderRepo.findById(h.getFolderId()).ifPresent(f -> {
                notificationService.notifyAllFolderMembers(author, f, h, "deleted a comment", "(Comment removed)", "COMMENT_MODIFIED");
            });
        }

        commentRepo.delete(comment);
        notificationService.broadcastResourceActivity("highlight", h.getId(), "COMMENT_DELETED", Map.of("id", commentId));
    }

    @Transactional
    public List<CommentDTO> getCommentsDTOByHighlight(Long highlightId) {
        return commentRepo.findByHighlightIdOrderByCreatedAtAsc(highlightId).stream()
                .map(this::toDTO)
                .toList();
    }

    private CommentDTO toDTO(Comment c) {
        return new CommentDTO(
            c.getId(),
            c.getHighlight().getId(),
            c.getAuthor().getId(),
            c.getAuthor().getEmail(),
            c.getAuthor().getFullName(),
            c.getText(),
            c.getCreatedAt(),
            reactionService.getReactionsDTO(c.getId())
        );
    }
}
