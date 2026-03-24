package com.cortex.api.service;

import com.cortex.api.entity.Referral;
import com.cortex.api.entity.User;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.ReferralRepository;
import com.cortex.api.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.CompletableFuture;
import java.util.Optional;

@Service
public class ReferralService {
    private static final Logger log = LoggerFactory.getLogger(ReferralService.class);

    private final ReferralRepository referralRepository;
    private final HighlightRepository highlightRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;

    public ReferralService(ReferralRepository referralRepository,
                           HighlightRepository highlightRepository,
                           UserRepository userRepository,
                           EmailService emailService,
                           NotificationService notificationService) {
        this.referralRepository = referralRepository;
        this.highlightRepository = highlightRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.notificationService = notificationService;
    }

    @Transactional
    public void processReferralForNewHighlight(User referredUser) {
        Optional<Referral> pendingReferralOpt = referralRepository.findByReferred(referredUser)
                .filter(ref -> "PENDING".equals(ref.getStatus()));

        if (pendingReferralOpt.isEmpty()) {
            return;
        }

        long highlightCount = highlightRepository.countByUserId(referredUser.getId());
        log.info("[REFERRAL] User {} has created {} highlights. Checking for referral trigger.", referredUser.getId(), highlightCount);

        if (highlightCount >= 5) {
            Referral referral = pendingReferralOpt.get();
            User referrer = referral.getReferrer();

            // Upgrade both to Pro for 1 month
            Instant referrerStart = Instant.now();
            Instant referrerEnd = upgradeToProForOneMonth(referrer);
            upgradeToProForOneMonth(referredUser);

            // Mark referral as completed
            referral.setStatus("COMPLETED");
            referral.setCompletedAt(Instant.now());
            referralRepository.save(referral);

            String referredName = referredUser.getFullName() != null && !referredUser.getFullName().isBlank() ? referredUser.getFullName() : referredUser.getEmail();

            // Send Notifications
            notificationService.emit(referrer, String.format("You've been upgraded to Pro because your friend %s created 5 highlights!", referredName), null);
            notificationService.emit(referredUser, "You've been upgraded to Pro for 1 month for completing 5 highlights!", null);

            // Send Email to Referrer Async
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM dd, yyyy").withZone(ZoneId.systemDefault());
            String formattedStart = formatter.format(referrerStart);
            String formattedEnd = formatter.format(referrerEnd);

            String referrerMessage = String.format("You've been upgraded to Pro level for one month starting from %s and ends to %s because your friend %s created 5 highlights! Enjoy your new features.", formattedStart, formattedEnd, referredName);

            CompletableFuture.runAsync(() -> {
                try {
                    emailService.sendEmail(referrer.getEmail(), "You Earned a Pro Upgrade!", referrerMessage);
                } catch (Exception e) {
                    log.error("[Email] Failed to send referral upgrade email to {}", referrer.getEmail(), e);
                }
            });

            log.info("[REFERRAL] Completed referral {} for referrer {} and referred {}", referral.getId(), referrer.getId(), referredUser.getId());
        }
    }

    private Instant upgradeToProForOneMonth(User user) {
        user.setTier("pro");
        user.setSubscriptionStatus("active");

        Instant newEnd = Instant.now().plus(30, ChronoUnit.DAYS);
        if (user.getCurrentPeriodEnd() != null && user.getCurrentPeriodEnd().isAfter(Instant.now())) {
            // Extend existing subscription
            newEnd = user.getCurrentPeriodEnd().plus(30, ChronoUnit.DAYS);
        }
        user.setCurrentPeriodEnd(newEnd);
        userRepository.save(user);
        return newEnd;
    }
}
