package com.cortex.api.repository;

import com.cortex.api.entity.Folder;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FolderRepository extends JpaRepository<Folder, Long> {
    
    /**
     * Find all folders owned by a user.
     */
    @Query("SELECT f FROM Folder f WHERE f.user.id = :userId")
    List<Folder> findByUserId(@Param("userId") Long userId);

    /**
     * Find a folder by ID if it's owned by a specific user.
     */
    @Query("SELECT f FROM Folder f WHERE f.id = :id AND f.user.id = :userId")
    Optional<Folder> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    /**
     * Find multiple folders by ID if they're owned by a specific user.
     */
    @Query("SELECT f FROM Folder f WHERE f.id IN :ids AND f.user.id = :userId")
    List<Folder> findAllByIdsAndUserId(@Param("ids") List<Long> ids, @Param("userId") Long userId);

    /**
     * Delete a folder by ID if it's owned by a specific user.
     */
    void deleteByIdAndUserId(Long id, Long userId);

    /**
     * Find all root-level folders (no parent) for a user.
     */
    @Query("SELECT f FROM Folder f WHERE f.user.id = :userId AND f.parentFolder IS NULL")
    List<Folder> findByUserIdAndParentFolderIsNull(@Param("userId") Long userId);

    /**
     * Find all child folders of a specific parent folder.
     */
    @Query("SELECT f FROM Folder f WHERE f.parentFolder.id = :parentFolderId")
    List<Folder> findByParentFolderId(@Param("parentFolderId") Long parentFolderId);

    /**
     * Find child folders of a parent, but only for a specific user.
     */
    @Query("""
        SELECT f FROM Folder f
        WHERE f.parentFolder.id = :parentId
          AND f.user.id = :userId
    """)
    List<Folder> findChildrenByParentAndUser(
        @Param("parentId") Long parentId,
        @Param("userId") Long userId
    );

    /**
     * Check if a folder name is already taken at a specific parent level
     * (for uniqueness validation).
     */
    @Query("""
        SELECT COUNT(f) > 0 FROM Folder f
        WHERE f.user.id = :userId
          AND f.name = :name
          AND CASE
                WHEN :parentId IS NULL THEN f.parentFolder IS NULL
                ELSE f.parentFolder.id = :parentId
              END
    """)
    boolean existsByUserAndParentAndName(
        @Param("userId") Long userId,
        @Param("name") String name,
        @Param("parentId") Long parentId
    );

    /**
     * Find all descendant IDs (recursive) of a folder via recursive query.
     * Used for bulk operations to avoid Hibernate session conflicts.
     */
    @Query(value = """
        WITH RECURSIVE descendants AS (
            SELECT id FROM folders WHERE id = ?1
            UNION ALL
            SELECT f.id FROM folders f
            INNER JOIN descendants d ON f.parent_folder_id = d.id
        )
        SELECT id FROM descendants
    """, nativeQuery = true)
    List<Long> findAllDescendantIdsInclusive(Long folderId);

    /**
     * Find all descendants (recursive) of a folder via recursive query.
     * Used for cascade deletion. INCLUDES the root folder itself.
     */
    @Query(value = """
        WITH RECURSIVE descendants AS (
            SELECT id FROM folders WHERE id = ?1
            UNION ALL
            SELECT f.id FROM folders f
            INNER JOIN descendants d ON f.parent_folder_id = d.id
        )
        SELECT * FROM folders WHERE id IN (SELECT id FROM descendants)
    """, nativeQuery = true)
    List<Folder> findAllDescendantsInclusive(Long folderId);

    /**
     * Find all descendants (recursive) of a list of folders via recursive query.
     * Used for shared folder tree visibility expansion.
     */
    @Query(value = """
        WITH RECURSIVE descendants AS (
            SELECT id FROM folders WHERE id IN :rootIds
            UNION ALL
            SELECT f.id FROM folders f
            INNER JOIN descendants d ON f.parent_folder_id = d.id
        )
        SELECT id FROM descendants
    """, nativeQuery = true)
    List<Long> findAllDescendantIdsByParentIds(@Param("rootIds") List<Long> rootIds);

    /**
     * Bulk-delete folders by their IDs.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM Folder f WHERE f.id IN :ids")
    void deleteByIdIn(@Param("ids") List<Long> ids);
}
