package com.cortex.api.service;
 
import com.cortex.api.dto.ReactionDTO;
import com.cortex.api.entity.Comment;
import com.cortex.api.entity.CommentReaction;
import com.cortex.api.entity.User;
import com.cortex.api.repository.CommentReactionRepository;
import com.cortex.api.repository.CommentRepository;
import com.cortex.api.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
 
@Service
public class CommentReactionService {
 
    private static final Logger log = LoggerFactory.getLogger(CommentReactionService.class);
 
    private final CommentReactionRepository reactionRepo;
    private final CommentRepository commentRepo;
    private final UserRepository userRepo;
    private final NotificationService notificationService;
 
    public CommentReactionService(CommentReactionRepository reactionRepo,
                                   CommentRepository commentRepo,
                                   UserRepository userRepo,
                                   NotificationService notificationService) {
        this.reactionRepo = reactionRepo;
        this.commentRepo = commentRepo;
        this.userRepo = userRepo;
        this.notificationService = notificationService;
    }
 
    /**
     * WhatsApp-style reaction toggle.
     * 1. If user has existing reaction with SAME emoji -> Delete (remove).
     * 2. If user has existing reaction with DIFFERENT emoji -> Update (replace).
     * 3. If no reaction -> Create NEW.
     * Always returns the updated list of reactions for this comment.
     */
    @Transactional
    public List<ReactionDTO> toggleReaction(Long commentId, Long userId, String emoji) {
        log.info("[Reaction] User {} toggling emoji {} on comment {}", userId, emoji, commentId);
 
        Comment comment = commentRepo.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
 
        Optional<CommentReaction> existing = reactionRepo.findByCommentIdAndUserId(commentId, userId);
 
        if (existing.isPresent()) {
            CommentReaction reaction = existing.get();
            if (reaction.getEmoji().equals(emoji)) {
                // Case 1: Same emoji -> Double tap removes it
                reactionRepo.delete(reaction);
            } else {
                // Case 2: Different emoji -> Replace previous
                reaction.setEmoji(emoji);
                reactionRepo.save(reaction);
                
                // Trigger notification only on new/changed reaction
                notificationService.emitCommentReactionNotification(user, comment, emoji);
            }
        } else {
            // Case 3: New reaction
            CommentReaction reaction = new CommentReaction();
            reaction.setComment(comment);
            reaction.setUser(user);
            reaction.setEmoji(emoji);
            reactionRepo.save(reaction);
 
            // Trigger notification
            notificationService.emitCommentReactionNotification(user, comment, emoji);
        }
 
        List<CommentReaction> all = reactionRepo.findByCommentId(commentId);
        
        // Map to DTOs to avoid Hibernate proxy serialization issues in WebSockets
        List<ReactionDTO> dtos = all.stream()
            .map(r -> new ReactionDTO(
                r.getUser().getId(), 
                r.getUser().getFullName() != null ? r.getUser().getFullName() : r.getUser().getEmail(), 
                r.getEmoji()
            ))
            .toList();
 
        // Broadcast real-time update to highlight topic for immediate UI refresh
        notificationService.broadcastResourceActivity(
            "highlight", 
            comment.getHighlight().getId(), 
            "COMMENT_REACTION_UPDATED", 
            Map.of("commentId", commentId, "reactions", dtos) 
        );
 
        return dtos;
    }
 
    @Transactional
    public List<ReactionDTO> getReactionsDTO(Long commentId) {
        return reactionRepo.findByCommentId(commentId).stream()
            .map(r -> new ReactionDTO(
                java.util.Objects.requireNonNull(r.getUser().getId()), 
                r.getUser().getFullName() != null ? r.getUser().getFullName() : r.getUser().getEmail(), 
                r.getEmoji()
            ))
            .toList();
    }
}
