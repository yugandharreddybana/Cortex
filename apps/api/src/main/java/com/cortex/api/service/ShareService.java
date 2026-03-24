package com.cortex.api.service;

import com.cortex.api.entity.Folder;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.HighlightTag;
import com.cortex.api.entity.SharedLink;
import com.cortex.api.entity.User;
import com.cortex.api.entity.UserSharedView;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.SharedLinkRepository;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.repository.UserSharedViewRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ShareService {

    private static final String AI_REDACTION_PREFIX =
            "[🔒 Private AI Highlight: Source link omitted for privacy.] ";

    private static final List<String> AI_URL_PATTERNS = List.of(
            "chatgpt.com", "claude.ai", "gemini.google.com"
    );

    private final SharedLinkRepository sharedLinkRepo;
    private final UserSharedViewRepository sharedViewRepo;
    private final HighlightRepository highlightRepo;
    private final FolderRepository folderRepo;
    private final UserRepository userRepo;

    public ShareService(SharedLinkRepository sharedLinkRepo,
                        UserSharedViewRepository sharedViewRepo,
                        HighlightRepository highlightRepo,
                        FolderRepository folderRepo,
                        UserRepository userRepo) {
        this.sharedLinkRepo = sharedLinkRepo;
        this.sharedViewRepo = sharedViewRepo;
        this.highlightRepo = highlightRepo;
        this.folderRepo = folderRepo;
        this.userRepo = userRepo;
    }

    // ── Create or return existing share link ─────────────────────────────────

    public SharedLink createShareLink(User user, SharedLink.ResourceType type, Long resourceId) {
        // Verify ownership
        verifyOwnership(user, type, resourceId);

        // Reuse existing link for same resource/user combo
        return sharedLinkRepo
                .findByResourceTypeAndResourceIdAndCreatedById(type, resourceId, user.getId())
                .orElseGet(() -> {
                    SharedLink link = new SharedLink();
                    link.setUniqueHash(UUID.randomUUID().toString());
                    link.setResourceType(type);
                    link.setResourceId(resourceId);
                    link.setCreatedBy(user);
                    return sharedLinkRepo.save(link);
                });
    }

    // ── Resolve a share link by hash ─────────────────────────────────────────

    public SharedLink resolveByHash(String hash) {
        return sharedLinkRepo.findByUniqueHash(hash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share link not found"));
    }

    // ── Build shared payload (with AI redaction) ─────────────────────────────

    @Transactional
    public Map<String, Object> buildSharedPayload(SharedLink link) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("hash", link.getUniqueHash());
        payload.put("resourceType", link.getResourceType().name());
        payload.put("sharedBy", link.getCreatedBy().getEmail());
        payload.put("sharedAt", link.getCreatedAt().toString());

        if (link.getResourceType() == SharedLink.ResourceType.HIGHLIGHT) {
            Highlight h = highlightRepo.findById(link.getResourceId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            payload.put("highlight", redactHighlight(h));
        } else {
            Long ownerId = link.getCreatedBy().getId();
            Folder root = folderRepo.findByIdAndUserId(link.getResourceId(), ownerId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            payload.put("folder", buildFolderPayload(root, ownerId));
        }

        return payload;
    }

    // ── "Just view" — save a read-only reference ─────────────────────────────

    public void saveView(User viewer, SharedLink link) {
        if (sharedViewRepo.findByUserIdAndSharedLinkId(viewer.getId(), link.getId()).isPresent()) {
            return; // already saved
        }
        UserSharedView view = new UserSharedView();
        view.setUser(viewer);
        view.setSharedLink(link);
        sharedViewRepo.save(view);
    }

    // ── "Add to my library" — deep copy ──────────────────────────────────────

    @Transactional
    public void deepCopyToLibrary(User receiver, SharedLink link) {
        if (link.getResourceType() == SharedLink.ResourceType.HIGHLIGHT) {
            Highlight src = highlightRepo.findById(link.getResourceId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            cloneHighlight(src, receiver, null, null);
        } else {
            Long ownerId = link.getCreatedBy().getId();
            Folder root = folderRepo.findByIdAndUserId(link.getResourceId(), ownerId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            deepCopyFolder(root, null, receiver, ownerId);
        }
    }

    // ── List shares received by user ─────────────────────────────────────────

    @Transactional
    public List<Map<String, Object>> listSharedWithMe(User user) {
        List<UserSharedView> views = sharedViewRepo.findByUserIdOrderByCreatedAtDesc(user.getId());
        List<Map<String, Object>> result = new ArrayList<>();
        for (UserSharedView v : views) {
            SharedLink link = v.getSharedLink();
            Map<String, Object> item = new HashMap<>();
            item.put("viewId", v.getId().toString());
            item.put("hash", link.getUniqueHash());
            item.put("resourceType", link.getResourceType().name());
            item.put("resourceId", link.getResourceId());
            item.put("sharedBy", link.getCreatedBy().getEmail());
            item.put("sharedAt", link.getCreatedAt().toString());
            item.put("viewedAt", v.getCreatedAt().toString());

            // Add a preview label
            if (link.getResourceType() == SharedLink.ResourceType.HIGHLIGHT) {
                highlightRepo.findById(link.getResourceId())
                        .ifPresent(h -> item.put("preview", h.getText().length() > 80
                                ? h.getText().substring(0, 80) + "…" : h.getText()));
            } else {
                folderRepo.findById(link.getResourceId())
                        .ifPresent(f -> item.put("preview", f.getEmoji() + " " + f.getName()));
            }

            result.add(item);
        }
        return result;
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    // ── Build resource payload (for collaboration workspace) ─────────────────

    @Transactional
    public Map<String, Object> buildResourcePayload(Long resourceId, SharedLink.ResourceType type) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("resourceType", type.name());

        if (type == SharedLink.ResourceType.HIGHLIGHT) {
            Highlight h = highlightRepo.findById(resourceId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            payload.put("highlight", redactHighlight(h));
            payload.put("sharedBy", h.getUser().getEmail());
        } else {
            Folder root = folderRepo.findById(resourceId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            Long ownerId = root.getUser().getId();
            payload.put("folder", buildFolderPayload(root, ownerId));
            payload.put("sharedBy", root.getUser().getEmail());
        }

        return payload;
    }

    // ── Original internal helpers ────────────────────────────────────────────

    private void verifyOwnership(User user, SharedLink.ResourceType type, Long resourceId) {
        if (type == SharedLink.ResourceType.HIGHLIGHT) {
            highlightRepo.findByIdAndUserId(resourceId, user.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your highlight"));
        } else {
            folderRepo.findByIdAndUserId(resourceId, user.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your folder"));
        }
    }

    /** Build a folder payload including sub-folders and highlights (all redacted) */
    private Map<String, Object> buildFolderPayload(Folder folder, Long ownerId) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", folder.getId());
        m.put("name", folder.getName());
        m.put("emoji", folder.getEmoji());

        // Highlights in this folder
        List<Map<String, Object>> highlights = highlightRepo
                .findByUserIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(h -> folder.getId().equals(h.getFolderId()))
                .map(this::redactHighlight)
                .toList();
        m.put("highlights", highlights);

        // Sub-folders (recursive)
        List<Map<String, Object>> subFolders = folderRepo.findByUserId(ownerId).stream()
                .filter(f -> folder.getId().equals(f.getParentFolder() != null ? f.getParentFolder().getId() : null))
                .map(f -> buildFolderPayload(f, ownerId))
                .toList();
        m.put("subFolders", subFolders);

        return m;
    }

    /** AI redaction — strips URL + prepends note for AI highlights */
    private Map<String, Object> redactHighlight(Highlight h) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", h.getId());
        m.put("text", h.getText());
        m.put("source", h.getSource());
        m.put("topic", h.getTopic());
        m.put("topicColor", h.getTopicColor());
        m.put("savedAt", h.getSavedAt());
        m.put("isCode", h.isCode());
        m.put("highlightColor", h.getHighlightColor());
        m.put("isAI", h.isAI());

        boolean needsRedaction = h.isAI() || isAiUrl(h.getUrl()) || isAiUrl(h.getChatUrl());

        if (needsRedaction) {
            m.put("url", null);
            m.put("chatUrl", null);
            m.put("chatName", h.getChatName());
            String note = h.getNote() != null ? h.getNote() : "";
            m.put("note", AI_REDACTION_PREFIX + note);
        } else {
            m.put("url", h.getUrl());
            m.put("chatUrl", h.getChatUrl());
            m.put("chatName", h.getChatName());
            m.put("note", h.getNote());
        }

        return m;
    }

    private boolean isAiUrl(String url) {
        if (url == null || url.isBlank()) return false;
        String lower = url.toLowerCase();
        return AI_URL_PATTERNS.stream().anyMatch(lower::contains);
    }

    /** Deep copy a folder tree (recursive) */
    private void deepCopyFolder(Folder src, Long newParentId, User receiver, Long ownerId) {
        Folder copy = new Folder();
        copy.setUser(receiver);
        copy.setName(src.getName());
        copy.setEmoji(src.getEmoji());
        
        // Set parent folder by ID lookup
        if (newParentId != null) {
            Folder parentFolder = folderRepo.findById(newParentId).orElse(null);
            copy.setParentFolder(parentFolder);
        }
        
        copy.setPinned(false);
        Folder savedCopy = folderRepo.save(copy);

        // Copy highlights in this folder
        List<Highlight> highlightsToClone = highlightRepo.findByUserIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(h -> src.getId().equals(h.getFolderId()))
                .map(h -> prepareHighlightClone(h, receiver, savedCopy.getId(), savedCopy.getName()))
                .toList();

        if (!highlightsToClone.isEmpty()) {
            highlightRepo.saveAll(highlightsToClone);
        }

        // Recurse sub-folders
        folderRepo.findByUserId(ownerId).stream()
                .filter(f -> src.getId().equals(f.getParentFolder() != null ? f.getParentFolder().getId() : null))
                .forEach(f -> deepCopyFolder(f, savedCopy.getId(), receiver, ownerId));
    }

    /** Prepare a single highlight for cloning for a different user */
    private Highlight prepareHighlightClone(Highlight src, User receiver, Long folderId, String folderName) {
        Highlight copy = new Highlight();
        copy.setUser(receiver);
        copy.setText(src.getText());
        copy.setSource(src.getSource());
        copy.setUrl(src.getUrl());
        copy.setTopic(src.getTopic());
        copy.setTopicColor(src.getTopicColor());
        copy.setSavedAt(src.getSavedAt());
        // Set folder by ID lookup
        if (folderId != null) {
            Folder folder = folderRepo.findById(folderId).orElse(null);
            copy.setFolder(folder);
        }
        copy.setFolderId(folderId);
        copy.setNote(src.getNote());
        // Copy tags: create new HighlightTag objects referencing the copy, not src
        for (HighlightTag ht : src.getHighlightTags()) {
            copy.getHighlightTags().add(new HighlightTag(copy, ht.getTag()));
        }
        copy.setCode(src.isCode());
        copy.setFavorite(false);
        copy.setArchived(false);
        copy.setPinned(false);
        copy.setHighlightColor(src.getHighlightColor());
        copy.setAI(src.isAI());
        copy.setChatName(src.getChatName());
        copy.setChatUrl(src.getChatUrl());
        return copy;
    }
}
