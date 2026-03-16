package com.cortex.api.controller;

import com.cortex.api.entity.AccessLevel;
import com.cortex.api.entity.LinkAccess;
import com.cortex.api.entity.PermissionStatus;
import com.cortex.api.entity.ResourcePermission;
import com.cortex.api.entity.SharedLink;
import com.cortex.api.entity.User;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.ResourcePermissionRepository;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.service.NotificationService;
import com.cortex.api.service.SecurityService;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/permissions")
public class PermissionController {

    private final ResourcePermissionRepository permissionRepo;
    private final UserRepository userRepo;
    private final HighlightRepository highlightRepo;
    private final FolderRepository folderRepo;
    private final SecurityService securityService;
    private final NotificationService notificationService;

    public PermissionController(ResourcePermissionRepository permissionRepo,
                                 UserRepository userRepo,
                                 HighlightRepository highlightRepo,
                                 FolderRepository folderRepo,
                                 SecurityService securityService,
                                 NotificationService notificationService) {
        this.permissionRepo = permissionRepo;
        this.userRepo = userRepo;
        this.highlightRepo = highlightRepo;
        this.folderRepo = folderRepo;
        this.securityService = securityService;
        this.notificationService = notificationService;
    }

    /** GET /api/v1/permissions/{resourceId}?type=HIGHLIGHT|FOLDER — list all permissions */
    @GetMapping("/{resourceId}")
    @Transactional
    public List<PermissionDTO> list(Authentication auth,
                                    @PathVariable Long resourceId,
                                    @RequestParam String type) {
        if (type == null || type.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "type is required");
        }
        SharedLink.ResourceType resourceType;
        try {
            resourceType = SharedLink.ResourceType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid resource type: " + type);
        }
        requireOwner(auth, resourceId, resourceType);

        return permissionRepo.findByResourceIdAndResourceType(resourceId, resourceType)
                .stream().map(this::toDTO).toList();
    }

    /** POST /api/v1/permissions — grant access to a user (invite) */
    @PostMapping
    @Transactional
    public ResponseEntity<PermissionDTO> grant(Authentication auth,
                                                @RequestBody GrantRequest req) {
        if (req.resourceType == null || req.resourceType.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resourceType is required");
        }
        if (req.accessLevel == null || req.accessLevel.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "accessLevel is required");
        }
        SharedLink.ResourceType resourceType;
        try {
            resourceType = SharedLink.ResourceType.valueOf(req.resourceType.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid resource type: " + req.resourceType);
        }
        requireOwner(auth, req.resourceId, resourceType);

        User invitee = userRepo.findByEmail(req.email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Don't allow granting OWNER
        AccessLevel level;
        try {
            level = AccessLevel.valueOf(req.accessLevel.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid access level: " + req.accessLevel);
        }
        if (level == AccessLevel.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot grant OWNER access");
        }

        // Upsert: update if exists, create if not
        ResourcePermission perm = permissionRepo
                .findByUserIdAndResourceIdAndResourceType(invitee.getId(), req.resourceId, resourceType)
                .orElseGet(() -> {
                    ResourcePermission p = new ResourcePermission();
                    p.setUser(invitee);
                    p.setResourceId(req.resourceId);
                    p.setResourceType(resourceType);
                    return p;
                });

        perm.setAccessLevel(level);
        perm = permissionRepo.save(perm);

        // Emit real-time share invite notification to the invitee
        User granter = userRepo.findById(Long.parseLong(auth.getName())).orElse(null);
        String granterEmail = granter != null ? granter.getEmail() : "Someone";
        String granterName = (granter != null && granter.getFullName() != null && !granter.getFullName().isBlank())
                ? granter.getFullName() : granterEmail;
        String resourceTitle;
        if (resourceType == SharedLink.ResourceType.HIGHLIGHT) {
            resourceTitle = highlightRepo.findById(req.resourceId)
                    .map(h -> h.getSource() != null ? h.getSource() : "a highlight").orElse("a highlight");
        } else {
            resourceTitle = folderRepo.findById(req.resourceId)
                    .map(f -> f.getName() != null ? f.getName() : "a folder").orElse("a folder");
        }
        notificationService.emitShareInvite(
                invitee,
                granterName,
                granterEmail,
                resourceTitle,
                req.resourceId,
                resourceType.name(),
                perm.getId()
        );

        // Critical-path email: bypasses the 60-minute batch queue
        if (resourceType == SharedLink.ResourceType.FOLDER) {
            notificationService.triggerFolderAccessGrantedEmail(
                    invitee, granter, resourceTitle, req.resourceId);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(toDTO(perm));
    }

    /** PUT /api/v1/permissions/{permissionId} — update access level */
    @PutMapping("/{permissionId}")
    @Transactional
    public PermissionDTO update(Authentication auth,
                                @PathVariable Long permissionId,
                                @RequestBody UpdateRequest req) {
        if (req.accessLevel == null || req.accessLevel.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "accessLevel is required");
        }
        ResourcePermission perm = permissionRepo.findById(permissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        requireOwner(auth, perm.getResourceId(), perm.getResourceType());

        AccessLevel level;
        try {
            level = AccessLevel.valueOf(req.accessLevel.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid access level: " + req.accessLevel);
        }
        if (level == AccessLevel.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot grant OWNER access");
        }
        perm.setAccessLevel(level);
        permissionRepo.save(perm);
        return toDTO(perm);
    }

    /** DELETE /api/v1/permissions/{permissionId} — revoke access */
    @DeleteMapping("/{permissionId}")
    @Transactional
    public ResponseEntity<Map<String, Boolean>> revoke(Authentication auth,
                                                        @PathVariable Long permissionId) {
        ResourcePermission perm = permissionRepo.findById(permissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        requireOwner(auth, perm.getResourceId(), perm.getResourceType());

        permissionRepo.delete(perm);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** PUT /api/v1/permissions/link-access — update link-level access settings */
    @PutMapping("/link-access")
    @Transactional
    public ResponseEntity<Map<String, String>> updateLinkAccess(Authentication auth,
                                                                 @RequestBody LinkAccessRequest req) {
        if (req.resourceType == null || req.resourceType.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resourceType is required");
        }
        if (req.linkAccess == null || req.linkAccess.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "linkAccess is required");
        }
        if (req.defaultLinkRole == null || req.defaultLinkRole.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "defaultLinkRole is required");
        }
        SharedLink.ResourceType type;
        try {
            type = SharedLink.ResourceType.valueOf(req.resourceType.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid resource type: " + req.resourceType);
        }
        Long userId = Long.parseLong(auth.getName());
        LinkAccess linkAccess;
        try {
            linkAccess = LinkAccess.valueOf(req.linkAccess.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid link access: " + req.linkAccess);
        }
        AccessLevel defaultRole;
        try {
            defaultRole = AccessLevel.valueOf(req.defaultLinkRole.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid default role: " + req.defaultLinkRole);
        }

        if (type == SharedLink.ResourceType.HIGHLIGHT) {
            var h = highlightRepo.findByIdAndUserId(req.resourceId, userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN));
            h.setLinkAccess(linkAccess);
            h.setDefaultLinkRole(defaultRole);
            highlightRepo.save(h);
        } else {
            var f = folderRepo.findByIdAndUserId(req.resourceId, userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN));
            f.setLinkAccess(linkAccess);
            f.setDefaultLinkRole(defaultRole);
            folderRepo.save(f);
        }

        return ResponseEntity.ok(Map.of("linkAccess", linkAccess.name(), "defaultLinkRole", defaultRole.name()));
    }

    /** GET /api/v1/permissions/access-level?resourceId=x&type=HIGHLIGHT|FOLDER */
    @GetMapping("/access-level")
    public Map<String, Object> getAccessLevel(Authentication auth,
                                               @RequestParam Long resourceId,
                                               @RequestParam String type) {
        SharedLink.ResourceType resourceType = SharedLink.ResourceType.valueOf(type.toUpperCase());
        AccessLevel level = securityService.resolveAccessLevel(resourceId, resourceType);

        if (level == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No access");
        }

        // Also return link access settings if owner
        boolean isOwner = securityService.isOwner(resourceId, resourceType);
        String linkAccess = null;
        String defaultLinkRole = null;

        if (isOwner) {
            if (resourceType == SharedLink.ResourceType.HIGHLIGHT) {
                var h = highlightRepo.findById(resourceId).orElse(null);
                if (h != null) {
                    linkAccess = h.getLinkAccess().name();
                    defaultLinkRole = h.getDefaultLinkRole().name();
                }
            } else {
                var f = folderRepo.findById(resourceId).orElse(null);
                if (f != null) {
                    linkAccess = f.getLinkAccess().name();
                    defaultLinkRole = f.getDefaultLinkRole().name();
                }
            }
        }

        var result = new java.util.HashMap<String, Object>();
        result.put("accessLevel", level.name());
        result.put("isOwner", isOwner);
        if (linkAccess != null) result.put("linkAccess", linkAccess);
        if (defaultLinkRole != null) result.put("defaultLinkRole", defaultLinkRole);

        return result;
    }

    // ── Helpers ──

    private void requireOwner(Authentication auth, Long resourceId, SharedLink.ResourceType type) {
        if (!securityService.isOwner(resourceId, type)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can manage permissions");
        }
    }

    private PermissionDTO toDTO(ResourcePermission p) {
        PermissionDTO dto = new PermissionDTO();
        dto.id = p.getId();
        dto.email = p.getUser().getEmail();
        dto.userId = p.getUser().getId();
        dto.resourceId = p.getResourceId();
        dto.resourceType = p.getResourceType().name();
        dto.accessLevel = p.getAccessLevel().name();
        dto.status = p.getStatus() != null ? p.getStatus().name() : PermissionStatus.PENDING.name();
        dto.createdAt = p.getCreatedAt().toString();
        return dto;
    }

    // ── DTOs ──

    public static class PermissionDTO {
        public Long id;
        public String email;
        public Long userId;
        public Long resourceId;
        public String resourceType;
        public String accessLevel;
        public String status;
        public String createdAt;
    }

    public static class GrantRequest {
        public String email;
        public Long resourceId;
        public String resourceType;
        public String accessLevel;
        public String resourceTitle; // optional: if provided by client, used as fallback label
    }

    public static class UpdateRequest {
        public String accessLevel;
    }

    public static class LinkAccessRequest {
        public Long resourceId;
        public String resourceType;
        public String linkAccess;
        public String defaultLinkRole;
    }
}
