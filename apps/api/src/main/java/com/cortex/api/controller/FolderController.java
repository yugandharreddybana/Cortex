
package com.cortex.api.controller;

import com.cortex.api.entity.AccessLevel;
import com.cortex.api.entity.Folder;
import com.cortex.api.entity.LinkAccess;
import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.service.FolderService;
import com.cortex.api.service.PermissionService;
import com.cortex.api.service.WebSocketService;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/folders")
public class FolderController {

    private final FolderService folderService;
    private final UserRepository userRepo;
    private final PermissionService permissionService;
    private final WebSocketService webSocketService;

    public FolderController(FolderService folderService,
                            UserRepository userRepo,
                            PermissionService permissionService,
                            WebSocketService webSocketService) {
        this.folderService = folderService;
        this.userRepo = userRepo;
        this.permissionService = permissionService;
        this.webSocketService = webSocketService;
    }

    @GetMapping
    public List<FolderDTO> list(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        return folderService.getFoldersByUserId(userId).stream()
                .map(f -> toDTO(f, permissionService.getEffectiveRole(userId, f.getId())))
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<FolderDTO> create(Authentication auth,
                                            @RequestBody FolderDTO dto) {
        User user = resolveUser(auth);
        Long userId = user.getId();
        Folder f = fromDTO(dto, user);
        // Resolve parent folder if parentId is provided
        if (dto.parentId != null) {
            // Verify the user has at least EDITOR access to create under this parent
            AccessLevel parentRole = permissionService.getEffectiveRole(userId, dto.parentId);
            if (parentRole == null || !parentRole.atLeast(AccessLevel.EDITOR)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You need EDITOR access to create subfolders here");
            }
            Folder parent = folderService.getFolderById(dto.parentId);
            f.setParentFolder(parent);
        }
        Folder newFolder = folderService.createFolder(f);
        FolderDTO created = toDTO(newFolder);
        webSocketService.sendToUser(auth.getName(), "/topic/folders", created);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@securityService.hasFolderAccess(#id, 'EDITOR')")
    public FolderDTO update(Authentication auth,
                            @PathVariable Long id,
                            @RequestBody FolderDTO dto) {
        User user = resolveUser(auth);
        Folder folder = folderService.updateFolder(id, dto, user);
        FolderDTO updated = toDTO(folder);
        webSocketService.sendToUser(auth.getName(), "/topic/folders/updated", updated);
        return updated;
    }

    @PatchMapping("/{id}")
    @PreAuthorize("@securityService.hasFolderAccess(#id, 'EDITOR')")
    public FolderDTO patch(Authentication auth,
                           @PathVariable Long id,
                           @RequestBody FolderDTO dto) {
        User user = resolveUser(auth);
        Folder folder = folderService.updateFolder(id, dto, user);
        FolderDTO patched = toDTO(folder);
        webSocketService.sendToUser(auth.getName(), "/topic/folders/updated", patched);
        return patched;
    }

    @DeleteMapping("/{id}")
    @Transactional
    @PreAuthorize("@securityService.hasFolderAccess(#id, 'EDITOR')")
        public ResponseEntity<Map<String, Boolean>> delete(
            Authentication auth,
            @PathVariable Long id,
            @RequestParam(value = "keepHighlights", defaultValue = "false") boolean keepHighlights) {
        Long userId = Long.parseLong(auth.getName());
        folderService.deleteFolder(id, userId, keepHighlights);
        webSocketService.sendToUser(auth.getName(), "/topic/folders/deleted", id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /**
     * Duplicate &amp; Revoke: deep-clone a folder tree into the caller's private workspace,
     * then revoke the caller's shared access to the original folder.
     *
     * <p>The caller must have at least VIEWER access on the source folder (i.e. it is shared
     * with them). After cloning:
     * <ul>
     *   <li>A brand-new folder tree owned by the caller is created.</li>
     *   <li>The caller's {@link com.cortex.api.entity.ResourcePermission} record for the
     *       original folder is deleted — they can no longer access it.</li>
     * </ul>
     */
    @PostMapping("/{id}/duplicate")
    @Transactional
        public ResponseEntity<FolderDTO> duplicate(
            Authentication auth,
            @PathVariable Long id) {
        Long callerId = Long.parseLong(auth.getName());

        // Caller must have at least VIEWER access (i.e. the folder exists and is accessible)
        AccessLevel callerRole = permissionService.getEffectiveRole(callerId, id);
        if (callerRole == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found or not accessible");
        }

        // Owners don't need to duplicate — they already own it
        if (callerRole == AccessLevel.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You already own this folder. Duplication is for shared folders only.");
        }

        // Deep-clone the folder tree; place clone at caller's root
        Folder cloneRoot = folderService.deepCloneFolder(id, callerId, null);

        // Revoke caller's access to the original folder
        folderService.revokeAccessAfterDuplicate(callerId, id);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(toDTO(cloneRoot, AccessLevel.OWNER));
    }

    @PutMapping("/sync")
    @Transactional
    public List<FolderDTO> sync(Authentication auth, @RequestBody List<FolderDTO> dtos) {
        User user = resolveUser(auth);
        return folderService.syncFolders(user, dtos)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    private User resolveUser(Authentication auth) {
        return userRepo.findById(Long.parseLong(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private Folder fromDTO(FolderDTO dto, User user) {
        Folder f = new Folder();
        // Never use client-supplied id — the DB assigns the PK via IDENTITY auto-increment
        f.setUser(user);
        f.setName(dto.name);
        f.setEmoji(dto.emoji != null ? dto.emoji : "📁");
        // Parent folder will be set in the controller after lookup
        f.setPinned(dto.isPinned);
        
        // Set link access — always provide a default
        if (dto.linkAccess != null && !dto.linkAccess.isEmpty()) {
            try {
                f.setLinkAccess(LinkAccess.valueOf(dto.linkAccess));
            } catch (IllegalArgumentException e) {
                f.setLinkAccess(LinkAccess.RESTRICTED);
            }
        } else {
            f.setLinkAccess(LinkAccess.RESTRICTED);
        }
        
        // Set default link role — always provide a default
        if (dto.defaultLinkRole != null && !dto.defaultLinkRole.isEmpty()) {
            try {
                f.setDefaultLinkRole(AccessLevel.valueOf(dto.defaultLinkRole));
            } catch (IllegalArgumentException e) {
                f.setDefaultLinkRole(AccessLevel.VIEWER);
            }
        } else {
            f.setDefaultLinkRole(AccessLevel.VIEWER);
        }
        
        return f;
    }

    private FolderDTO toDTO(Folder f) {
        return toDTO(f, null);
    }

    private FolderDTO toDTO(Folder f, AccessLevel effectiveRole) {
        FolderDTO dto = new FolderDTO();
        dto.id = f.getId();
        dto.name = f.getName();
        dto.emoji = f.getEmoji();
        dto.parentId = f.getParentFolder() != null ? f.getParentFolder().getId() : null;
        dto.isPinned = f.isPinned();
        dto.linkAccess = f.getLinkAccess() != null ? f.getLinkAccess().name() : "RESTRICTED";
        dto.defaultLinkRole = f.getDefaultLinkRole() != null ? f.getDefaultLinkRole().name() : "VIEWER";
        // Timestamps
        dto.createdAt = f.getCreatedAt();
        dto.updatedAt = f.getUpdatedAt();
        // RBAC: caller's effective role on this folder
        dto.effectiveRole = effectiveRole != null ? effectiveRole.name() : null;
        dto.synthesis = f.getSynthesis();
        return dto;
    }
}
