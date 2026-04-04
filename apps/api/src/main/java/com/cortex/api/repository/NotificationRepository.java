package com.cortex.api.repository;

import com.cortex.api.entity.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** All notifications for a user, newest first. */
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** Paginated — prevents loading thousands of old notifications at once. */
    @Query("SELECT n FROM Notification n WHERE n.user.id = :userId ORDER BY n.createdAt DESC")
    List<Notification> findByUserIdPaged(@Param("userId") Long userId, Pageable pageable);

    /** Unread only — used by the notification badge. */
    List<Notification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(Long userId);

    /** Fast count for the badge without loading full entities. */
    long countByUserIdAndIsReadFalse(Long userId);

    /** Bulk mark-all-read: more efficient than loading + save-all for large lists. */
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
    int markAllReadByUserId(@Param("userId") Long userId);

    /**
     * Find the un-responded ACCESS_REQUEST notification for an owner + requestId.
     * Used to mark the notification(s) as responded after the owner approves or rejects.
     * Returns a list to prevent NonUniqueResultException if duplicates exist.
     */
    @Query("SELECT n FROM Notification n WHERE n.user.id = :ownerId AND n.type = 'ACCESS_REQUEST' " +
           "AND (n.metadata LIKE %:exactIdFragment1% OR n.metadata LIKE %:exactIdFragment2%) " +
           "AND (n.responded IS NULL OR n.responded = '')")
    List<Notification> findPendingAccessRequestNotifications(
            @Param("ownerId") Long ownerId,
            @Param("exactIdFragment1") String exactIdFragment1,
            @Param("exactIdFragment2") String exactIdFragment2);

    /**
     * Daily cleanup: delete read notifications older than the given cutoff.
     * Called by {@link com.cortex.api.service.NotificationCleanupTask}.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM Notification n WHERE n.createdAt < :cutoff AND n.isRead = true")
    void purgeExpiredReadNotifications(@Param("cutoff") Instant cutoff);
}
