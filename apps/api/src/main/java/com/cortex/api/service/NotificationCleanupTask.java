package com.cortex.api.service;

import com.cortex.api.repository.NotificationRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Daily background task: purge read notifications older than 3 days.
 *
 * <p>Actionable notifications (SHARE_INVITE, ACCESS_REQUEST) are deleted
 * immediately when both {@code isRead=true} and {@code responded != null}
 * via {@link NotificationService#deleteAndBroadcastDeletion}.  This cron
 * handles the remainder — non-actionable types (GENERAL, ACCESS_REQUEST_RESOLVED,
 * etc.) that were read but have no respond step.
 *
 * <p>Runs daily at midnight (server local time).  Requires
 * {@code @EnableScheduling} on the application class — already present in
 * {@link com.cortex.api.CortexApiApplication}.
 */
@Component
public class NotificationCleanupTask {

    private static final Logger log = LoggerFactory.getLogger(NotificationCleanupTask.class);

    private final NotificationRepository notifRepo;

    public NotificationCleanupTask(NotificationRepository notifRepo) {
        this.notifRepo = notifRepo;
    }

    /** Daily at midnight: delete read notifications older than 3 days. */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void purgeOldReadNotifications() {
        Instant cutoff = Instant.now().minus(3, ChronoUnit.DAYS);
        notifRepo.purgeExpiredReadNotifications(cutoff);
        log.info("[NotificationCleanup] Purged read notifications older than 3 days (cutoff={})", cutoff);
    }
}
