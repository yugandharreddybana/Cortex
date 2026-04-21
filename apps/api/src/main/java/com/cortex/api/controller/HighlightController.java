package com.cortex.api.controller;

import com.cortex.api.dto.HighlightDTO;

import com.cortex.api.dto.TagDTO;
import com.cortex.api.entity.AccessLevel;
import com.cortex.api.entity.Folder;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.HighlightTag;
import com.cortex.api.entity.LinkAccess;
import com.cortex.api.entity.ResourceType;
import com.cortex.api.entity.Tag;
import com.cortex.api.entity.User;
import com.cortex.api.entity.SharedLink;
import com.cortex.api.entity.PermissionStatus;
import com.cortex.api.entity.ResourcePermission;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.ResourcePermissionRepository;
import com.cortex.api.repository.TagRepository;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.service.OllamaService;
import com.cortex.api.service.WebSocketService;
import com.cortex.api.service.NotificationService;
import jakarta.transaction.Transactional;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.scheduler.Schedulers;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/highlights")
public class HighlightController {

    private final HighlightRepository highlightRepo;
    private final UserRepository userRepo;
    private final TagRepository tagRepo;
    private final FolderRepository folderRepo;
    private final WebSocketService webSocketService;
    private final com.cortex.api.service.FolderService folderService;
    private final com.cortex.api.service.SecurityService securityService;
    private final OllamaService ollamaService;
    private final com.cortex.api.service.ReferralService referralService;
    private final NotificationService notificationService;
    private final ResourcePermissionRepository permissionRepo;
    private final EntityManager em;

    public HighlightController(HighlightRepository highlightRepo,
                               UserRepository userRepo,
                               TagRepository tagRepo,
                               FolderRepository folderRepo,
                               WebSocketService webSocketService,
                               com.cortex.api.service.FolderService folderService,
                               com.cortex.api.service.SecurityService securityService,
                               OllamaService ollamaService,
                               com.cortex.api.service.ReferralService referralService,
                               NotificationService notificationService,
                               ResourcePermissionRepository permissionRepo,
                               EntityManager em) {
        this.highlightRepo = highlightRepo;
        this.userRepo = userRepo;
        this.tagRepo = tagRepo;
        this.folderRepo = folderRepo;
        this.webSocketService = webSocketService;
        this.folderService = folderService;
        this.securityService = securityService;
        this.ollamaService = ollamaService;
        this.referralService = referralService;
        this.notificationService = notificationService;
        this.permissionRepo = permissionRepo;
        this.em = em;
    }

    @Transactional
    @GetMapping
    public List<HighlightDTO> list(Authentication auth, @RequestParam(defaultValue = "false") boolean includeDeleted) {
        Long userId = Long.parseLong(java.util.Objects.requireNonNull(auth.getName()));
        
        if (includeDeleted) {
            // Trash view: Own deleted + Hidden shared highlights
            List<Highlight> deleted = highlightRepo.findDeletedByUserId(userId);
            List<Highlight> hidden = highlightRepo.findHiddenByUserId(userId);
            Set<Highlight> combined = new HashSet<>(deleted);
            combined.addAll(hidden);
            return combined.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::toDTO)
                .toList();
        }

        // 1. Get all accessible folders (including inherited descendants of shared folders)
        List<Long> accessibleFolderIds = folderService.getFoldersByUserId(userId).stream()
                .map(Folder::getId)
                .toList();

        // 2. Get all DIRECTLY shared highlights (ResourcePermission.HIGHLIGHT)
        List<Long> sharedHighlightIds = permissionRepo
                .findByUserIdAndResourceTypeAndStatus(userId, SharedLink.ResourceType.HIGHLIGHT, PermissionStatus.ACCEPTED)
                .stream().map(ResourcePermission::getResourceId).toList();

        // 3. Fetch highlights: (owned) OR (in accessible folders) OR (direct shared highlights)
        List<Highlight> highlights;
        if (accessibleFolderIds.isEmpty() && sharedHighlightIds.isEmpty()) {
            highlights = highlightRepo.findByUserIdOrderByCreatedAtDesc(userId);
        } else {
            highlights = highlightRepo.findByUserIdOrFolderIdsOrderByCreatedAtDesc(userId, accessibleFolderIds);
            
            if (!sharedHighlightIds.isEmpty()) {
                List<Highlight> directlyShared = highlightRepo.findAllById(sharedHighlightIds);
                Set<Long> existingIds = highlights.stream().map(Highlight::getId).collect(Collectors.toSet());
                highlights = new ArrayList<>(highlights);
                for (Highlight h : directlyShared) {
                    if (!existingIds.contains(h.getId()) && !h.isDeleted()) {
                        highlights.add(h);
                    }
                }
                highlights.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
            }
        }
        
        return highlights.stream().map(this::toDTO).toList();
    }

    @GetMapping("/search")
    public List<HighlightDTO> search(Authentication auth, @RequestParam String q) {
        Long userId = Long.parseLong(auth.getName());
        List<Long> accessibleFolderIds = folderService.getFoldersByUserId(userId).stream()
                .map(Folder::getId).toList();
        List<Long> sharedHighlightIds = permissionRepo
                .findByUserIdAndResourceTypeAndStatus(userId, SharedLink.ResourceType.HIGHLIGHT, PermissionStatus.ACCEPTED)
                .stream().map(ResourcePermission::getResourceId).toList();

        return highlightRepo.searchHighlights(userId, accessibleFolderIds, sharedHighlightIds, q)
                .stream().map(this::toDTO).toList();
    }

    @Transactional
    @PostMapping
    public ResponseEntity<HighlightDTO> create(Authentication auth,
                                                @RequestBody HighlightDTO dto) {
        User user = resolveUser(auth);
        Highlight h = fromDTO(dto, user);
        h.setId(null); // Always use IDENTITY auto-increment for new highlights; ignore any client id
        if (dto.tagIds != null) {
            applyTags(h, dto.tagIds, user);
        }

        highlightRepo.save(h);
        HighlightDTO saved = toDTO(h);

        if (h.getFolderId() != null && ("pro".equals(user.getTier()) || "premium".equals(user.getTier()) || "team".equals(user.getTier()))) {
            triggerFolderSynthesis(java.util.Objects.requireNonNull(h.getFolderId()));
        }

        referralService.processReferralForNewHighlight(user);

        // Notify folder members of the new highlight
        Long folderId = h.getFolderId();
        if (folderId != null) {
            folderRepo.findById(java.util.Objects.requireNonNull(folderId)).ifPresent(f -> {
                notificationService.notifyAllFolderMembers(
                    user, f, h, "added a highlight", h.getText(), "HIGHLIGHT_MODIFIED"
                );
            });
        }

        // Notify THE OWNER's connected clients (extension, other tabs)
        webSocketService.sendToUser(auth.getName(), "/topic/highlights", saved);

        // Notify ALL FOLDER MEMBERS via real-time broadcast for immediate UI refresh
        if (folderId != null) {
            notificationService.broadcastResourceActivity("folder", java.util.Objects.requireNonNull(folderId), "HIGHLIGHT_ADDED", saved);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @Transactional
    @PutMapping("/{id}")
    @PreAuthorize("@securityService.hasHighlightAccess(#id, 'EDITOR')")
    public HighlightDTO update(Authentication auth,
                               @PathVariable long id,
                               @RequestBody HighlightDTO dto) {
        User user = resolveUser(auth);
        Highlight h = highlightRepo.findById(id)
                .filter(hl -> !hl.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        applyDTO(h, dto, user);
        if (dto.tagIds != null) {
            applyTags(h, dto.tagIds, user);
        }

        final Highlight toSave = highlightRepo.save(h);
        HighlightDTO updated = toDTO(toSave);
        webSocketService.sendToUser(auth.getName(), "/topic/highlights/updated", updated);

        // Real-time broadcast to anyone viewing THIS highlight
        notificationService.broadcastResourceActivity("highlight", id, "HIGHLIGHT_UPDATED", updated);

        // Real-time broadcast to the parent FOLDER for grid/sidebar sync
        if (h.getFolderId() != null) {
            notificationService.broadcastResourceActivity("folder", java.util.Objects.requireNonNull(h.getFolderId()), "HIGHLIGHT_UPDATED", updated);
        }

        // Notify all folder members of the update
        if (h.getFolderId() != null) {
            folderRepo.findById(java.util.Objects.requireNonNull(h.getFolderId())).ifPresent(f -> {
                notificationService.notifyAllFolderMembers(
                    user, f, h, "edited a highlight", h.getText(), "HIGHLIGHT_MODIFIED"
                );
            });
        }

        return updated;
    }

    @Transactional
    @PatchMapping("/{id}")
    @PreAuthorize("@securityService.hasHighlightAccess(#id, 'EDITOR')")
    public HighlightDTO patch(Authentication auth,
                              @PathVariable Long id,
                              @RequestBody HighlightDTO dto) {
        User user = resolveUser(auth);
        Highlight h = highlightRepo.findById(id)
                .filter(hl -> !hl.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        applyDTO(h, dto, user);
        if (dto.tagIds != null) {
            applyTags(h, dto.tagIds, user);
        }

        final Highlight toSave = highlightRepo.save(h);
        HighlightDTO patched = toDTO(toSave);
        webSocketService.sendToUser(auth.getName(), "/topic/highlights/updated", patched);

        // Real-time broadcast to anyone viewing THIS highlight
        notificationService.broadcastResourceActivity("highlight", id, "HIGHLIGHT_UPDATED", patched);
        
        // Real-time broadcast to the parent FOLDER for grid/sidebar sync
        if (h.getFolderId() != null) {
            notificationService.broadcastResourceActivity("folder", java.util.Objects.requireNonNull(h.getFolderId()), "HIGHLIGHT_UPDATED", patched);
        }

        // Notify all folder members of the update
        if (h.getFolderId() != null) {
            folderRepo.findById(java.util.Objects.requireNonNull(h.getFolderId())).ifPresent(f -> {
                notificationService.notifyAllFolderMembers(
                    user, f, h, "patched a highlight", h.getText(), "HIGHLIGHT_MODIFIED"
                );
            });
        }

        return patched;
    }

    @PostMapping("/{id}/restore")
    @Transactional
    @PreAuthorize("@securityService.hasHighlightAccess(#id, 'EDITOR')")
    public ResponseEntity<HighlightDTO> restore(Authentication auth, @PathVariable Long id) {
        Long userId = Long.parseLong(auth.getName());
        Highlight h = highlightRepo.findById(java.util.Objects.requireNonNull(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (h.isDeleted() && h.getUser().getId().equals(userId)) {
            // Owner restoring globally deleted
            h.setDeleted(false);
            h.setDeletedByUserId(null);
            h.setDeletedAt(null);
            highlightRepo.save(h);
        } else {
            // Non-owner unhiding
            highlightRepo.unhideHighlight(id, userId);
        }

        HighlightDTO restored = toDTO(h);
        webSocketService.sendToUser(auth.getName(), "/topic/highlights/updated", restored);
        notificationService.broadcastResourceActivity("highlight", id, "HIGHLIGHT_RESTORED", restored);
        
        if (h.getFolderId() != null) {
            triggerFolderSynthesis(java.util.Objects.requireNonNull(h.getFolderId()));
            notificationService.broadcastResourceActivity("folder", java.util.Objects.requireNonNull(h.getFolderId()), "HIGHLIGHT_RESTORED", restored);
        }

        return ResponseEntity.ok(restored);
    }

    @DeleteMapping("/{id}")
    @Transactional
    @PreAuthorize("@securityService.hasHighlightAccess(#id, 'EDITOR')")
    public ResponseEntity<Map<String, Boolean>> delete(Authentication auth,
                                                        @PathVariable long id) {
        Long userId = Long.parseLong(auth.getName());
        User user = resolveUser(auth);
        Highlight h = highlightRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (h.getUser().getId().equals(userId)) {
            // Owner deletion: mark as globally deleted
            h.setDeleted(true);
            h.setDeletedByUserId(userId);
            h.setDeletedAt(java.time.Instant.now());
            highlightRepo.save(h);
        } else {
            // Editor deletion in shared folder: hide it for this user only
            h.getHiddenByUsers().add(user);
            highlightRepo.save(h);
        }

        // Re-trigger synthesis for the folder
        if (h.getFolderId() != null) {
            triggerFolderSynthesis(h.getFolderId());
        }

        // Notify connected clients to remove this highlight
        webSocketService.sendToUser(auth.getName(), "/topic/highlights/deleted", id);
        
        // Real-time broadcast for highlight deletion (triggers redirect for readers)
        notificationService.broadcastResourceActivity("highlight", id, "HIGHLIGHT_DELETED", Map.of("id", id));
        
        // Real-time broadcast for folder grid removal
        if (h.getFolderId() != null) {
            notificationService.broadcastResourceActivity("folder", java.util.Objects.requireNonNull(h.getFolderId()), "HIGHLIGHT_DELETED", Map.of("id", id));
        }

        return ResponseEntity.ok(Map.of("ok", true));
    }

    // Batch sync: accept full array, reconcile with DB
    @PutMapping("/sync")
    @Transactional
    public List<HighlightDTO> sync(Authentication auth,
                                   @RequestBody List<HighlightDTO> dtos) {
        User user = resolveUser(auth);
        Long userId = user.getId();

        List<Long> accessibleFolderIds = folderService.getFoldersByUserId(userId).stream()
                .map(Folder::getId)
                .toList();

        // 2. Get all DIRECTLY shared highlights (ResourcePermission.HIGHLIGHT)
        List<Long> sharedHighlightIds = permissionRepo
                .findByUserIdAndResourceTypeAndStatus(userId, SharedLink.ResourceType.HIGHLIGHT, PermissionStatus.ACCEPTED)
                .stream().map(ResourcePermission::getResourceId).toList();

        // 3. Get all highlights (including deleted) for initial state
        Map<Long, Highlight> existing = new java.util.HashMap<>();
        List<Highlight> initialSearchBase;
        if (accessibleFolderIds.isEmpty() && sharedHighlightIds.isEmpty()) {
            initialSearchBase = highlightRepo.findAllByUserIdInclandDeleted(userId);
        } else {
            initialSearchBase = highlightRepo.findAllByUserIdOrFolderIdsInclandDeleted(userId, accessibleFolderIds);
            if (!sharedHighlightIds.isEmpty()) {
                List<Highlight> directlyShared = highlightRepo.findAllById(sharedHighlightIds);
                Set<Long> existingIds = initialSearchBase.stream().map(Highlight::getId).collect(Collectors.toSet());
                initialSearchBase = new ArrayList<>(initialSearchBase);
                for (Highlight h : directlyShared) {
                    if (!existingIds.contains(h.getId())) {
                        initialSearchBase.add(h);
                    }
                }
            }
        }
        initialSearchBase.forEach(h -> existing.put(h.getId(), h));

        Set<Long> incomingIds = new HashSet<>();
        boolean hasNewHighlight = false;

        for (HighlightDTO dto : dtos) {
            incomingIds.add(dto.id);
            Highlight h = existing.get(dto.id);
            if (h == null) {
                // New highlight from client
                h = fromDTO(dto, user);
                h.setId(null); // Ensure IDENTITY auto-generation
                if (dto.tagIds != null) {
                    applyTags(h, dto.tagIds, user);
                }

                highlightRepo.save(h);
                hasNewHighlight = true;
            } else {
                // Skip updating if user does not have EDITOR access to this existing highlight
                if (!securityService.hasHighlightAccess(h.getId(), "EDITOR")) {
                    continue;
                }

                // Update existing (including soft delete status)
                applyDTO(h, dto, user);
                if (dto.tagIds != null) {
                    applyTags(h, dto.tagIds, user);
                }

                highlightRepo.save(h);
            }
        }

        if (hasNewHighlight) {
            referralService.processReferralForNewHighlight(user);
        }

        // AI Feature 3: Synthesize updated folders
        dtos.stream().filter(d -> d.folderId != null).map(d -> d.folderId).distinct().forEach(folderId -> {
            if ("pro".equals(user.getTier()) || "premium".equals(user.getTier()) || "team".equals(user.getTier())) {
                triggerFolderSynthesis(folderId);
            }
        });

        // Return all highlights (including soft-deleted ones) so client can sync its full state
        List<Highlight> finalHighlights;
        if (accessibleFolderIds.isEmpty() && sharedHighlightIds.isEmpty()) {
            finalHighlights = highlightRepo.findAllByUserIdInclandDeleted(userId);
        } else {
            finalHighlights = highlightRepo.findAllByUserIdOrFolderIdsInclandDeleted(userId, accessibleFolderIds);
            if (!sharedHighlightIds.isEmpty()) {
                List<Highlight> directlyShared = highlightRepo.findAllById(sharedHighlightIds);
                Set<Long> existingIds = finalHighlights.stream().map(Highlight::getId).collect(Collectors.toSet());
                finalHighlights = new ArrayList<>(finalHighlights);
                for (Highlight h : directlyShared) {
                    if (!existingIds.contains(h.getId())) {
                        finalHighlights.add(h);
                    }
                }
            }
        }
        return finalHighlights.stream().map(this::toDTO).toList();
    }

    // ── Helpers ──

    private void triggerFolderSynthesis(Long folderId) {
        folderRepo.findById(folderId).ifPresent(folder -> {
            List<Highlight> highlights = highlightRepo.findByFolderIdAndNotDeleted(folderId);
            if (highlights.isEmpty()) return;

            String texts = highlights.stream()
                    .map(Highlight::getText)
                    .collect(Collectors.joining("\n- "));

            String prompt = "You are a research assistant. Write a cohesive, single-paragraph 'Living Literature Review' that synthesizes the following highlights into a continuous, logical narrative. Do not list them; connect the central themes.\n\nHighlights:\n- " + texts;

            ollamaService.generate(prompt)
                .publishOn(Schedulers.boundedElastic())
                .subscribe(synthesis -> {
                    folder.setSynthesis(synthesis);
                    folderRepo.save(folder);
                }, error -> {});
        });
    }

    private User resolveUser(Authentication auth) {
        return userRepo.findById(Long.parseLong(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private HighlightDTO toDTO(Highlight h) {
        HighlightDTO dto = new HighlightDTO();
        dto.id = h.getId();
        dto.text = h.getText();
        dto.source = h.getSource();
        dto.url = h.getUrl();
        dto.topic = h.getTopic();
        dto.topicColor = h.getTopicColor();
        dto.savedAt = h.getSavedAt();
        dto.folderId = h.getFolderId();
        if (h.getFolderId() != null) {
            dto.folder = folderRepo.findById(h.getFolderId())
                    .map(Folder::getName)
                    .orElse(null);
        } else {
            dto.folder = null;
        }
        dto.note = h.getNote();
        
        // Populate full TagDTO objects so they are visible to all users (collaborative tagging)
        dto.tags = h.getHighlightTags().stream()
                .map(ht -> new TagDTO(
                    ht.getTag().getId(),
                    ht.getTag().getName(),
                    ht.getTag().getColor()
                ))
                .toList();

        dto.isCode = h.isCode();
        dto.isFavorite = h.isFavorite();
        dto.isArchived = h.isArchived();
        dto.isPinned = h.isPinned();
        dto.highlightColor = h.getHighlightColor();
        dto.isAI = h.isAI();
        dto.chatName = h.getChatName();
        dto.chatUrl = h.getChatUrl();
        dto.resourceType = h.getResourceType() != null ? h.getResourceType().name() : "TEXT";
        dto.videoTimestamp = h.getVideoTimestamp();
        dto.linkAccess = h.getLinkAccess() != null ? h.getLinkAccess().name() : "RESTRICTED";
        dto.defaultLinkRole = h.getDefaultLinkRole() != null ? h.getDefaultLinkRole().name() : "VIEWER";
        dto.isDeleted = h.isDeleted();
        return dto;
    }

    private Highlight fromDTO(HighlightDTO dto, User user) {
        Highlight h = new Highlight();
        if (dto.id != null) h.setId(dto.id);
        h.setUser(user);
        applyDTO(h, dto, user);
        return h;
    }

    private void applyDTO(Highlight h, HighlightDTO dto, User user) {
        if (dto.text != null) h.setText(dto.text);
        if (dto.source != null) h.setSource(dto.source);
        if (dto.url != null) h.setUrl(dto.url);
        if (dto.topic != null) h.setTopic(dto.topic);
        if (dto.topicColor != null) h.setTopicColor(dto.topicColor);
        if (dto.savedAt != null) h.setSavedAt(dto.savedAt);
        
        // folderId: null = not provided (don't touch), <=0 = clear/temp-id (treat as null),
        // >0 = only set if the folder actually exists (silently ignore stale/temp refs).
        if (dto.folderId != null) {
            if (dto.folderId <= 0L) {
                h.setFolderId(null);
            } else {
                // SECURITY: Verify user has access to target folder before moving
                if (!securityService.hasFolderAccess(dto.folderId, "EDITOR")) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Target folder access denied");
                }
                h.setFolderId(folderRepo.existsById(dto.folderId) ? dto.folderId : null);
            }
        }
        
        if (dto.note != null) h.setNote(dto.note);
        if (dto.highlightColor != null) h.setHighlightColor(dto.highlightColor);
        // Boolean wrapper fields: null means "not provided" → keep existing value
        if (dto.isCode != null) h.setCode(dto.isCode);
        if (dto.isFavorite != null) h.setFavorite(dto.isFavorite);
        if (dto.isArchived != null) h.setArchived(dto.isArchived);
        if (dto.isPinned != null) h.setPinned(dto.isPinned);
        if (dto.isAI != null) h.setAI(dto.isAI);
        if (dto.chatName != null) h.setChatName(dto.chatName);
        if (dto.chatUrl != null) h.setChatUrl(dto.chatUrl);
        if (dto.resourceType != null) {
            try {
                h.setResourceType(ResourceType.valueOf(dto.resourceType));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Invalid resourceType: " + dto.resourceType);
            }
        }
        if (dto.videoTimestamp != null) h.setVideoTimestamp(dto.videoTimestamp);
        // Handle link sharing settings
        if (dto.linkAccess != null) {
            try {
                h.setLinkAccess(LinkAccess.valueOf(dto.linkAccess));
            } catch (IllegalArgumentException e) {
                h.setLinkAccess(LinkAccess.RESTRICTED);
            }
        }
        if (dto.defaultLinkRole != null) {
            try {
                h.setDefaultLinkRole(AccessLevel.valueOf(dto.defaultLinkRole));
            } catch (IllegalArgumentException e) {
                h.setDefaultLinkRole(AccessLevel.VIEWER);
            }
        }
        // Handle soft deletion — only update if explicitly provided
        if (dto.isDeleted != null) {
            if (h.getUser().getId().equals(user.getId())) {
                h.setDeleted(dto.isDeleted);
                if (dto.isDeleted) {
                    h.setDeletedByUserId(user.getId());
                    h.setDeletedAt(java.time.Instant.now());
                } else {
                    h.setDeletedByUserId(null);
                    h.setDeletedAt(null);
                }
            } else if (dto.isDeleted) {
                // Non-owner trying to delete -> hide it for them
                h.getHiddenByUsers().add(user);
            }
        }
    }

    /**
     * Associates tags with a highlight.
     * If a tag ID doesn't exist for the user, creates it automatically.
     * Maintains data integrity by only linking user's own tags.
     */
    private void applyTags(Highlight h, List<String> tagIds, User user) {
        // null = field not provided in the request → don't touch existing tags
        // (critical for moveHighlight which only sends folderId)
        if (tagIds == null) return;

        // Collect the tags that belong to the current user
        List<HighlightTag> currentUserTags = new java.util.ArrayList<>();
        for (HighlightTag ht : h.getHighlightTags()) {
            if (ht.getTag().getUser().getId().equals(user.getId())) {
                currentUserTags.add(ht);
            }
        }

        // Delete existing tag associations for the current user from the collection
        if (!currentUserTags.isEmpty()) {
            h.getHighlightTags().removeAll(currentUserTags);
        }

        if (tagIds.isEmpty()) return;

        List<Long> parsedTagIds = new java.util.ArrayList<>();
        for (String tagIdStr : tagIds) {
            try {
                parsedTagIds.add(Long.parseLong(tagIdStr));
            } catch (NumberFormatException e) {
                // Skip non-numeric tag IDs
                continue;
            }
        }

        if (parsedTagIds.isEmpty()) return;

        // Fetch all existing tags belonging to the current user in a single query
        List<Tag> userTags = tagRepo.findByIdInAndUserId(parsedTagIds, user.getId());

        // Link fetched tags to highlight via junction table
        for (Tag tag : userTags) {
            h.getHighlightTags().add(new HighlightTag(h, tag));
        }
    }

    // Removed nested HighlightDTO class (moved to com.cortex.api.dto.HighlightDTO)
}
