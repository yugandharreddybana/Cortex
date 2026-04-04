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
import java.util.Set;
import java.util.HashSet;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/permissions")
public class PermissionController {

    private final ResourcePermissionRepository permissionRepo;
    private final UserRepository userRepo;
    private final HighlightRepository highlightRepo;
    private final FolderRepository folderRepo;
    private final SecurityService securityService;
    private final NotificationService notificationService;
    private final com.cortex.api.service.PermissionService permissionService;

    public PermissionController(ResourcePermissionRepository permissionRepo,
                                 UserRepository userRepo,
                                 HighlightRepository highlightRepo,
                                 FolderRepository folderRepo,
                                 SecurityService securityService,
                                 NotificationService notificationService,
                                 com.cortex.api.service.PermissionService permissionService) {
        this.permissionRepo = permissionRepo;
        this.userRepo = userRepo;
        this.highlightRepo = highlightRepo;
        this.folderRepo = folderRepo;
        this.securityService = securityService;
        this.notificationService = notificationService;
        this.permissionService = permissionService;
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
        User granter = userRepo.findById(Long.parseLong(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
 
        if (req.resourceType == null || req.resourceType.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resourceType is required");
        }
        SharedLink.ResourceType resourceType;
        try {
            resourceType = SharedLink.ResourceType.valueOf(req.resourceType.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid resource type: " + req.resourceType);
        }
        
        requireOwner(auth, req.resourceId, resourceType);
 
        ResourcePermission perm = permissionService.grantAccess(
                granter, req.email, req.resourceId, resourceType, req.accessLevel);
 
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

    /**
     * POST /api/v1/permissions/bulk-manage — Update or revoke multiple permissions at once.
     */
    @PostMapping("/bulk-manage")
    @Transactional
    public ResponseEntity<Map<String, Object>> bulkManage(Authentication auth,
                                                          @RequestBody BulkManageRequest req) {
        if (req.resourceType == null || req.resourceType.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resourceType is required");
        }
        SharedLink.ResourceType resourceType;
        try {
            resourceType = SharedLink.ResourceType.valueOf(req.resourceType.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid resource type: " + req.resourceType);
        }

        requireOwner(auth, req.resourceId, resourceType);
        User owner = userRepo.findById(Long.parseLong(auth.getName())).orElseThrow();

        String resourceTitle;
        if (resourceType == SharedLink.ResourceType.HIGHLIGHT) {
            resourceTitle = highlightRepo.findById(req.resourceId).map(h -> h.getSource()).orElse("a highlight");
        } else {
            resourceTitle = folderRepo.findById(req.resourceId).map(f -> f.getName()).orElse("a folder");
        }

        // 1. Process Removals
        if (req.removals != null && !req.removals.isEmpty()) {
            for (Long userId : req.removals) {
                permissionRepo.findByUserIdAndResourceIdAndResourceType(userId, req.resourceId, resourceType)
                        .ifPresent(perm -> {
                            User user = perm.getUser();
                            permissionRepo.delete(perm);
                            // Notify user of revocation
                            notificationService.emitAccessRevoked(user, owner.getFullName(), resourceTitle, req.resourceId, resourceType.name());
                            if (resourceType == SharedLink.ResourceType.FOLDER) {
                                notificationService.triggerFolderAccessRevokedEmail(user, owner, resourceTitle);
                            }
                        });
            }
        }

        // 2. Process Updates
        if (req.updates != null && !req.updates.isEmpty()) {
            for (var update : req.updates) {
                AccessLevel level;
                try {
                    level = AccessLevel.valueOf(update.accessLevel.toUpperCase());
                } catch (IllegalArgumentException e) {
                    continue; // Skip invalid
                }

                permissionRepo.findByUserIdAndResourceIdAndResourceType(update.userId, req.resourceId, resourceType)
                        .ifPresent(perm -> {
                            if (perm.getAccessLevel() != level) {
                                perm.setAccessLevel(level);
                                permissionRepo.save(perm);
                                // Notify user of update
                                User user = perm.getUser();
                                notificationService.emitAccessUpdated(user, owner.getFullName(), resourceTitle, level.name(), req.resourceId, resourceType.name());
                                if (resourceType == SharedLink.ResourceType.FOLDER) {
                                    notificationService.triggerFolderAccessUpdatedEmail(user, owner, resourceTitle, level.name());
                                }
                            }
                        });
            }
        }

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

    /** GET /api/v1/permissions/collaborators — list all unique users shared with/by me */
    @Transactional
    @GetMapping("/collaborators")
    public List<CollaboratorDTO> getCollaborators(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        Set<User> collaborators = new HashSet<>();

        // 1. People shared WITH me
        List<ResourcePermission> incoming = permissionRepo.findByUserId(userId);
        for (ResourcePermission p : incoming) {
            // The owner of the resource is a collaborator
            if (p.getResourceType() == SharedLink.ResourceType.FOLDER) {
                folderRepo.findById(p.getResourceId()).ifPresent(f -> collaborators.add(f.getUser()));
            } else {
                highlightRepo.findById(p.getResourceId()).ifPresent(h -> collaborators.add(h.getUser()));
            }
        }

        // 2. People I shared WITH
        List<com.cortex.api.entity.Folder> myFolders = folderRepo.findByUserId(userId);
        for (com.cortex.api.entity.Folder f : myFolders) {
            List<ResourcePermission> perms = permissionRepo.findByResourceIdAndResourceType(f.getId(), SharedLink.ResourceType.FOLDER);
            for (ResourcePermission p : perms) {
                collaborators.add(p.getUser());
            }
        }

        return collaborators.stream()
                .filter(java.util.Objects::nonNull)
                .filter(u -> u.getId() != null && !u.getId().equals(userId)) // exclude self and invalid IDs
                .map(u -> {
                    CollaboratorDTO dto = new CollaboratorDTO();
                    dto.id = u.getId();
                    dto.email = u.getEmail();
                    dto.fullName = (u.getFullName() != null) ? u.getFullName() : u.getEmail();
                    return dto;
                })
                .distinct()
                .collect(Collectors.toList());
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

    public static class BulkManageRequest {
        public Long resourceId;
        public String resourceType;
        public List<UpdateItem> updates;
        public List<Long> removals;
    }

    public static class UpdateItem {
        public Long userId;
        public String accessLevel;
    }

    public static class CollaboratorDTO {
        public Long id;
        public String email;
        public String fullName;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            CollaboratorDTO that = (CollaboratorDTO) o;
            return java.util.Objects.equals(id, that.id);
        }
 
        @Override
        public int hashCode() {
            return java.util.Objects.hashCode(id);
        }
    }
}
