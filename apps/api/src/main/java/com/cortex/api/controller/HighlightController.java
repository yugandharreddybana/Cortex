package com.cortex.api.controller;

import com.cortex.api.entity.AccessLevel;
import com.cortex.api.entity.Folder;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.HighlightTag;
import com.cortex.api.entity.LinkAccess;
import com.cortex.api.entity.ResourceType;
import com.cortex.api.entity.Tag;
import com.cortex.api.entity.User;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.HighlightTagRepository;
import com.cortex.api.repository.TagRepository;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.service.OllamaService;
import com.cortex.api.service.WebSocketService;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.scheduler.Schedulers;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/highlights")
public class HighlightController {

    private final HighlightRepository highlightRepo;
    private final UserRepository userRepo;
    private final TagRepository tagRepo;
    private final HighlightTagRepository highlightTagRepo;
    private final FolderRepository folderRepo;
    private final WebSocketService webSocketService;
    private final com.cortex.api.service.FolderService folderService;
    private final com.cortex.api.service.SecurityService securityService;
    private final OllamaService ollamaService;
    private final com.cortex.api.service.ReferralService referralService;

    public HighlightController(HighlightRepository highlightRepo, UserRepository userRepo,
                               TagRepository tagRepo, HighlightTagRepository highlightTagRepo,
                               FolderRepository folderRepo,
                               WebSocketService webSocketService,
                               com.cortex.api.service.FolderService folderService,
                               com.cortex.api.service.SecurityService securityService,
                               OllamaService ollamaService,
                               com.cortex.api.service.ReferralService referralService) {
        this.highlightRepo = highlightRepo;
        this.userRepo = userRepo;
        this.tagRepo = tagRepo;
        this.highlightTagRepo = highlightTagRepo;
        this.folderRepo = folderRepo;
        this.webSocketService = webSocketService;
        this.folderService = folderService;
        this.securityService = securityService;
        this.ollamaService = ollamaService;
        this.referralService = referralService;
    }

    @Transactional
    @GetMapping
    public List<HighlightDTO> list(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        List<Long> accessibleFolderIds = folderService.getFoldersByUserId(userId).stream()
                .map(Folder::getId)
                .toList();

        if (accessibleFolderIds.isEmpty()) {
            return highlightRepo.findByUserIdOrderByCreatedAtDesc(userId)
                    .stream().map(this::toDTO).toList();
        }

        return highlightRepo.findByUserIdOrFolderIdsOrderByCreatedAtDesc(userId, accessibleFolderIds)
                .stream().map(this::toDTO).toList();
    }

    @Transactional
    @PostMapping
    public ResponseEntity<HighlightDTO> create(Authentication auth,
                                                @RequestBody HighlightDTO dto) {
        User user = resolveUser(auth);
        Highlight h = fromDTO(dto, user);
        h.setId(null); // Always use IDENTITY auto-increment for new highlights; ignore any client id
        applyTags(h, dto.tags, user);
        highlightRepo.save(h);
        HighlightDTO saved = toDTO(h);

        if (h.getFolderId() != null && ("pro".equals(user.getTier()) || "premium".equals(user.getTier()) || "team".equals(user.getTier()))) {
            triggerFolderSynthesis(h.getFolderId());
        }

        referralService.processReferralForNewHighlight(user);

        // Notify the owning user's connected clients (extension, other tabs)
        webSocketService.sendToUser(auth.getName(), "/topic/highlights", saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @Transactional
    @PutMapping("/{id}")
    @PreAuthorize("@securityService.hasHighlightAccess(#id, 'EDITOR')")
    public HighlightDTO update(Authentication auth,
                               @PathVariable Long id,
                               @RequestBody HighlightDTO dto) {
        User user = resolveUser(auth);
        Highlight h = highlightRepo.findById(id)
                .filter(hl -> !hl.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        applyDTO(h, dto, user);
        applyTags(h, dto.tags, user);
        highlightRepo.save(h);
        HighlightDTO updated = toDTO(h);
        webSocketService.sendToUser(auth.getName(), "/topic/highlights/updated", updated);
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
        applyTags(h, dto.tags, user);
        highlightRepo.save(h);
        HighlightDTO patched = toDTO(h);
        webSocketService.sendToUser(auth.getName(), "/topic/highlights/updated", patched);
        return patched;
    }

    @DeleteMapping("/{id}")
    @Transactional
    @PreAuthorize("@securityService.hasHighlightAccess(#id, 'EDITOR')")
    public ResponseEntity<Map<String, Boolean>> delete(Authentication auth,
                                                        @PathVariable Long id) {
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

        // Notify connected clients to remove this highlight
        webSocketService.sendToUser(auth.getName(), "/topic/highlights/deleted", id);
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

        // Get all highlights (including deleted) for initial state
        Map<Long, Highlight> existing = new java.util.HashMap<>();
        if (accessibleFolderIds.isEmpty()) {
            highlightRepo.findAllByUserIdInclandDeleted(userId)
                    .forEach(h -> existing.put(h.getId(), h));
        } else {
            highlightRepo.findAllByUserIdOrFolderIdsInclandDeleted(userId, accessibleFolderIds)
                    .forEach(h -> existing.put(h.getId(), h));
        }

        java.util.Set<Long> incomingIds = new java.util.HashSet<>();
        boolean hasNewHighlight = false;

        for (HighlightDTO dto : dtos) {
            incomingIds.add(dto.id);
            Highlight h = existing.get(dto.id);
            if (h == null) {
                // New highlight from client
                h = fromDTO(dto, user);
                h.setId(null); // Ensure IDENTITY auto-generation
                applyTags(h, dto.tags, user);
                highlightRepo.save(h);
                hasNewHighlight = true;
            } else {
                // Skip updating if user does not have EDITOR access to this existing highlight
                if (!securityService.hasHighlightAccess(h.getId(), "EDITOR")) {
                    continue;
                }

                // Update existing (including soft delete status)
                applyDTO(h, dto, user);
                applyTags(h, dto.tags, user);
                highlightRepo.save(h);
            }
        }

        if (hasNewHighlight) {
            referralService.processReferralForNewHighlight(user);
        }

        // Upsert only — do NOT delete server highlights missing from the payload.
        // The client may send a partial set (e.g. offline-created items only).

        // AI Feature 3: Synthesize updated folders
        dtos.stream().filter(d -> d.folderId != null).map(d -> d.folderId).distinct().forEach(folderId -> {
            if ("pro".equals(user.getTier()) || "premium".equals(user.getTier()) || "team".equals(user.getTier())) {
                triggerFolderSynthesis(folderId);
            }
        });

        // Return all highlights (including soft-deleted ones) so client can sync its full state
        if (accessibleFolderIds.isEmpty()) {
            return highlightRepo.findAllByUserIdInclandDeleted(userId)
                    .stream().map(this::toDTO).toList();
        } else {
            return highlightRepo.findAllByUserIdOrFolderIdsInclandDeleted(userId, accessibleFolderIds)
                    .stream().map(this::toDTO).toList();
        }
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
        // Look up folder name directly from DB using folderId — avoids the stale
        // lazy @ManyToOne proxy that remains set to the OLD folder after setFolderId().
        dto.folderId = h.getFolderId();
        if (h.getFolderId() != null) {
            dto.folder = folderRepo.findById(h.getFolderId())
                    .map(Folder::getName)
                    .orElse(null);
        } else {
            dto.folder = null;
        }
        dto.note = h.getNote();
        // Extract tag IDs from the junction table
        dto.tags = h.getHighlightTags().stream()
                .map(ht -> String.valueOf(ht.getTag().getId()))
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

        // Delete existing tag associations for the current user from the database
        if (!currentUserTags.isEmpty()) {
            highlightTagRepo.deleteAll(currentUserTags);
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

    public static class HighlightDTO {
        public Long id;
        public String text;
        public String source;
        public String url;
        public String topic;
        public String topicColor;
        public String savedAt;
        public String folder;
        public Long folderId;
        public String note;
        public List<String> tags;
        // Use Boolean wrappers (not primitives) so Jackson deserializes missing
        // fields as null — preventing false-overwrite on partial updates (e.g.
        // moveHighlight only sends folderId, so all booleans should stay untouched).
        public Boolean isCode;
        public Boolean isFavorite;
        public Boolean isArchived;
        public Boolean isPinned;
        public String highlightColor;
        public Boolean isAI;
        public String chatName;
        public String chatUrl;
        public String resourceType;
        public Integer videoTimestamp;
        public String linkAccess;      // RESTRICTED, PUBLIC
        public String defaultLinkRole; // VIEWER, COMMENTER, EDITOR
        // Soft deletion support
        public Boolean isDeleted;     // Whether the highlight is soft-deleted
    }
}
