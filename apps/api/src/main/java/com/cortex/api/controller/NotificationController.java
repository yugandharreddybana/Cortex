package com.cortex.api.controller;

import com.cortex.api.entity.Notification;
import com.cortex.api.entity.PermissionStatus;
import com.cortex.api.entity.User;
import com.cortex.api.repository.NotificationRepository;
import com.cortex.api.repository.ResourcePermissionRepository;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final NotificationRepository notificationRepo;
    private final ResourcePermissionRepository permissionRepo;
    private final NotificationService notificationService;
    private final UserRepository userRepo;
    private final FolderRepository folderRepo;
    private final HighlightRepository highlightRepo;

    public NotificationController(NotificationRepository notificationRepo,
                                   ResourcePermissionRepository permissionRepo,
                                   NotificationService notificationService,
                                   UserRepository userRepo,
                                   FolderRepository folderRepo,
                                   HighlightRepository highlightRepo) {
        this.notificationRepo = notificationRepo;
        this.permissionRepo = permissionRepo;
        this.notificationService = notificationService;
        this.userRepo = userRepo;
        this.folderRepo = folderRepo;
        this.highlightRepo = highlightRepo;
    }

    /** GET /api/v1/notifications — all notifications for the user */
    @GetMapping
    public List<Map<String, Object>> list(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        return notificationRepo.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toMap).toList();
    }

    /** GET /api/v1/notifications/unread-count */
    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        long count = notificationRepo.countByUserIdAndIsReadFalse(userId);
        return Map.of("count", count);
    }

    /** PUT /api/v1/notifications/{id}/read — mark a notification as read */
    @PutMapping("/{id}/read")
    public ResponseEntity<Map<String, Boolean>> markRead(Authentication auth,
                                                          @PathVariable Long id) {
        Long userId = Long.parseLong(auth.getName());
        Notification n = notificationRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (!n.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        n.setRead(true);
        notificationRepo.save(n);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** PUT /api/v1/notifications/read-all — mark all as read */
    @PutMapping("/read-all")
    public ResponseEntity<Map<String, Boolean>> markAllRead(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        List<Notification> unread = notificationRepo.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().filter(n -> !n.isRead()).toList();
        unread.forEach(n -> n.setRead(true));
        notificationRepo.saveAll(unread);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /**
     * PUT /api/v1/notifications/{id}/respond?action=accept|decline
     * For SHARE_INVITE notifications: accept keeps the permission, decline removes it.
     */
    @PutMapping("/{id}/respond")
    @jakarta.transaction.Transactional
    public ResponseEntity<Map<String, Object>> respond(Authentication auth,
                                                        @PathVariable Long id,
                                                        @RequestParam String action) {
        Long userId = Long.parseLong(auth.getName());
        Notification n = notificationRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (!n.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (!"SHARE_INVITE".equals(n.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not a share invite notification");
        }
        if (n.getResponded() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already responded");
        }
        if (!"accept".equalsIgnoreCase(action) && !"decline".equalsIgnoreCase(action)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "action must be accept or decline");
        }

        // Extract permissionId from metadata JSON
        String permissionId = extractJsonField(n.getMetadata(), "permissionId");

        if (permissionId != null) {
            try {
                permissionRepo.findById(Long.parseLong(permissionId)).ifPresent(perm -> {
                    if ("accept".equalsIgnoreCase(action)) {
                        perm.setStatus(PermissionStatus.ACCEPTED);
                        permissionRepo.save(perm);

                        // Notify the granter that the invite was accepted
                        String senderEmail = extractJsonField(n.getMetadata(), "senderEmail");
                        if (senderEmail != null) {
                            userRepo.findByEmail(senderEmail).ifPresent(granter -> {
                                User invitee = perm.getUser();
                                String inviteeName = (invitee.getFullName() != null && !invitee.getFullName().isBlank())
                                    ? invitee.getFullName() : invitee.getEmail();

                                String resourceTitle = extractJsonField(n.getMetadata(), "resourceTitle");
                                if (resourceTitle == null) resourceTitle = "a resource";

                                notificationService.createInstantNotification(
                                    granter,
                                    invitee,
                                    "ACCEPTED",
                                    perm.getResourceId(),
                                    inviteeName + " accepted your invite to " + resourceTitle,
                                    "/dashboard"
                                );
                            });
                        }
                    } else {
                        perm.setStatus(PermissionStatus.DECLINED);
                        permissionRepo.save(perm);
                    }
                });
            } catch (Exception ignored) { /* permission already removed */ }
        }

        n.setResponded(action.toLowerCase());
        n.setRead(true);
        notificationRepo.save(n);

        return ResponseEntity.ok(toMap(n));
    }

    private Map<String, Object> toMap(Notification n) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", n.getId().toString());
        m.put("message", n.getMessage());
        m.put("isRead", n.isRead());
        m.put("actionUrl", n.getActionUrl() != null ? n.getActionUrl() : "");
        m.put("type", n.getType() != null ? n.getType() : "GENERAL");
        m.put("metadata", n.getMetadata() != null ? n.getMetadata() : "");
        m.put("responded", n.getResponded() != null ? n.getResponded() : "");
        m.put("createdAt", n.getCreatedAt().toString());
        return m;
    }

    /** Extract a field from a JSON string securely using Jackson. */
    private static String extractJsonField(String json, String field) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode node = OBJECT_MAPPER.readTree(json);
            if (node.has(field) && !node.get(field).isNull()) {
                return node.get(field).asText();
            }
        } catch (Exception e) {
            // Ignore parsing errors, return null
        }
        return null;
    }
}
