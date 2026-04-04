package com.cortex.api.repository;
 
import com.cortex.api.entity.CommentReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
 
import java.util.List;
import java.util.Optional;
 
@Repository
public interface CommentReactionRepository extends JpaRepository<CommentReaction, Long> {
 
    /**
     * Finds a reaction for a specific user and comment.
     */
    Optional<CommentReaction> findByCommentIdAndUserId(Long commentId, Long userId);
 
    /**
     * Lists all reactions for a specific comment.
     */
    List<CommentReaction> findByCommentId(Long commentId);
 
    /**
     * Count each type of emoji for a specific comment.
     */
    @Query("SELECT r.emoji, COUNT(r) FROM CommentReaction r WHERE r.comment.id = :commentId GROUP BY r.emoji")
    List<Object[]> countReactionsByCommentId(@Param("commentId") Long commentId);
}
