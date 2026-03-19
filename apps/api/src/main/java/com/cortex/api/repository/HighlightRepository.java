package com.cortex.api.repository;

import com.cortex.api.entity.Highlight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface HighlightRepository extends JpaRepository<Highlight, Long> {
    /**
     * Find all highlights for a user, excluding soft-deleted ones.
     * Ordered by creation date descending (most recent first).
     */
    @Query("SELECT h FROM Highlight h WHERE h.user.id = :userId AND h.isDeleted = false AND NOT EXISTS (SELECT 1 FROM h.hiddenByUsers u WHERE u.id = :userId) ORDER BY h.createdAt DESC")
    List<Highlight> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    /**
     * Find all highlights for a user or in specified folders, excluding soft-deleted ones.
     */
    @Query("SELECT h FROM Highlight h WHERE (h.user.id = :userId OR (h.folderId IN :folderIds AND h.folderId IS NOT NULL)) AND h.isDeleted = false AND NOT EXISTS (SELECT 1 FROM h.hiddenByUsers u WHERE u.id = :userId) ORDER BY h.createdAt DESC")
    List<Highlight> findByUserIdOrFolderIdsOrderByCreatedAtDesc(@Param("userId") Long userId, @Param("folderIds") List<Long> folderIds);

    /**
     * Find a specific highlight by ID and user ID, only if it's not deleted.
     */
    @Query("SELECT h FROM Highlight h WHERE h.id = :id AND h.user.id = :userId AND h.isDeleted = false")
    Optional<Highlight> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    /**
     * Soft-delete a highlight: mark it as deleted and record who deleted it and when.
     */
    @Modifying
    @Transactional
    @Query("UPDATE Highlight h SET h.isDeleted = true, h.deletedByUserId = :deletedByUserId, h.deletedAt = :deletedAt WHERE h.id = :id AND h.user.id = :userId")
    void softDeleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId, @Param("deletedByUserId") Long deletedByUserId, @Param("deletedAt") Instant deletedAt);

    /**
     * Find all highlights (including deleted ones) to support trash/recovery features.
     * Includes both active and soft-deleted highlights.
     */
    @Query("SELECT h FROM Highlight h WHERE h.user.id = :userId AND NOT EXISTS (SELECT 1 FROM h.hiddenByUsers u WHERE u.id = :userId) ORDER BY h.createdAt DESC")
    List<Highlight> findAllByUserIdInclandDeleted(@Param("userId") Long userId);

    /**
     * Find all highlights for a user or in specified folders, including soft-deleted ones.
     */
    @Query("SELECT h FROM Highlight h WHERE (h.user.id = :userId OR (h.folderId IN :folderIds AND h.folderId IS NOT NULL)) AND NOT EXISTS (SELECT 1 FROM h.hiddenByUsers u WHERE u.id = :userId) ORDER BY h.createdAt DESC")
    List<Highlight> findAllByUserIdOrFolderIdsInclandDeleted(@Param("userId") Long userId, @Param("folderIds") List<Long> folderIds);

    /**
     * Find all soft-deleted highlights for a user (trash).
     */
    @Query("SELECT h FROM Highlight h WHERE h.user.id = :userId AND h.isDeleted = true ORDER BY h.deletedAt DESC")
    List<Highlight> findDeletedByUserId(@Param("userId") Long userId);

    /**
     * Hard-delete: Permanently remove a soft-deleted highlight by ID and user ID.
     * Only soft-deleted highlights can be permanently deleted.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM Highlight h WHERE h.id = :id AND h.user.id = :userId AND h.isDeleted = true")
    void permanentlyDeleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    /**
     * Restore a soft-deleted highlight by marking it as not deleted.
     */
    @Modifying
    @Transactional
    @Query("UPDATE Highlight h SET h.isDeleted = false, h.deletedByUserId = null, h.deletedAt = null WHERE h.id = :id AND h.user.id = :userId AND h.isDeleted = true")
    void restoreByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    /**
     * Find all non-deleted highlights belonging to a specific folder.
     * Used by the deep-clone operation to copy highlights into a new folder.
     */
    @Query("SELECT h FROM Highlight h WHERE h.folderId = :folderId AND h.isDeleted = false")
    List<Highlight> findByFolderIdAndNotDeleted(@Param("folderId") Long folderId);
}
