package com.cortex.api.service;

import com.cortex.api.entity.AccessLevel;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.LinkAccess;
import com.cortex.api.entity.ResourcePermission;
import com.cortex.api.entity.SharedLink;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.ResourcePermissionRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Central permission evaluator used by @PreAuthorize expressions.
 * Registered as a Spring bean named "securityService".
 */
@Service("securityService")
public class SecurityService {

    private final HighlightRepository highlightRepo;
    private final FolderRepository folderRepo;
    private final ResourcePermissionRepository permissionRepo;
    private final PermissionService permissionService;

    public SecurityService(HighlightRepository highlightRepo,
                           FolderRepository folderRepo,
                           ResourcePermissionRepository permissionRepo,
                           PermissionService permissionService) {
        this.highlightRepo = highlightRepo;
        this.folderRepo = folderRepo;
        this.permissionRepo = permissionRepo;
        this.permissionService = permissionService;
    }

    // ── Public permission checks (called from @PreAuthorize) ─────────────────

    /**
     * Check if the current user has at least the required access level
     * on a highlight resource.
     */
    public boolean hasHighlightAccess(Long highlightId, String requiredLevel) {
        Long userId = currentUserId();
        AccessLevel required = AccessLevel.valueOf(requiredLevel);

        // 1. Owner always has full access
        Optional<Highlight> highlight = highlightRepo.findByIdAndUserId(highlightId, userId);
        if (highlight.isPresent()) return true;

        // 2. Check explicit permission
        Optional<ResourcePermission> perm = permissionRepo
                .findByUserIdAndResourceIdAndResourceType(userId, highlightId, SharedLink.ResourceType.HIGHLIGHT);
        if (perm.isPresent() && perm.get().getAccessLevel().atLeast(required)) return true;

        Highlight h = highlightRepo.findById(highlightId).orElse(null);
        if (h == null) return false;

        // 3. Check folder-level inherited access
        if (h.getFolderId() != null) {
            AccessLevel folderRole = permissionService.getEffectiveRole(userId, h.getFolderId());
            if (folderRole != null && folderRole.atLeast(required)) {
                return true;
            }
        }

        // 4. Check link-level access (ANYONE_WITH_LINK)
        if (h.getLinkAccess() == LinkAccess.ANYONE_WITH_LINK) {
            return h.getDefaultLinkRole().atLeast(required);
        }

        return false;
    }

    /**
     * Check if the current user has at least the required access level
     * on a folder resource.
     *
     * <p>Uses {@link PermissionService#getEffectiveRole} which traverses the folder
     * hierarchy upward, so a VIEWER grant on a parent folder is inherited, and an
     * explicit EDITOR grant on a child folder correctly overrides a VIEWER on the parent.
     */
    public boolean hasFolderAccess(Long folderId, String requiredLevel) {
        Long userId = currentUserId();
        AccessLevel required = AccessLevel.valueOf(requiredLevel);
        AccessLevel effective = permissionService.getEffectiveRole(userId, folderId);
        return effective != null && effective.atLeast(required);
    }

    // ── Resolve current user's AccessLevel on a resource ─────────────────────

    /**
     * Returns the effective access level the current user has on a resource.
     * Used by collaboration pages to determine UI capabilities.
     */
    // ── Resolve current user's AccessLevel on a resource ─────────────────────────

    /**
     * Returns the effective access level the current user has on a resource.
     * For folders, uses inheritance-aware resolution via {@link PermissionService}.
     */
    public AccessLevel resolveAccessLevel(Long resourceId, SharedLink.ResourceType type) {
        Long userId = currentUserId();

        if (type == SharedLink.ResourceType.FOLDER) {
            return permissionService.getEffectiveRole(userId, resourceId);
        }

        // ── Highlights: flat permission check (no hierarchy) ──────────────────
        if (highlightRepo.findByIdAndUserId(resourceId, userId).isPresent()) {
            return AccessLevel.OWNER;
        }

        Optional<ResourcePermission> perm = permissionRepo
                .findByUserIdAndResourceIdAndResourceType(userId, resourceId, type);
        if (perm.isPresent()) return perm.get().getAccessLevel();

        Highlight h = highlightRepo.findById(resourceId).orElse(null);
        if (h != null && h.getLinkAccess() == LinkAccess.ANYONE_WITH_LINK) {
            return h.getDefaultLinkRole();
        }

        return null;
    }

    // ── Check if a user is the owner of a resource ───────────────────────────

    public boolean isOwner(Long resourceId, SharedLink.ResourceType type) {
        Long userId = currentUserId();
        if (type == SharedLink.ResourceType.HIGHLIGHT) {
            return highlightRepo.findByIdAndUserId(resourceId, userId).isPresent();
        } else {
            return folderRepo.findByIdAndUserId(resourceId, userId).isPresent();
        }
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(auth.getName());
    }

    public Long getCurrentUserId() {
        return currentUserId();
    }
}
