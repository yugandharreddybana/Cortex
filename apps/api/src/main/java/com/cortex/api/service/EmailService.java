package com.cortex.api.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Email Service: Sends async notifications.
 *
 * <p>Every public method is annotated with {@code @Async} so SMTP calls always
 * run in a separate thread and can <strong>never</strong> block the caller's
 * HTTP request thread or roll back the caller's database transaction.
 *
 * <p>All methods swallow exceptions internally and log them as errors; this
 * ensures email failures are fully isolated from user-facing operations (folder
 * saves, highlight mutations, access-grant writes).
 *
 * <h3>READ-ONLY FOOTER</h3>
 * Every outbound email must include the footer defined in
 * {@link #READ_ONLY_FOOTER} which states that the inbox should not be replied to.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    /**
     * Mandatory footer appended to every outbound email.
     * Satisfies the strict "read-only disclaimer" requirement.
     */
    static final String READ_ONLY_FOOTER =
            "\n\n──────────────────────────────────────────────\n"
            + "This is a read-only email. Please do not reply.\n"
            + "Manage your notification preferences in Cortex → Settings → Notifications.\n"
            + "© Cortex";

    private static final DateTimeFormatter HUMAN_FMT =
            DateTimeFormatter.ofPattern("MMM d, yyyy 'at' HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    @Value("${cortex.app.url:http://localhost:3000}")
    private String appBaseUrl;

    @Value("${cortex.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${spring.mail.username:noreply@cortex.com}")
    private String fromAddress;

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * Send a notification email when someone comments on a highlight.
     * Async: doesn't block the API request.
     */
    @Async
    public void sendCommentNotification(
            String recipientEmail,
            String commenterName,
            String highlightId,
            String highlightText,
            String commentText
    ) {
        try {
            if (!mailEnabled) {
                log.info("[Email] Mock: Comment notification (mail disabled)");
                return;
            }

            String deepLink = appBaseUrl + "/highlights/" + highlightId;
            String subject = commenterName + " commented on your highlight";
            String body = buildCommentNotificationBody(
                    commenterName,
                    highlightText,
                    commentText,
                    deepLink
            );

            // TODO: Integrate with SendGrid / AWS SES / Gmail API
            log.info("[Email] Sending comment notification to: {}", recipientEmail);
            sendEmail(recipientEmail, subject, body);
            
        } catch (Exception e) {
            log.error("[Email] Failed to send comment notification", e);
            // Don't throw; email failures are non-critical
        }
    }

    /**
     * Send email when a highlight is shared with a user.
     */
    @Async
    public void sendHighlightSharedNotification(
            String recipientEmail,
            String senderName,
            String highlightId,
            String highlightText
    ) {
        try {
            if (!mailEnabled) {
                log.info("[Email] Mock: Highlight shared notification (mail disabled)");
                return;
            }

            String deepLink = appBaseUrl + "/highlights/" + highlightId;
            String subject = senderName + " shared a highlight with you";
            String body = buildHighlightSharedBody(senderName, highlightText, deepLink);

            log.info("[Email] Sending highlight shared notification to: {}", recipientEmail);
            sendEmail(recipientEmail, subject, body);
            
        } catch (Exception e) {
            log.error("[Email] Failed to send highlight shared notification", e);
        }
    }

    /**
     * Send verification email (stub for future implementation).
     */
    @Async
    public void sendVerificationEmail(String email, String verificationLink) {
        try {
            if (!mailEnabled) {
                log.info("[Email] Mock: Verification email (mail disabled)");
                return;
            }

            log.info("[Email] Sending verification email to: {}", email);
            sendEmail(email, "Verify your Cortex account", "Please click the following link to verify your account: " + verificationLink);
            
        } catch (Exception e) {
            log.error("[Email] Failed to send verification email", e);
        }
    }

    /**
     * Send an email to the folder OWNER when an EDITOR soft-deletes their shared folder.
     * Async: must not block the delete request.
     *
     * @param ownerEmail   the folder owner's email address
     * @param editorName   display name of the editor who deleted the folder
     * @param folderName   name of the deleted folder
     * @param folderId     ID of the deleted folder (used to build a restore deep-link)
     */
    @Async
    public void sendEditorDeletedFolderEmail(
            String ownerEmail,
            String editorName,
            String folderName,
            String folderId
    ) {
        try {
            if (!mailEnabled) {
                log.info("[Email] Mock: Editor-deleted folder notification (mail disabled). folder={}, editor={}",
                        folderId, editorName);
                return;
            }

            String restoreLink = appBaseUrl + "/dashboard/trash?folderId=" + folderId;
            String subject = "Your shared folder \"" + folderName + "\" was deleted by " + editorName;
            String body = buildEditorDeletedFolderBody(editorName, folderName, restoreLink);

            log.info("[Email] Sending editor-deleted-folder notification to owner: {} (folder={})", ownerEmail, folderId);
            sendEmail(ownerEmail, subject, body);

        } catch (Exception e) {
            log.error("[Email] Failed to send editor-deleted-folder notification for folder={}", folderId, e);
            // Non-critical: swallow so the delete operation itself is not affected
        }
    }

    /**
     * Core helper method to send an email using JavaMailSender.
     */
    private void sendEmail(String to, String subject, String text) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            mailSender.send(message);
        } catch (Exception e) {
            log.error("[Email] Critical failure sending email to: {} subject: {}", obfuscate(to), subject, e);
            throw e; // rethrow so caller can catch and handle non-critically
        }
    }

    // ── Email Template Builders ──

    private String buildEditorDeletedFolderBody(
            String editorName,
            String folderName,
            String restoreLink
    ) {
        return String.format("""
            Hi!

            An editor on your shared folder has deleted it.

            Editor:  %s
            Folder:  "%s"

            This is a soft delete — your folder and its contents are safely preserved.
            You can restore the folder at any time from your trash:

               %s

            If you do not restore it, it will remain in your trash until you permanently delete it.

            —
            Cortex
            """, editorName, folderName, restoreLink);
    }

    private String buildCommentNotificationBody(
            String commenterName,
            String highlightText,
            String commentText,
            String deepLink
    ) {
        return String.format("""
            Hi!
            
            %s commented on your highlight:
            
            "%s"
            
            Comment: "%s"
            
            View the full discussion: %s
            
            —
            Cortex
            """, commenterName, highlightText, commentText, deepLink);
    }

    private String buildHighlightSharedBody(
            String senderName,
            String highlightText,
            String deepLink
    ) {
        return String.format("""
            Hi!
            
            %s shared a highlight with you:
            
            "%s"
            
            View it: %s
            """, senderName, highlightText, deepLink) + READ_ONLY_FOOTER;
    }

    // ─────────────────────────────── Phase 3: Notification Engine emails ─────

    /**
     * Send an immediate email when a user is granted access to a shared folder.
     *
     * <p><strong>Critical action</strong> — bypasses the 60-minute batch queue
     * and is dispatched as soon as {@link com.cortex.api.service.NotificationService#triggerFolderAccessGrantedEmail}
     * is called.
     *
     * @param recipientEmail  the new collaborator's email address
     * @param granterName     display name of the person who shared the folder
     * @param folderName      name of the folder they were given access to
     * @param folderId        folder ID used to build the dashboard deep-link
     */
    @Async
    public void sendFolderAccessGrantedEmail(
            String recipientEmail,
            String granterName,
            String folderName,
            String folderId
    ) {
        try {
            if (!mailEnabled) {
                log.info("[Email] Mock: Folder access granted (mail disabled). folder={} granterName={}",
                        folderId, granterName);
                return;
            }

            String deepLink = appBaseUrl + "/dashboard";
            String subject  = granterName + " shared \"" + folderName + "\" with you on Cortex";
            String body     = buildFolderAccessGrantedBody(granterName, folderName, deepLink);

            log.info("[Email] Sending folder-access-granted email to {} (folder={})",
                    obfuscate(recipientEmail), folderId);
            sendEmail(recipientEmail, subject, body);

        } catch (Exception e) {
            log.error("[Email] ⚠ SMTP failure — folder-access-granted to {} folder={}: {}",
                    obfuscate(recipientEmail), folderId, e.getMessage(), e);
            // Swallowed: email failure must NOT affect the access-grant transaction
        }
    }

    /**
     * Send the 60-minute collaboration digest email to a folder owner.
     *
     * <p>Called exclusively by {@link com.cortex.api.service.EmailBatchProcessor}.
     * Aggregates all high-volume editor actions into a single human-readable summary.
     *
     * @param ownerEmail      the folder owner's email
     * @param editorName      display name of the editor who performed the actions
     * @param folderName      name of the folder (captured at first-action time)
     * @param folderId        folder ID for the dashboard deep-link
     * @param actionCount     total number of actions in this 60-minute window
     * @param firstActionAt   when the first action occurred (window start)
     * @param lastActionAt    when the most recent action occurred (window end)
     */
    @Async
    public void sendActivityDigestEmail(
            String ownerEmail,
            String editorName,
            String folderName,
            String folderId,
            int actionCount,
            Instant firstActionAt,
            Instant lastActionAt
    ) {
        try {
            if (!mailEnabled) {
                log.info("[Email] Mock: Activity digest (mail disabled). folder={} editor={} actions={}",
                        folderId, editorName, actionCount);
                return;
            }

            String deepLink = appBaseUrl + "/dashboard/folders/" + folderId;
            String subject  = editorName + " made " + actionCount + " change"
                              + (actionCount == 1 ? "" : "s") + " in your folder \"" + folderName + "\"";
            String body     = buildActivityDigestBody(
                    editorName, folderName, actionCount, firstActionAt, lastActionAt, deepLink);

            log.info("[Email] Sending activity digest to {} — editor='{}' folder='{}' actions={}",
                    obfuscate(ownerEmail), editorName, folderName, actionCount);
            sendEmail(ownerEmail, subject, body);

        } catch (Exception e) {
            log.error("[Email] ⚠ SMTP failure — activity digest to {} folder={}: {}",
                    obfuscate(ownerEmail), folderId, e.getMessage(), e);
            // Swallowed: email failure must NOT prevent the batch row from being marked processed
        }
    }

    // ── Template Builders ────────────────────────────────────────────────────

    private String buildFolderAccessGrantedBody(
            String granterName,
            String folderName,
            String deepLink
    ) {
        return String.format("""
            Hi!

            %s has shared the folder "%s" with you on Cortex.

            You can now view and collaborate on its contents:

               %s

            If you did not expect this invitation, you can safely ignore this email.
            """, granterName, folderName, deepLink) + READ_ONLY_FOOTER;
    }

    private String buildActivityDigestBody(
            String editorName,
            String folderName,
            int actionCount,
            Instant firstActionAt,
            Instant lastActionAt,
            String deepLink
    ) {
        return String.format("""
            Hi!

            %s made %d change%s in your shared folder "%s".

            Activity window:
              From: %s
              To:   %s

            Open the folder to review the changes:

               %s
            """,
            editorName,
            actionCount, actionCount == 1 ? "" : "s",
            folderName,
            HUMAN_FMT.format(firstActionAt),
            HUMAN_FMT.format(lastActionAt),
            deepLink
        ) + READ_ONLY_FOOTER;
    }

    /**
     * Send an email reminder to a user that their subscription will renew in 2 days.
     *
     * @param toEmail          the user's email address
     * @param amountDue        the amount due in cents
     * @param currency         the currency (e.g. usd)
     * @param renewalDate      the expected date of renewal
     */
    @Async
    public void sendSubscriptionRenewalReminder(String toEmail, long amountDue, String currency, Instant renewalDate) {
        try {
            if (!mailEnabled) {
                log.info("[Email] Mock: Subscription renewal reminder (mail disabled). user={}", toEmail);
                return;
            }

            String formattedAmount = String.format("%.2f", amountDue / 100.0);
            String subject = "Upcoming Cortex Subscription Renewal";
            String body = String.format("Hi!\n\nThis is a reminder that your Cortex subscription will automatically renew on %s.\n\nAmount: %s %s\n\nIf you have any questions, please contact support.%s",
                    HUMAN_FMT.format(renewalDate), formattedAmount, currency.toUpperCase(), READ_ONLY_FOOTER);

            log.info("[Email] Sending subscription renewal reminder to {}", obfuscate(toEmail));
            sendEmail(toEmail, subject, body);
        } catch (Exception e) {
            log.error("[Email] Failed to send subscription renewal reminder to {}", obfuscate(toEmail), e);
        }
    }

    /** GDPR-safe log helper: masks everything before '@'. */
    private static String obfuscate(String email) {
        if (email == null || !email.contains("@")) return "***";
        int at = email.indexOf('@');
        if (at <= 1) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }
}

