package com.cortex.api.service;

import com.cortex.api.entity.Comment;
import com.cortex.api.entity.AccessLevel;
import com.cortex.api.entity.Folder;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.Notification;
import com.cortex.api.entity.User;
import com.cortex.api.entity.ResourcePermission;
import com.cortex.api.entity.PermissionStatus;
import com.cortex.api.entity.SharedLink;
import com.cortex.api.entity.BatchedEmailEvent;
import com.cortex.api.repository.BatchedEmailEventRepository;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.NotificationRepository;
import com.cortex.api.repository.ResourcePermissionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Dual-layer notification engine.
 *
 * <h3>Layer 1 — Instant in-app notifications</h3>
 * <p>Every collaboration action (folder shared, folder deleted by editor, etc.) is
 * persisted as a {@link Notification} and simultaneously pushed to the recipient's
 * browser over STOMP WebSocket so the notification badge updates in real time.
 *
 * <h3>Layer 2 — Smart email engine</h3>
 * <p>Notifications are separated into two email tiers:
 * <ul>
 *   <li><strong>Critical / immediate</strong>: e.g., folder access grant.
 *       {@link #triggerFolderAccessGrantedEmail} calls {@link EmailService}
 *       synchronously (which itself is {@code @Async}), bypassing the batch queue.</li>
 *   <li><strong>High-volume / batched</strong>: e.g., editor makes 15 highlight changes.
 *       {@link #logBatchedAction} upserts a {@link BatchedEmailEvent} row.
 *       A {@link EmailBatchProcessor} cron sweeps every 5 minutes and sends one
 *       digest per (owner, editor, folder) triple once the 60-minute window expires.</li>
 * </ul>
 *
 * <h3>Failure isolation</h3>
 * <p>Email calls are {@code @Async} and wrapped in {@code try/catch} inside
 * {@link EmailService}. They never propagate exceptions into the caller's
 * transaction, so a slow or down SMTP server cannot roll back a user's save.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    /** Match {@link com.cortex.api.service.EmailBatchProcessor#WINDOW_MINUTES}. */
    static final int BATCH_WINDOW_MINUTES = 60;

    private final NotificationRepository notifRepo;
    private final BatchedEmailEventRepository batchRepo;
    private final SimpMessagingTemplate messaging;
    private final EmailService emailService;
    private final ResourcePermissionRepository permissionRepo;
    private final FolderRepository folderRepo;

    public NotificationService(NotificationRepository notifRepo,
                                BatchedEmailEventRepository batchRepo,
                                SimpMessagingTemplate messaging,
                                EmailService emailService,
                                ResourcePermissionRepository permissionRepo,
                                FolderRepository folderRepo) {
        this.notifRepo    = notifRepo;
        this.batchRepo    = batchRepo;
        this.messaging    = messaging;
        this.emailService = emailService;
        this.permissionRepo = permissionRepo;
        this.folderRepo = folderRepo;
    }

    // ─────────────────────────────────────── Layer 1: instant in-app ─────────

    /**
     * Persist a structured in-app notification and push it to the recipient in real
     * time via STOMP WebSocket.
     *
     * <p>This is the preferred method for all new notification types; it stores
     * {@code actor_id}, {@code action_type}, and {@code target_entity_id} in
     * addition to the human-readable message.
     *
     * @param recipient      the user who will see the notification
     * @param actor          the user who performed the action (may be {@code null}
     *                       for system-generated notifications)
     * @param actionType     semantic action: CREATED | EDITED | DELETED | SHARED | COMMENTED
     * @param targetEntityId the folder/highlight ID being acted upon
     * @param message        human-readable description shown in the notification panel
     * @param actionUrl      deep-link the user can click to navigate to the relevant resource
     * @return the persisted {@link Notification}
     */
    public Notification createInstantNotification(User recipient, User actor,
                                                   String actionType, Long targetEntityId,
                                                   String message, String actionUrl) {
        Notification n = new Notification();
        n.setUser(recipient);
        n.setMessage(message);
        n.setActionUrl(actionUrl);
        n.setType("FOLDER_ACTIVITY");
        n.setActionType(actionType);
        n.setTargetEntityId(targetEntityId);
        if (actor != null) n.setActorId(actor.getId());
        n = notifRepo.save(n);
        broadcast(recipient, n);
        log.info("[Notification Engine] Instant notification saved id={} → recipient={} actionType={}",
                n.getId(), recipient.getId(), actionType);
        return n;
    }

    /**
     * Legacy general-purpose emit (kept for backward compatibility with
     * existing call sites that don't have a typed actor/action).
     */
    public Notification emit(User recipient, String message, String actionUrl) {
        Notification n = new Notification();
        n.setUser(recipient);
        n.setMessage(message);
        n.setActionUrl(actionUrl);
        n.setType("GENERAL");
        n = notifRepo.save(n);
        broadcast(recipient, n);
        return n;
    }

    /**
     * Send a non-actor, non-resource specific notification from the "Cortex System".
     */
    public Notification sendSystemNotification(User recipient, String title, String message, String subType) {
        Notification n = new Notification();
        n.setUser(recipient);
        n.setMessage(message);
        n.setActionUrl("/dashboard/trash"); // Default for system alerts like retention
        n.setType("SYSTEM");
        n.setActionType("ALERT");
        n.setMetadata("{\"title\":\"" + escapeJson(title) + "\",\"subType\":\"" + escapeJson(subType) + "\"}");
        n = notifRepo.save(n);
        broadcast(recipient, n);
        log.info("[Notification Engine] System notification sent to user={} : {}", recipient.getId(), title);
        return n;
    }

    /**
     * Persist a SHARE_INVITE notification with structured metadata, then push
     * it in real time. Used when a user is granted access to a folder or highlight.
     */
    public Notification emitShareInvite(User recipient, String senderName, String senderEmail,
                                         String resourceTitle, Long resourceId,
                                         String resourceType, Long permissionId) {
        Notification n = new Notification();
        n.setUser(recipient);
        n.setMessage(senderName + " shared \"" + resourceTitle + "\" with you");
        
        // Correctly point to the resource, not just the generic dashboard
        String actionUrl = resourceType.equalsIgnoreCase("FOLDER") 
                ? "/dashboard/folders/" + resourceId 
                : "/dashboard/read/" + resourceId;
        n.setActionUrl(actionUrl);
        
        n.setType("SHARE_INVITE");
        n.setActionType("SHARED");
        n.setTargetEntityId(resourceId);
        n.setMetadata("{\"permissionId\":\"" + permissionId + "\""
                + ",\"resourceId\":\"" + resourceId + "\""
                + ",\"resourceType\":\"" + resourceType + "\""
                + ",\"resourceTitle\":\"" + escapeJson(resourceTitle) + "\""
                + ",\"senderName\":\"" + escapeJson(senderName) + "\""
                + ",\"senderEmail\":\"" + escapeJson(senderEmail) + "\"}");
        n = notifRepo.save(n);
        broadcast(recipient, n);
        return n;
    }

    /**
     * Persist an ACCESS_REQUEST notification with structured metadata.
     */
    public Notification emitAccessRequestNotification(User owner, User requester, Folder folder, 
                                                        AccessLevel requestedRole, Long requestId) {
        Notification n = new Notification();
        n.setUser(owner);
        String requesterName = resolveDisplayName(requester);
        n.setMessage(requesterName + " requested " + requestedRole + " access to \"" + folder.getName() + "\"");
        n.setActionUrl("/dashboard/folders/" + folder.getId());
        n.setType("ACCESS_REQUEST");
        n.setActionType("REQUESTED");
        n.setTargetEntityId(folder.getId());
        n.setActorId(requester.getId());
        n.setMetadata("{\"requestId\":\"" + requestId + "\""
                + ",\"folderId\":\"" + folder.getId() + "\""
                + ",\"folderName\":\"" + escapeJson(folder.getName()) + "\""
                + ",\"requestedRole\":\"" + requestedRole + "\""
                + ",\"requesterName\":\"" + escapeJson(requesterName) + "\"}");
        n = notifRepo.save(n);
        broadcast(owner, n);
        return n;
    }

    /**
     * Persist an ACCESS_REQUEST_RESOLVED notification.
     */
    public Notification emitAccessRequestResolvedNotification(User requester, User owner, Folder folder, 
                                                               String status, AccessLevel role) {
        Notification n = new Notification();
        n.setUser(requester);
        String ownerName = resolveDisplayName(owner);
        String statusText = status.equalsIgnoreCase("APPROVED") ? "approved" : "declined";
        n.setMessage(ownerName + " " + statusText + " your request for " + role + " access to \"" + folder.getName() + "\"");
        n.setActionUrl("/dashboard/folders/" + folder.getId());
        n.setType("ACCESS_REQUEST_RESOLVED");
        n.setActionType(status.toUpperCase());
        n.setTargetEntityId(folder.getId());
        n.setActorId(owner.getId());
        n = notifRepo.save(n);
        broadcast(requester, n);
        return n;
    }

    /**
     * Persist an ACCESS_REVOKED notification and push it in real time.
     */
    public Notification emitAccessRevoked(User recipient, String actorName, String resourceTitle, Long resourceId, String resourceType) {
        Notification n = new Notification();
        n.setUser(recipient);
        n.setMessage(actorName + " removed your access to \"" + resourceTitle + "\"");
        n.setActionUrl("/dashboard");
        n.setType("ACCESS_REVOKED");
        n.setActionType("DELETED");
        n.setTargetEntityId(resourceId);
        n = notifRepo.save(n);
        broadcast(recipient, n);
        return n;
    }

    /**
     * Persist an ACCESS_UPDATED notification and push it in real time.
     */
    public Notification emitAccessUpdated(User recipient, String actorName, String resourceTitle, String newLevel, Long resourceId, String resourceType) {
        Notification n = new Notification();
        n.setUser(recipient);
        n.setMessage(actorName + " updated your access to \"" + resourceTitle + "\" to " + newLevel);
        
        String actionUrl = resourceType.equalsIgnoreCase("FOLDER")
                ? "/dashboard/folders/" + resourceId
                : "/dashboard/read/" + resourceId;
        n.setActionUrl(actionUrl);
        
        n.setType("ACCESS_UPDATED");
        n.setActionType("EDITED");
        n.setTargetEntityId(resourceId);
        n = notifRepo.save(n);
        broadcast(recipient, n);
        return n;
    }

    // ─────────────────────────────── Layer 2a: immediate email (critical) ────

    /**
     * For <strong>critical</strong> actions: immediately dispatch an email to the
     * recipient notifying them that they have been granted folder access.
     *
     * <p>This bypasses the 60-minute batch queue entirely. Called after
     * {@link #emitShareInvite} so the user gets both an instant in-app popup AND
     * an email within seconds.
     *
     * @param recipient   the user who was just granted access
     * @param granter     the user who granted the access
     * @param folderName  the folder's display name
     * @param folderId    the folder's ID (used to build the email deep-link)
     */
    public void triggerFolderAccessGrantedEmail(User recipient, User granter,
                                                 String folderName, Long folderId) {
        String recipientEmail = recipient.getEmail();
        String granterName    = resolveDisplayName(granter);
        log.info("[Notification Engine] Triggering immediate access-granted email → {} for folder={}",
                obfuscate(recipientEmail), String.valueOf(folderId));
        emailService.sendFolderAccessGrantedEmail(recipientEmail, granterName, folderName, String.valueOf(folderId));
    }

    /**
     * Trigger an email when a user's access to a folder is revoked.
     */
    public void triggerFolderAccessRevokedEmail(User recipient, User actor, String folderName) {
        String recipientEmail = recipient.getEmail();
        String actorName = resolveDisplayName(actor);
        log.info("[Notification Engine] Triggering access-revoked email → {} for folder={}", obfuscate(recipientEmail), folderName);
        emailService.sendFolderAccessRevokedEmail(recipientEmail, actorName, folderName);
    }

    /**
     * Trigger an email when a user's access level to a folder is updated.
     */
    public void triggerFolderAccessUpdatedEmail(User recipient, User actor, String folderName, String newLevel) {
        String recipientEmail = recipient.getEmail();
        String actorName = resolveDisplayName(actor);
        log.info("[Notification Engine] Triggering access-updated email → {} for folder={} newLevel={}", obfuscate(recipientEmail), folderName, newLevel);
        emailService.sendFolderAccessUpdatedEmail(recipientEmail, actorName, folderName, newLevel);
    }

    // ─────────────────────────── Layer 2b: batched email (high-volume) ───────

    /**
     * Log a high-volume collaboration action into the 60-minute digest window.
     *
     * <p>Uses an <em>upsert</em> pattern:
     * <ol>
     *   <li>Look for an existing non-processed {@link BatchedEmailEvent} for this
     *       {@code (owner, editor, folder)} triple whose
     *       {@code first_action_at >= now - 60 minutes}.</li>
     *   <li>If found: increment {@code action_count} and update {@code last_action_at}.</li>
     *   <li>If not found (no open window, or the existing window has expired):
     *       create a new row to start a fresh 60-minute window.</li>
     * </ol>
     *
     * <p>The {@link EmailBatchProcessor} cron picks up the row once the window expires.
     *
     * @param owner      the folder owner (email digest recipient)
     * @param editor     the collaborator who performed the action
     * @param folderId   the affected folder's ID
     * @param folderName the folder's current display name (captured at action time)
     */
    public void logBatchedAction(User owner, User editor, Long folderId, String folderName) {
        Instant windowStart = Instant.now().minus(BATCH_WINDOW_MINUTES, ChronoUnit.MINUTES);

        Optional<BatchedEmailEvent> existing =
                batchRepo.findActiveWindow(owner.getId(), editor.getId(), folderId, windowStart);

        if (existing.isPresent()) {
            BatchedEmailEvent event = existing.get();
            int newCount = event.getActionCount() + 1;
            event.setActionCount(newCount);
            event.setLastActionAt(Instant.now());
            batchRepo.save(event);
            log.info("[Notification Engine] Batch window id={} incremented to action_count={}",
                    event.getId(), newCount);
        } else {
            BatchedEmailEvent event = new BatchedEmailEvent();
            Instant now = Instant.now();
            event.setOwner(owner);
            event.setEditor(editor);
            event.setFolderId(folderId);
            event.setFolderName(folderName);
            event.setActionCount(1);
            event.setFirstActionAt(now);
            event.setLastActionAt(now);
            batchRepo.save(event);
            log.info("[Notification Engine] New batch window created for owner={} editor={} folder={}",
                    owner.getId(), editor.getId(), folderId);
        }
    }

    // ─────────────────────────────────────────────────── Private helpers ─────

    /**
     * Delete a notification from the DB and push a NOTIFICATION_DELETED WebSocket
     * event to all sessions for this user so every open tab removes it immediately.
     */
    public void emitHighlightModificationNotification(User owner, User actor, Folder folder, Highlight highlight, String action) {
        String actorName = resolveDisplayName(actor);
        Notification n = new Notification();
        n.setUser(owner);
        n.setMessage(actorName + " " + action + " a highlight in folder \"" + folder.getName() + "\"");
        n.setActionUrl("/dashboard/read/" + highlight.getId());
        n.setType("FOLDER_ACTIVITY");
        n.setActionType("HIGHLIGHT_MODIFIED");
        n.setTargetEntityId(folder.getId());
        n.setActorId(actor.getId());
        n.setMetadata("{\"highlightId\":\"" + highlight.getId() + "\""
                + ",\"folderId\":\"" + folder.getId() + "\""
                + ",\"folderName\":\"" + escapeJson(folder.getName()) + "\""
                + ",\"action\":\"" + escapeJson(action) + "\""
                + ",\"actorName\":\"" + escapeJson(actorName) + "\"}");
        n = notifRepo.save(n);
        broadcast(owner, n);
    }

    public void emitCommentActivityNotification(User owner, User actor, Folder folder, Highlight highlight, String action) {
        String actorName = resolveDisplayName(actor);
        Notification n = new Notification();
        n.setUser(owner);
        n.setMessage(actorName + " " + action + " a comment on your highlight in \"" + folder.getName() + "\"");
        n.setActionUrl("/dashboard/read/" + highlight.getId());
        n.setType("FOLDER_ACTIVITY");
        n.setActionType("COMMENT_MODIFIED");
        n.setTargetEntityId(folder.getId());
        n.setActorId(actor.getId());
        n.setMetadata("{\"highlightId\":\"" + highlight.getId() + "\""
                + ",\"folderId\":\"" + folder.getId() + "\""
                + ",\"folderName\":\"" + escapeJson(folder.getName()) + "\""
                + ",\"action\":\"" + escapeJson(action) + "\""
                + ",\"actorName\":\"" + escapeJson(actorName) + "\"}");
        n = notifRepo.save(n);
        broadcast(owner, n);
    }

    public void emitCommentReactionNotification(User actor, Comment comment, String emoji) {
        User owner = comment.getAuthor();
        if (owner.getId().equals(actor.getId())) return; // Don't notify self

        String actorName = resolveDisplayName(actor);
        Notification n = new Notification();
        n.setUser(owner);
        n.setMessage(actorName + " reacted to your comment: " + emoji);
        n.setActionUrl("/dashboard/read/" + comment.getHighlight().getId());
        n.setType("COMMENT_REACTION");
        n.setActionType("REACTION_ADDED");
        n.setTargetEntityId(comment.getId());
        n.setActorId(actor.getId());
        n.setMetadata("{\"commentId\":\"" + comment.getId() + "\""
                + ",\"highlightId\":\"" + comment.getHighlight().getId() + "\""
                + ",\"emoji\":\"" + emoji + "\""
                + ",\"actorName\":\"" + escapeJson(actorName) + "\"}");
        n = notifRepo.save(n);
        broadcast(owner, n);
    }

    public void emitFolderActivityNotification(User owner, User actor, Folder folder, String action) {
        String actorName = resolveDisplayName(actor);
        Notification n = new Notification();
        n.setUser(owner);
        n.setMessage(actorName + " " + action + " the folder \"" + folder.getName() + "\"");
        n.setActionUrl("/dashboard/folders/" + folder.getId());
        n.setType("FOLDER_ACTIVITY");
        n.setActionType("FOLDER_MODIFIED");
        n.setTargetEntityId(folder.getId());
        n.setActorId(actor.getId());
        n.setMetadata("{\"folderId\":\"" + folder.getId() + "\""
                + ",\"folderName\":\"" + escapeJson(folder.getName()) + "\""
                + ",\"action\":\"" + escapeJson(action) + "\""
                + ",\"actorName\":\"" + escapeJson(actorName) + "\"}");
        n = notifRepo.save(n);
        broadcast(owner, n);
    }

    /**
     * Broadcast activity to all members of a shared folder except the actor.
     */
    public void notifyAllFolderMembers(User actor, Folder folder, Highlight highlight, String action, String detail, String actionType) {
        if (folder == null) return;
        
        Set<User> members = getFolderMembersHierarchical(folder);
        // Exclude the actor from the list
        members.removeIf(u -> u.getId().equals(actor.getId()));
        
        if (members.isEmpty()) {
            log.debug("[Notification Engine] No shared members to notify for action {} on folder {}", action, folder.getId());
            return;
        }

        String actorName = resolveDisplayName(actor);
        String highlightTitle = highlight != null ? highlight.getText().substring(0, Math.min(highlight.getText().length(), 40)) + "..." : null;
        String actionUrl = highlight != null ? "/dashboard/read/" + highlight.getId() : "/dashboard/folders/" + folder.getId();

        for (User recipient : members) {
            if (recipient == null) continue;

            // 1. Create In-App Notification
            Notification n = new Notification();
            n.setUser(recipient);
            if (actor != null) n.setActorId(actor.getId());
            if (folder != null) n.setTargetEntityId(folder.getId());
            n.setType("FOLDER_ACTIVITY");
            n.setActionType(actionType);
            n.setActionUrl(actionUrl);
            
            String msgText = actorName + " " + action + " in \"" + folder.getName() + "\"";
            if (highlight != null) {
                msgText = actorName + " " + action + " on a highlight in \"" + folder.getName() + "\"";
            }
            n.setMessage(msgText);
            
            if (actor != null && folder.getId() != null && folder.getName() != null) {
                logBatchedAction(recipient, actor, folder.getId(), folder.getName());
            }
            
            n.setMetadata("{\"folderId\":\"" + folder.getId() + "\""
                + ",\"folderName\":\"" + escapeJson(folder.getName()) + "\""
                + ",\"action\":\"" + escapeJson(action) + "\""
                + ",\"actorName\":\"" + escapeJson(actorName) + "\""
                + (highlightTitle != null ? ",\"highlightTitle\":\"" + escapeJson(highlightTitle) + "\"" : "")
                + "}");
            
            notifRepo.save(n);
            broadcast(recipient, n);

            // 2. Dispatch Email (Only for low-volume/critical actions)
            // High-volume actions (HIGHLIGHT_MODIFIED, etc.) are already logged for the digest via logBatchedAction()
            if (!isHighVolumeAction(actionType)) {
                emailService.sendCollaborationActivityEmail(
                    recipient.getEmail(), 
                    actorName, 
                    folder.getName(), 
                    action, 
                    detail, 
                    actionUrl
                );
            }
        }
        
        log.info("[Notification Engine] Notified {} members for action {} in folder {}", members.size(), action, folder.getId());
    }

    /**
     * Broadcast a real-time activity event for a specific resource.
     * Unlike notifications, these are transient and used to update the UI
     * for users currently viewing the resource.
     */
    public void broadcastResourceActivity(String resourceType, Long resourceId, String eventType, Object data) {
        String topic = "/topic/resource-updates/" + resourceType.toLowerCase() + "/" + resourceId;
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", eventType);
        payload.put("data", data);
        payload.put("timestamp", Instant.now().toString());

        messaging.convertAndSend(topic, payload);
        log.debug("[Notification Engine] Broadcasted {} activity to topic={}", eventType, topic);
    }

    /**
     * Collects all users who have access to a folder (Owner + Shared Collaborators).
     * Includes hierarchical permissions by traversing parents.
     */
    private Set<User> getFolderMembersHierarchical(Folder folder) {
        Set<User> members = new HashSet<>();
        Folder current = folder;
        int depth = 0;
        
        while (current != null && depth < 50) {
            // Add owner of this level
            members.add(current.getUser());
            
            // Add all explicit collaborators at this level
            List<ResourcePermission> permissions = permissionRepo.findByResourceIdAndResourceType(
                current.getId(), SharedLink.ResourceType.FOLDER
            );
            
            for (ResourcePermission p : permissions) {
                if (p.getStatus() == PermissionStatus.ACCEPTED) {
                    members.add(p.getUser());
                }
            }
            
            // Move up — if a folder is shared, its children share the same members
            Folder parent = current.getParentFolder();
            if (parent != null && parent.getId() != null) {
                Long parentId = parent.getId();
                current = folderRepo.findById(java.util.Objects.requireNonNull(parentId, "parentId cannot be null")).orElse(null);
            } else {
                current = null;
            }
            depth++;
        }
        
        return members;
    }

    public void deleteAndBroadcastDeletion(Notification n, User recipient) {
        Long notifId = n.getId();
        notifRepo.delete(n);
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "NOTIFICATION_DELETED");
        payload.put("id", notifId.toString());
        messaging.convertAndSendToUser(
                String.valueOf(recipient.getId()),
                "/queue/notifications",
                payload
        );
        log.info("[Notification Engine] Deleted notification id={} user={}", notifId, recipient.getId());
    }

    /**
     * Broadcast an update for an existing notification (e.g. when responded).
     */
    public void broadcastUpdate(User recipient, Notification n) {
        broadcast(recipient, n);
    }

    private void broadcast(User recipient, Notification n) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id",            n.getId().toString());
        payload.put("message",       n.getMessage());
        payload.put("isRead",        n.isRead());
        payload.put("actionUrl",     n.getActionUrl()     != null ? n.getActionUrl()     : "");
        payload.put("type",          n.getType()          != null ? n.getType()          : "GENERAL");
        payload.put("actionType",    n.getActionType()    != null ? n.getActionType()    : "");
        payload.put("targetEntityId",n.getTargetEntityId()!= null ? n.getTargetEntityId() : "");
        payload.put("metadata",      n.getMetadata()      != null ? n.getMetadata()      : "");
        payload.put("responded",     n.getResponded()     != null ? n.getResponded()     : "");
        payload.put("createdAt",     n.getCreatedAt().toString());

        messaging.convertAndSendToUser(
                String.valueOf(recipient.getId()),
                "/queue/notifications",
                payload
        );
    }

    static String resolveDisplayName(User user) {
        if (user.getFullName() != null && !user.getFullName().isBlank()) return user.getFullName();
        return user.getEmail();
    }

    static String obfuscate(String email) {
        if (email == null || !email.contains("@")) return "***";
        int at = email.indexOf('@');
        if (at <= 1) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private boolean isHighVolumeAction(String actionType) {
        if (actionType == null) return false;
        return actionType.equals("HIGHLIGHT_MODIFIED") || 
               actionType.equals("COMMENT_MODIFIED") || 
               actionType.equals("TAG_MODIFIED");
    }
}



