package com.cortex.api.repository;

import com.cortex.api.entity.BatchedEmailEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface BatchedEmailEventRepository extends JpaRepository<BatchedEmailEvent, Long> {

    /**
     * Find an active (non-expired, non-processed) window for a given
     * {@code (owner, editor, folder)} triple.
     *
     * <p>"Active" means: {@code processed = false} AND
     * {@code first_action_at >= windowStart} (where
     * {@code windowStart = Instant.now().minus(60, MINUTES)}).
     *
     * <p>Returns the most-recently opened window so that a triple with two
     * overlapping non-expired rows (which should not happen, but is defensively
     * handled) always picks the newer one.
     */
    @Query("""
        SELECT b FROM BatchedEmailEvent b
        WHERE b.owner.id  = :ownerId
          AND b.editor.id = :editorId
          AND b.folderId  = :folderId
          AND b.processed = false
          AND b.firstActionAt >= :windowStart
        ORDER BY b.firstActionAt DESC
        """)
    Optional<BatchedEmailEvent> findActiveWindow(
            @Param("ownerId")      Long ownerId,
            @Param("editorId")     Long editorId,
            @Param("folderId")     Long folderId,
            @Param("windowStart")  Instant windowStart);

    /**
     * Find all unprocessed events whose 60-minute window has elapsed.
     * Used exclusively by the {@link com.cortex.api.service.EmailBatchProcessor} cron.
     *
     * <p>Results are ordered oldest-first so the owner receives digests in
     * chronological order when multiple windows are processed in the same sweep.
     */
    @Query("""
        SELECT b FROM BatchedEmailEvent b
        WHERE b.processed = false
          AND b.firstActionAt < :cutoff
        ORDER BY b.firstActionAt ASC
        """)
    List<BatchedEmailEvent> findReadyToProcess(@Param("cutoff") Instant cutoff);
}
