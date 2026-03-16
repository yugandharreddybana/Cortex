package com.cortex.api.repository;

import com.cortex.api.entity.HighlightTag;
import com.cortex.api.entity.HighlightTagId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface HighlightTagRepository extends JpaRepository<HighlightTag, HighlightTagId> {
    
    /**
     * Find all tags for a given highlight.
     */
    @Query("SELECT ht.tag FROM HighlightTag ht WHERE ht.highlight.id = :highlightId")
    List<Long> findTagIdsByHighlightId(@Param("highlightId") Long highlightId);

    /**
     * Delete all tags for a given highlight.
     */
    void deleteByHighlightId(Long highlightId);

    /**
     * Delete all highlight associations for a given tag.
     */
    void deleteByTagId(Long tagId);

    /**
     * Find all highlights that have a specific tag (owned by user).
     */
    @Query("SELECT ht.highlight.id FROM HighlightTag ht WHERE ht.tag.id = :tagId AND ht.highlight.user.id = :userId")
    List<Long> findHighlightIdsByTagIdAndUserId(@Param("tagId") Long tagId, @Param("userId") Long userId);
}
