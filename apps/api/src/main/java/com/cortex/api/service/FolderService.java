
package com.cortex.api.service;

import com.cortex.api.controller.FolderDTO;
import com.cortex.api.entity.AccessLevel;
import com.cortex.api.entity.Folder;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.LinkAccess;
import com.cortex.api.entity.PermissionStatus;
import com.cortex.api.entity.ResourcePermission;
import com.cortex.api.entity.ResourceType;
import com.cortex.api.entity.SharedLink;
import com.cortex.api.entity.User;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.ResourcePermissionRepository;
import com.cortex.api.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class FolderService {
    
    private static final Logger log = LoggerFactory.getLogger(FolderService.class);

    /** Safety cap for the recursive deep-clone to prevent stack overflow. */
    private static final int MAX_CLONE_DEPTH = 100;

    private final FolderRepository folderRepository;
    private final HighlightRepository highlightRepository;
    private final ResourcePermissionRepository permissionRepository;
    private final PermissionService permissionService;
    private final EmailService emailService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Autowired
    public FolderService(FolderRepository folderRepository,
                         HighlightRepository highlightRepository,
                         ResourcePermissionRepository permissionRepository,
                         PermissionService permissionService,
                         EmailService emailService,
                         UserRepository userRepository,
                         NotificationService notificationService) {
        this.folderRepository = folderRepository;
        this.highlightRepository = highlightRepository;
        this.permissionRepository = permissionRepository;
        this.permissionService = permissionService;
        this.emailService = emailService;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public List<Folder> getFoldersByUserId(Long userId) {
        List<Folder> ownFolders = folderRepository.findByUserId(userId);

        // Also include folders shared with this user that have been accepted
        List<Long> sharedFolderIds = permissionRepository
                .findByUserIdAndResourceTypeAndStatus(userId, SharedLink.ResourceType.FOLDER, PermissionStatus.ACCEPTED)
                .stream().map(ResourcePermission::getResourceId).toList();

        if (sharedFolderIds.isEmpty()) {
            return ownFolders;
        }

        List<Folder> sharedFolders = folderRepository.findAllById(sharedFolderIds);
        List<Folder> combined = new ArrayList<>(ownFolders);
        combined.addAll(sharedFolders);
        return combined;
    }

    /**
     * Get a folder by ID and user ID (validates ownership).
     */
    public Folder getFolderByIdAndUserId(Long folderId, Long userId) {
        return folderRepository.findByIdAndUserId(folderId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Folder not found or not owned by you"
                ));
    }

    /**
     * Fetch a folder by its primary key without an ownership constraint.
     * The caller must already have verified access via PermissionService before calling this.
     */
    public Folder getFolderById(Long folderId) {
        return folderRepository.findById(folderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));
    }

    @Transactional
    public Folder createFolder(Folder folder) {
        // Validate uniqueness: (user_id, parent_folder_id, name)
        Folder parentFolder = folder.getParentFolder();
        Long parentId = (parentFolder != null) ? parentFolder.getId() : null;
        
        boolean exists = folderRepository.existsByUserAndParentAndName(
                folder.getUser().getId(),
                folder.getName(),
                parentId
        );
        
        if (exists) {
            log.warn("[Folder Creation] Duplicate folder name '{}' for user {} at parent {}: 409 Conflict",
                    folder.getName(), folder.getUser().getId(), parentId);
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A folder with this name already exists at this level"
            );
        }

        try {
            Folder newFolder = folderRepository.save(folder);
            log.info("[Folder Creation] Created folder {} (id={}) as child of {} by user {}",
                    newFolder.getName(), newFolder.getId(), parentId, newFolder.getUser().getId());
            return newFolder;
        } catch (DataIntegrityViolationException e) {
            log.warn("[Folder Creation] DataIntegrityViolation: likely duplicate unique constraint (user_id, parent_id, name)", e);
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A folder with this name already exists at this level"
            );
        }
    }

    @Transactional
    public Folder updateFolder(Long folderId, FolderDTO dto, User user) {
        Folder f = folderRepository.findByIdAndUserId(folderId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (dto.name != null) f.setName(dto.name);
        if (dto.emoji != null) f.setEmoji(dto.emoji);

        // Always enforce a valid linkAccess (never null)
        if (dto.linkAccess != null && !dto.linkAccess.isEmpty()) {
            try {
                f.setLinkAccess(com.cortex.api.entity.LinkAccess.valueOf(dto.linkAccess));
            } catch (IllegalArgumentException e) {
                f.setLinkAccess(com.cortex.api.entity.LinkAccess.RESTRICTED);
            }
        } else if (f.getLinkAccess() == null) {
            f.setLinkAccess(com.cortex.api.entity.LinkAccess.RESTRICTED);
        }

        // Always enforce a valid defaultLinkRole (never null)
        if (dto.defaultLinkRole != null && !dto.defaultLinkRole.isEmpty()) {
            try {
                f.setDefaultLinkRole(com.cortex.api.entity.AccessLevel.valueOf(dto.defaultLinkRole));
            } catch (IllegalArgumentException e) {
                f.setDefaultLinkRole(com.cortex.api.entity.AccessLevel.VIEWER);
            }
        } else if (f.getDefaultLinkRole() == null) {
            f.setDefaultLinkRole(com.cortex.api.entity.AccessLevel.VIEWER);
        }

        // Only change parent when the JSON explicitly includes "parentId".
        // null = move to root, non-null = move under that parent.
        // When parentId is absent (e.g. rename/emoji/pin updates), don't touch it.
        if (dto.parentIdPresent) {
            if (dto.parentId != null) {
                Folder parentFolder = folderRepository.findByIdAndUserId(Long.valueOf(dto.parentId), user.getId())
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "Parent folder not found or not owned by you"
                        ));
                f.setParentFolder(parentFolder);
            } else {
                f.setParentFolder(null); // Move to root
            }
        }

        if (dto.isPinned != f.isPinned()) f.setPinned(dto.isPinned);
        Folder updatedFolder = folderRepository.save(f);
        log.info("[Folder] Updated folder {} by user {}", folderId, user.getId());
        return updatedFolder;
    }

    /**
     * Delete a folder with RBAC-aware behavior.
     *
     * <ul>
     *   <li><strong>OWNER</strong>: standard soft delete cascade.</li>
     *   <li><strong>EDITOR</strong>: soft delete cascade + async email to owner.</li>
     *   <li><strong>VIEWER / COMMENTER / no access</strong>: 403 Forbidden.</li>
     * </ul>
     *
     * @param folderId       the root folder to delete
     * @param callerId       the user requesting the deletion
     * @param keepHighlights if {@code true}, orphan highlights to root; otherwise soft-delete them
     */
    @Transactional
    public void deleteFolder(Long folderId, Long callerId, boolean keepHighlights) {
        // Get folder first to check existence and ownership
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));

        // Resolve caller's effective role (with inheritance)
        AccessLevel callerRole = permissionService.getEffectiveRole(callerId, folderId);
        if (callerRole == null || !callerRole.atLeast(AccessLevel.EDITOR)) {
            log.warn("[Folder Deletion] 403 Forbidden — user={} has {} on folder={} (EDITOR required)",
                    callerId, callerRole, folderId);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You must be an EDITOR or OWNER to delete this folder");
        }

        User owner = folder.getUser();
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        log.info("[Folder Deletion] user={} (role={}) hard-deleting folder={} keepHighlights={}",
                callerId, callerRole, folderId, keepHighlights);

        // Get all descendants (including the folder itself) before deleting
        List<Folder> allDescendants = folderRepository.findAllDescendantsInclusive(folderId);

        // Handle highlights: either orphan or mark as deleted
        for (Folder descendant : allDescendants) {
            Set<Highlight> highlights = descendant.getHighlights();
            if (keepHighlights) {
                for (Highlight h : highlights) {
                    h.setFolderId(null);
                }
            } else {
                for (Highlight h : highlights) {
                    h.setDeleted(true);
                }
            }
            if (!highlights.isEmpty()) {
                highlightRepository.saveAll(highlights);
            }
        }

        // Remove all permission records for descendants (cleanup shared access)
        List<Long> descendantIds = allDescendants.stream()
                .map(Folder::getId)
                .collect(java.util.stream.Collectors.toList());

        if (!descendantIds.isEmpty()) {
            permissionRepository.deleteByResourceIdInAndResourceType(descendantIds, SharedLink.ResourceType.FOLDER);
        }

        // Hard-delete all descendants (including root folder)
        folderRepository.deleteAll(allDescendants);

        // Send notification to owner if EDITOR (not owner) performed the deletion
        if (callerRole != AccessLevel.OWNER) {
            String callerName = caller.getFullName() != null ? caller.getFullName() : caller.getEmail();
            
            // Send email to owner
            emailService.sendEditorDeletedFolderEmail(
                    owner.getEmail(), callerName, folder.getName(), String.valueOf(folderId));

            // Send instant in-app notification to owner
            notificationService.createInstantNotification(
                    owner, caller, "DELETED", folderId,
                    callerName + " deleted your shared folder \"" + folder.getName() + "\"",
                    "/dashboard"
            );

            // Accumulate in the 60-minute digest window
            notificationService.logBatchedAction(owner, caller, folderId, folder.getName());

            log.info("[Folder Deletion] Editor={} hard-deleted folder={} owned by={}; owner notified",
                    callerId, folderId, owner.getId());
        }

        log.info("[Folder Deletion] Folder tree rooted at {} hard-deleted (permanently) by user={}", folderId, callerId);
    }

    @Transactional
    public List<Folder> syncFolders(User user, List<FolderDTO> dtos) {
        for (FolderDTO dto : dtos) {
            Folder f;
            if (dto.id != null) {
                // dto.id is already a Long (auto-increment PK); use it directly for upsert lookup
                f = folderRepository.findByIdAndUserId(dto.id, user.getId())
                        .orElseGet(() -> {
                            Folder newF = new Folder();
                            newF.setUser(user);
                            // Set default values for new folders
                            newF.setLinkAccess(com.cortex.api.entity.LinkAccess.RESTRICTED);
                            newF.setDefaultLinkRole(com.cortex.api.entity.AccessLevel.VIEWER);
                            return newF;
                        });
            } else {
                f = new Folder();
                f.setUser(user);
                f.setLinkAccess(com.cortex.api.entity.LinkAccess.RESTRICTED);
                f.setDefaultLinkRole(com.cortex.api.entity.AccessLevel.VIEWER);
            }
            
            if (dto.name != null) f.setName(dto.name);
            if (dto.emoji != null) f.setEmoji(dto.emoji);
            
            // Handle link access — update if provided
            if (dto.linkAccess != null && !dto.linkAccess.isEmpty()) {
                try {
                    f.setLinkAccess(com.cortex.api.entity.LinkAccess.valueOf(dto.linkAccess));
                } catch (IllegalArgumentException e) {
                    f.setLinkAccess(com.cortex.api.entity.LinkAccess.RESTRICTED);
                }
            } else if (f.getLinkAccess() == null) {
                f.setLinkAccess(com.cortex.api.entity.LinkAccess.RESTRICTED);
            }
            
            // Handle default link role — update if provided
            if (dto.defaultLinkRole != null && !dto.defaultLinkRole.isEmpty()) {
                try {
                    f.setDefaultLinkRole(com.cortex.api.entity.AccessLevel.valueOf(dto.defaultLinkRole));
                } catch (IllegalArgumentException e) {
                    f.setDefaultLinkRole(com.cortex.api.entity.AccessLevel.VIEWER);
                }
            } else if (f.getDefaultLinkRole() == null) {
                f.setDefaultLinkRole(com.cortex.api.entity.AccessLevel.VIEWER);
            }
            
            // Handle parent folder reference (sync always sends parentId)
            if (dto.parentIdPresent) {
                if (dto.parentId != null) {
                    Folder parent = folderRepository.findByIdAndUserId(Long.valueOf(dto.parentId), user.getId())
                            .orElse(null);
                    f.setParentFolder(parent);
                } else {
                    f.setParentFolder(null);
                }
            }
            
            f.setPinned(dto.isPinned);
            folderRepository.save(f);
        }
        
        return getFoldersByUserId(user.getId());
    }

    /**
     * Revoke the caller's {@link ResourcePermission} on the original shared folder
     * after they have duplicated it into their own private workspace.
     */
    @Transactional
    public void revokeAccessAfterDuplicate(Long callerId, Long originalFolderId) {
        permissionRepository.deleteByUserIdAndResourceIdAndResourceType(
                callerId, originalFolderId, SharedLink.ResourceType.FOLDER);
        log.info("[Deep Clone] Revoked access of user={} to original folder={} after duplicate",
                callerId, originalFolderId);
    }

    // ─────────────────────────────────────────────────────────── Deep Clone ──

    /**
     * Recursively deep-clone a folder tree and assign it to a new owner.
     *
     * <p>The algorithm:
     * <ol>
     *   <li>Creates a new {@link Folder} entity (new ID, same name/emoji, owner = newOwner).</li>
     *   <li>Clones every non-deleted {@link Highlight} in the source folder into the new folder.</li>
     *   <li>Recursively calls itself for each non-deleted child folder.</li>
     * </ol>
     *
     * <p>The entire operation is enclosed in a single {@code @Transactional} boundary so that
     * any failure (e.g. DB constraint at depth N) rolls back the whole clone atomically.
     *
     * <p><strong>Performance note</strong>: For trees exceeding ~1 000 items, consider
     * delegating to a Spring {@code @Async} method or a message queue so the HTTP request
     * returns immediately with a 202 Accepted while the clone runs in the background.
     *
     * @param sourceFolderId the root of the folder tree to duplicate
     * @param newOwnerId     the user who will own the cloned tree
     * @param targetParentId the parent folder for the clone's root ({@code null} = place at root)
     * @return the newly created root {@link Folder} of the cloned tree
     */
    @Transactional
    public Folder deepCloneFolder(Long sourceFolderId, Long newOwnerId, Long targetParentId) {
        User newOwner = userRepository.findById(newOwnerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        log.info("[Deep Clone] Starting deep clone of folder={} for newOwner={}", sourceFolderId, newOwnerId);
        Folder cloneRoot = deepCloneRecursive(sourceFolderId, newOwner, targetParentId, 0);
        log.info("[Deep Clone] Completed. Clone root id={}", cloneRoot.getId());
        return cloneRoot;
    }

    private Folder deepCloneRecursive(Long sourceFolderId, User newOwner, Long parentId, int depth) {
        if (depth > MAX_CLONE_DEPTH) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Deep clone exceeded maximum nesting depth of " + MAX_CLONE_DEPTH);
        }

        Folder source = folderRepository.findById(sourceFolderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Source folder not found: " + sourceFolderId));

        // ── Build the clone folder ──────────────────────────────────────────
        Folder clone = new Folder();
        clone.setUser(newOwner);
        clone.setName(source.getName());
        clone.setEmoji(source.getEmoji());
        clone.setLinkAccess(LinkAccess.RESTRICTED);   // reset to private; owner can re-share
        clone.setDefaultLinkRole(AccessLevel.VIEWER);

        if (parentId != null) {
            Folder parent = folderRepository.findById(parentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Parent folder not found: " + parentId));
            clone.setParentFolder(parent);
        }

        Folder savedClone = folderRepository.save(clone);
        log.info("[Deep Clone] depth={} created folder id={} (source={})", depth, savedClone.getId(), sourceFolderId);

        // ── Clone highlights in this folder ─────────────────────────────────
        List<Highlight> sourceHighlights = highlightRepository.findByFolderIdAndNotDeleted(sourceFolderId);
        for (Highlight src : sourceHighlights) {
            Highlight h = new Highlight();
            h.setUser(newOwner);
            h.setText(src.getText());
            h.setSource(src.getSource());
            h.setUrl(src.getUrl());
            h.setTopic(src.getTopic());
            h.setTopicColor(src.getTopicColor());
            h.setSavedAt(src.getSavedAt());
            h.setFolderId(savedClone.getId());
            h.setNote(src.getNote());
            h.setCode(src.isCode());
            h.setFavorite(false);    // personal state — do not copy
            h.setArchived(false);
            h.setPinned(false);
            h.setHighlightColor(src.getHighlightColor());
            h.setAI(src.isAI());
            h.setChatName(src.getChatName());
            h.setChatUrl(src.getChatUrl());
            h.setResourceType(src.getResourceType() != null ? src.getResourceType() : ResourceType.TEXT);
            h.setVideoTimestamp(src.getVideoTimestamp());
            h.setLinkAccess(LinkAccess.RESTRICTED);
            h.setDefaultLinkRole(AccessLevel.VIEWER);
            highlightRepository.save(h);
        }
        log.info("[Deep Clone] depth={} cloned {} highlight(s) into folder={}", depth, sourceHighlights.size(), savedClone.getId());

        // ── Recurse into child folders ───────────────────────────────────────
        List<Folder> children = folderRepository.findByParentFolderId(sourceFolderId);
        for (Folder child : children) {
            deepCloneRecursive(child.getId(), newOwner, savedClone.getId(), depth + 1);
        }

        return savedClone;
    }
}