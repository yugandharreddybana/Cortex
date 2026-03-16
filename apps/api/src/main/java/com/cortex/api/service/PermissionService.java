package com.cortex.api.service;

import com.cortex.api.entity.AccessLevel;
import com.cortex.api.entity.Folder;
import com.cortex.api.entity.LinkAccess;
import com.cortex.api.entity.PermissionStatus;
import com.cortex.api.entity.ResourcePermission;
import com.cortex.api.entity.SharedLink;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.ResourcePermissionRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Permission resolution service implementing hierarchical RBAC.
 *
 * <p>The resolution algorithm traverses the folder tree <em>upward</em>:
 * <ol>
 *   <li>Is the user the folder's owner? → OWNER (highest privilege)</li>
 *   <li>Does the user have an explicit, ACCEPTED {@link ResourcePermission}
 *       on this exact folder? → use that level (explicit override)</li>
 *   <li>Does the folder allow ANYONE_WITH_LINK? → use the link default role</li>
 *   <li>Move to parent_folder_id and repeat from step 1.</li>
 *   <li>No access found after reaching the root → return {@code null}.</li>
 * </ol>
 *
 * <p>The explicit check at step 2 means that a VIEWER grant on the parent
 * is correctly <em>overridden</em> by an EDITOR grant on a child folder
 * (the child is examined first).
 *
 * <p>An iterative (not recursive) implementation is used to avoid stack
 * overflow on deeply nested hierarchies; the traversal is capped at
 * {@value #MAX_DEPTH} levels as a safety net.
 */
@Service
public class PermissionService {

    private static final Logger log = LoggerFactory.getLogger(PermissionService.class);

    /** Safety cap: prevents cycles or malformed parentage from looping forever. */
    private static final int MAX_DEPTH = 50;

    private final FolderRepository folderRepo;
    private final ResourcePermissionRepository permissionRepo;

    public PermissionService(FolderRepository folderRepo,
                             ResourcePermissionRepository permissionRepo) {
        this.folderRepo = folderRepo;
        this.permissionRepo = permissionRepo;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Determine the effective {@link AccessLevel} a user holds on a folder,
     * taking inheritance into account.
     *
     * @param userId   the user whose role we are resolving
     * @param folderId the folder to start the resolution from
     * @return the effective access level, or {@code null} if the user has no access
     */
    @Transactional
    public AccessLevel getEffectiveRole(Long userId, Long folderId) {
        Long currentId = folderId;
        int depth = 0;

        while (currentId != null && depth < MAX_DEPTH) {
            Optional<Folder> opt = folderRepo.findById(currentId);
            if (opt.isEmpty()) {
                log.warn("[RBAC Resolution] Folder {} not found during traversal at depth {}", currentId, depth);
                return null;
            }
            Folder folder = opt.get();

            // ── 1. Ownership check ───────────────────────────────────────────
            if (folder.getUser().getId().equals(userId)) {
                log.debug("[RBAC Resolution] user={} is OWNER of folder={} (depth={})", userId, currentId, depth);
                return AccessLevel.OWNER;
            }

            // ── 2. Explicit permission on this exact folder ──────────────────
            Optional<ResourcePermission> perm = permissionRepo
                    .findByUserIdAndResourceIdAndResourceType(
                            userId, currentId, SharedLink.ResourceType.FOLDER);

            if (perm.isPresent() && perm.get().getStatus() == PermissionStatus.ACCEPTED) {
                AccessLevel level = perm.get().getAccessLevel();
                log.debug("[RBAC Resolution] user={} has explicit {} on folder={} (depth={})",
                        userId, level, currentId, depth);
                return level;
            }

            // ── 3. Link-level access (public link) ───────────────────────────
            if (folder.getLinkAccess() == LinkAccess.ANYONE_WITH_LINK) {
                AccessLevel linkRole = folder.getDefaultLinkRole();
                log.debug("[RBAC Resolution] user={} gets {} via public link on folder={} (depth={})",
                        userId, linkRole, currentId, depth);
                return linkRole;
            }

            // ── 4. Traverse to parent ────────────────────────────────────────
            Folder parent = folder.getParentFolder();
            currentId = (parent != null) ? parent.getId() : null;
            depth++;
        }

        if (depth >= MAX_DEPTH) {
            log.error("[RBAC Resolution] Max traversal depth ({}) reached for folderId={}, userId={}. Possible cycle.",
                    MAX_DEPTH, folderId, userId);
        } else {
            log.debug("[RBAC Resolution] user={} has NO access to folder={}", userId, folderId);
        }
        return null;
    }

    /**
     * Convenience predicate for use in services and {@code @PreAuthorize} expressions.
     *
     * @param userId        the user to check
     * @param folderId      the folder to check
     * @param requiredLevel the minimum required level (e.g. {@code "EDITOR"})
     * @return {@code true} if the user's effective role is at least {@code requiredLevel}
     */
    public boolean hasEffectiveAccess(Long userId, Long folderId, String requiredLevel) {
        AccessLevel effective = getEffectiveRole(userId, folderId);
        if (effective == null) {
            log.info("[RBAC Resolution] 403 Forbidden — user={} denied access to folder={} (required={})",
                    userId, folderId, requiredLevel);
            return false;
        }
        boolean allowed = effective.atLeast(AccessLevel.valueOf(requiredLevel));
        if (!allowed) {
            log.info("[RBAC Resolution] 403 Forbidden — user={} has {} on folder={} but {} is required",
                    userId, effective, folderId, requiredLevel);
        }
        return allowed;
    }

    /**
     * Returns {@code true} only when the user is the direct OWNER of the folder
     * (not inherited, not via shared link).
     */
    @Transactional
    public boolean isEffectiveOwner(Long userId, Long folderId) {
        return getEffectiveRole(userId, folderId) == AccessLevel.OWNER;
    }
}
