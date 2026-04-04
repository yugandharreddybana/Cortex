package com.cortex.api.service;

import com.cortex.api.repository.HighlightRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class RetentionService {

    private static final Logger log = LoggerFactory.getLogger(RetentionService.class);
    private final HighlightRepository highlightRepository;
    private final NotificationService notificationService;
    private final com.cortex.api.repository.UserRepository userRepository;

    public RetentionService(HighlightRepository highlightRepository, 
                            NotificationService notificationService,
                            com.cortex.api.repository.UserRepository userRepository) {
        this.highlightRepository = highlightRepository;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    /**
     * Runs every day at 3:00 AM.
     * Finds items expiring in 3 days (deleted 27 days ago) and notifies owners.
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void notifyExpiringSoon() {
        log.info("[RETENTION] Checking for items expiring in 3 days...");
        Instant start = Instant.now().minus(28, ChronoUnit.DAYS);
        Instant end = Instant.now().minus(27, ChronoUnit.DAYS);
        
        java.util.List<com.cortex.api.entity.Highlight> expiring = highlightRepository.findDeletedBetween(start, end);
        // Group by user to avoid spamming multiple notifications to the same person
        java.util.Set<Long> userIdsToNotify = expiring.stream()
                .map(h -> h.getUser().getId())
                .filter(id -> id != null)
                .collect(java.util.stream.Collectors.toSet());

        for (long userId : userIdsToNotify) {
            userRepository.findById(userId).ifPresent(user -> {
                notificationService.sendSystemNotification(
                    user, 
                    "Items in trash expiring soon", 
                    "Some items in your trash will be permanently deleted in 3 days.",
                    "TRASH_EXPIRATION"
                );
            });
        }
    }

    /**
     * Automatically purge soft-deleted highlights that are older than 30 days.
     * Runs every day at 2:00 AM.
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void purgeTrash() {
        Instant cutoff = Instant.now().minus(30, ChronoUnit.DAYS);
        log.info("[RETENTION] Starting trash purge. Purging highlights deleted before {}", cutoff);
        
        try {
            highlightRepository.permanentlyDeleteOlderThan(cutoff);
            log.info("[RETENTION] Trash purge completed successfully.");
        } catch (Exception e) {
            log.error("[RETENTION] Failed to purge trash: {}", e.getMessage(), e);
        }
    }
}
