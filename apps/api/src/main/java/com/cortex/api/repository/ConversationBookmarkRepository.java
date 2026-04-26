package com.cortex.api.repository;

import com.cortex.api.entity.ConversationBookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Data-access layer for {@link ConversationBookmark}.
 *
 * <p>All query methods filter by {@code isDeleted = false} so that soft-deleted
 * bookmarks are never exposed to the service layer.
 */
@Repository
public interface ConversationBookmarkRepository extends JpaRepository<ConversationBookmark, Long> {

    // ── List queries ─────────────────────────────────────────────────────────

    /**
     * Return all non-deleted bookmarks owned by a user, newest first.
     */
    @Query("""
            SELECT b FROM ConversationBookmark b
            WHERE b.user.id = :userId
              AND b.isDeleted = false
            ORDER BY b.createdAt DESC
            """)
    List<ConversationBookmark> findAllByUserId(@Param("userId") Long userId);

    /**
     * Return all non-deleted bookmarks for a specific AI highlight,
     * owned by the given user.
     */
    @Query("""
            SELECT b FROM ConversationBookmark b
            WHERE b.user.id     = :userId
              AND b.highlight.id = :highlightId
              AND b.isDeleted   = false
            ORDER BY b.createdAt DESC
            """)
    List<ConversationBookmark> findByUserIdAndHighlightId(
            @Param("userId") Long userId,
            @Param("highlightId") Long highlightId);

    // ── Single-item lookup ───────────────────────────────────────────────────

    /**
     * Fetch a single non-deleted bookmark by its PK, scoped to the owner.
     * Used to enforce ownership before update / soft-delete.
     */
    @Query("""
            SELECT b FROM ConversationBookmark b
            WHERE b.id       = :id
              AND b.user.id  = :userId
              AND b.isDeleted = false
            """)
    Optional<ConversationBookmark> findByIdAndUserId(
            @Param("id") Long id,
            @Param("userId") Long userId);

    // ── Bulk operations ──────────────────────────────────────────────────────

    /**
     * Soft-delete all bookmarks belonging to a highlight when the parent
     * highlight itself is soft-deleted.  Called by the highlight deletion path.
     */
    @Modifying
    @Query("""
            UPDATE ConversationBookmark b
            SET b.isDeleted = true,
                b.deletedAt = :deletedAt
            WHERE b.highlight.id = :highlightId
              AND b.isDeleted    = false
            """)
    void softDeleteByHighlightId(
            @Param("highlightId") Long highlightId,
            @Param("deletedAt") Instant deletedAt);

    /**
     * Soft-delete all bookmarks for a batch of highlight IDs.
     * Used during bulk folder deletion.
     */
    @Modifying
    @Query("""
            UPDATE ConversationBookmark b
            SET b.isDeleted = true,
                b.deletedAt = :deletedAt
            WHERE b.highlight.id IN :highlightIds
              AND b.isDeleted    = false
            """)
    void softDeleteByHighlightIds(
            @Param("highlightIds") List<Long> highlightIds,
            @Param("deletedAt") Instant deletedAt);
}
