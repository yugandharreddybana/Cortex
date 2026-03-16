package com.cortex.api.repository;

import com.cortex.api.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    
    /**
     * Find all comments on a specific highlight.
     */
    List<Comment> findByHighlightIdOrderByCreatedAtAsc(Long highlightId);

    /**
     * Find comments authored by a specific user.
     */
    List<Comment> findByAuthorIdOrderByCreatedAtDesc(Long userId);

    /**
     * Find all comments authored by User A on User B's highlights.
     * Used in notifications.
     */
    @Query("""
        SELECT c FROM Comment c
        WHERE c.highlight.user.id = :targetUserId
          AND c.author.id <> :targetUserId
          AND c.highlight.id = :highlightId
        ORDER BY c.createdAt DESC
    """)
    List<Comment> findRecentCommentsByOthersOnHighlight(
            @Param("highlightId") Long highlightId,
            @Param("targetUserId") Long targetUserId
    );
}
