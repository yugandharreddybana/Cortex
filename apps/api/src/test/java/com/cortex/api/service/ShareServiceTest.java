package com.cortex.api.service;

import com.cortex.api.entity.Folder;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.HighlightTag;
import com.cortex.api.entity.SharedLink;
import com.cortex.api.entity.Tag;
import com.cortex.api.entity.User;
import com.cortex.api.entity.UserSharedView;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.SharedLinkRepository;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.repository.UserSharedViewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ShareServiceTest {

    @Mock private SharedLinkRepository sharedLinkRepo;
    @Mock private UserSharedViewRepository sharedViewRepo;
    @Mock private HighlightRepository highlightRepo;
    @Mock private FolderRepository folderRepo;
    @Mock private UserRepository userRepo;

    @InjectMocks
    private ShareService shareService;

    private User owner;
    private User viewer;
    private Highlight highlight;
    private Folder folder;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(1L);
        owner.setEmail("owner@example.com");

        viewer = new User();
        viewer.setId(2L);
        viewer.setEmail("viewer@example.com");

        highlight = new Highlight();
        highlight.setId(10L);
        highlight.setUser(owner);
        highlight.setText("Test highlight text");
        highlight.setUrl("https://example.com/source");

        folder = new Folder();
        folder.setId(20L);
        folder.setUser(owner);
        folder.setName("Test Folder");
    }

    // ── Create Share Link ──────────────────────────────────────────────────

    @Test
    @DisplayName("Create share link for highlight (new link)")
    void testCreateShareLink_Highlight_Success() {
        when(highlightRepo.findByIdAndUserId(10L, 1L)).thenReturn(Optional.of(highlight));
        when(sharedLinkRepo.findByResourceTypeAndResourceIdAndCreatedById(SharedLink.ResourceType.HIGHLIGHT, 10L, 1L))
                .thenReturn(Optional.empty());

        SharedLink savedLink = new SharedLink();
        savedLink.setId(100L);
        when(sharedLinkRepo.save(any(SharedLink.class))).thenReturn(savedLink);

        SharedLink result = shareService.createShareLink(owner, SharedLink.ResourceType.HIGHLIGHT, 10L);

        assertEquals(100L, result.getId());
        verify(sharedLinkRepo, times(1)).save(any(SharedLink.class));
    }

    @Test
    @DisplayName("Create share link for folder (existing link)")
    void testCreateShareLink_Folder_Existing() {
        when(folderRepo.findByIdAndUserId(20L, 1L)).thenReturn(Optional.of(folder));

        SharedLink existingLink = new SharedLink();
        existingLink.setId(200L);
        when(sharedLinkRepo.findByResourceTypeAndResourceIdAndCreatedById(SharedLink.ResourceType.FOLDER, 20L, 1L))
                .thenReturn(Optional.of(existingLink));

        SharedLink result = shareService.createShareLink(owner, SharedLink.ResourceType.FOLDER, 20L);

        assertEquals(200L, result.getId());
        verify(sharedLinkRepo, never()).save(any(SharedLink.class));
    }

    @Test
    @DisplayName("Create share link fails if not owner")
    void testCreateShareLink_NotOwner() {
        when(highlightRepo.findByIdAndUserId(10L, 2L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            shareService.createShareLink(viewer, SharedLink.ResourceType.HIGHLIGHT, 10L);
        });

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertEquals("Not your highlight", ex.getReason());
    }

    // ── Resolve by Hash ────────────────────────────────────────────────────

    @Test
    @DisplayName("Resolve link by valid hash")
    void testResolveByHash_Success() {
        String hash = "valid-hash";
        SharedLink link = new SharedLink();
        link.setUniqueHash(hash);
        when(sharedLinkRepo.findByUniqueHash(hash)).thenReturn(Optional.of(link));

        SharedLink result = shareService.resolveByHash(hash);
        assertEquals(hash, result.getUniqueHash());
    }

    @Test
    @DisplayName("Resolve link by invalid hash throws 404")
    void testResolveByHash_NotFound() {
        String hash = "invalid-hash";
        when(sharedLinkRepo.findByUniqueHash(hash)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            shareService.resolveByHash(hash);
        });
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    // ── Build Shared Payload ───────────────────────────────────────────────

    @Test
    @DisplayName("Build shared payload for standard highlight")
    void testBuildSharedPayload_Highlight() {
        SharedLink link = new SharedLink();
        link.setResourceType(SharedLink.ResourceType.HIGHLIGHT);
        link.setResourceId(10L);
        link.setCreatedBy(owner);
        link.setCreatedAt(Instant.now());
        link.setUniqueHash("hash-hl");

        when(highlightRepo.findById(10L)).thenReturn(Optional.of(highlight));

        Map<String, Object> payload = shareService.buildSharedPayload(link);

        assertEquals("hash-hl", payload.get("hash"));
        assertEquals("HIGHLIGHT", payload.get("resourceType"));
        assertEquals("owner@example.com", payload.get("sharedBy"));

        @SuppressWarnings("unchecked")
        Map<String, Object> hlMap = (Map<String, Object>) payload.get("highlight");
        assertNotNull(hlMap);
        assertEquals("Test highlight text", hlMap.get("text"));
        assertEquals("https://example.com/source", hlMap.get("url")); // standard URL retained
    }

    @Test
    @DisplayName("Build shared payload for AI highlight (redacts URL and prepends note)")
    void testBuildSharedPayload_AIHighlight() {
        SharedLink link = new SharedLink();
        link.setResourceType(SharedLink.ResourceType.HIGHLIGHT);
        link.setResourceId(11L);
        link.setCreatedBy(owner);
        link.setCreatedAt(Instant.now());

        Highlight aiHighlight = new Highlight();
        aiHighlight.setId(11L);
        aiHighlight.setText("AI generated text");
        aiHighlight.setUrl("https://chatgpt.com/c/123");
        aiHighlight.setAI(false); // test isAiUrl logic even if isAI is false
        aiHighlight.setNote("Original note");

        when(highlightRepo.findById(11L)).thenReturn(Optional.of(aiHighlight));

        Map<String, Object> payload = shareService.buildSharedPayload(link);

        @SuppressWarnings("unchecked")
        Map<String, Object> hlMap = (Map<String, Object>) payload.get("highlight");
        assertNull(hlMap.get("url")); // redacted
        assertTrue(((String) hlMap.get("note")).startsWith("[🔒 Private AI Highlight:"));
        assertTrue(((String) hlMap.get("note")).endsWith("Original note"));
    }

    @Test
    @DisplayName("Build shared payload for folder")
    void testBuildSharedPayload_Folder() {
        SharedLink link = new SharedLink();
        link.setResourceType(SharedLink.ResourceType.FOLDER);
        link.setResourceId(20L);
        link.setCreatedBy(owner);
        link.setCreatedAt(Instant.now());

        when(folderRepo.findByIdAndUserId(20L, 1L)).thenReturn(Optional.of(folder));
        when(highlightRepo.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(new ArrayList<>());
        when(folderRepo.findByUserId(1L)).thenReturn(new ArrayList<>());

        Map<String, Object> payload = shareService.buildSharedPayload(link);

        @SuppressWarnings("unchecked")
        Map<String, Object> fMap = (Map<String, Object>) payload.get("folder");
        assertNotNull(fMap);
        assertEquals(20L, fMap.get("id"));
        assertEquals("Test Folder", fMap.get("name"));
    }

    // ── Save View ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("Save new view creates a UserSharedView")
    void testSaveView_New() {
        SharedLink link = new SharedLink();
        link.setId(100L);

        when(sharedViewRepo.findByUserIdAndSharedLinkId(viewer.getId(), link.getId()))
                .thenReturn(Optional.empty());

        shareService.saveView(viewer, link);

        verify(sharedViewRepo, times(1)).save(any(UserSharedView.class));
    }

    @Test
    @DisplayName("Save view ignores if already exists")
    void testSaveView_AlreadyExists() {
        SharedLink link = new SharedLink();
        link.setId(100L);

        when(sharedViewRepo.findByUserIdAndSharedLinkId(viewer.getId(), link.getId()))
                .thenReturn(Optional.of(new UserSharedView()));

        shareService.saveView(viewer, link);

        verify(sharedViewRepo, never()).save(any(UserSharedView.class));
    }

    // ── Deep Copy to Library ───────────────────────────────────────────────

    @Test
    @DisplayName("Deep copy highlight to library")
    void testDeepCopyToLibrary_Highlight() {
        SharedLink link = new SharedLink();
        link.setResourceType(SharedLink.ResourceType.HIGHLIGHT);
        link.setResourceId(10L);

        when(highlightRepo.findById(10L)).thenReturn(Optional.of(highlight));

        shareService.deepCopyToLibrary(viewer, link);

        verify(highlightRepo, times(1)).save(argThat(h ->
            h.getUser().getId().equals(viewer.getId()) &&
            "Test highlight text".equals(h.getText())
        ));
    }

    @Test
    @DisplayName("Deep copy folder to library with subfolders and highlights")
    void testDeepCopyToLibrary_Folder() {
        SharedLink link = new SharedLink();
        link.setResourceType(SharedLink.ResourceType.FOLDER);
        link.setResourceId(20L);
        link.setCreatedBy(owner);

        // Subfolder setup
        Folder subfolder = new Folder();
        subfolder.setId(21L);
        subfolder.setUser(owner);
        subfolder.setName("Sub");
        subfolder.setParentFolder(folder);

        // Highlight in parent folder
        Highlight hlInFolder = new Highlight();
        hlInFolder.setId(12L);
        hlInFolder.setUser(owner);
        hlInFolder.setText("HL in folder");
        hlInFolder.setFolderId(20L);
        hlInFolder.setFolder(folder);

        when(folderRepo.findByIdAndUserId(20L, 1L)).thenReturn(Optional.of(folder));
        when(folderRepo.save(any(Folder.class))).thenAnswer(inv -> {
            Folder f = inv.getArgument(0);
            f.setId(99L); // simulate saved folder id
            return f;
        });

        when(highlightRepo.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(hlInFolder));
        when(folderRepo.findByUserId(1L)).thenReturn(List.of(folder, subfolder));

        shareService.deepCopyToLibrary(viewer, link);

        // Verify folder saves (1 for parent, 1 for subfolder)
        verify(folderRepo, times(2)).save(any(Folder.class));

        // Verify highlight clone
        verify(highlightRepo, times(1)).saveAll(argThat(list -> {
            if (list == null) return false;
            java.util.List<Highlight> hlList = (java.util.List<Highlight>) list;
            if (hlList.isEmpty()) return false;
            Highlight h = hlList.get(0);
            return h.getUser().getId().equals(viewer.getId()) && "HL in folder".equals(h.getText());
        }));
    }

    // ── List Shared With Me ────────────────────────────────────────────────

    @Test
    @DisplayName("List shared with me returns previewed data")
    void testListSharedWithMe() {
        SharedLink link = new SharedLink();
        link.setUniqueHash("hash");
        link.setResourceType(SharedLink.ResourceType.HIGHLIGHT);
        link.setResourceId(10L);
        link.setCreatedBy(owner);
        link.setCreatedAt(Instant.now());

        UserSharedView view = new UserSharedView();
        view.setId(50L);
        view.setSharedLink(link);
        view.setCreatedAt(Instant.now());

        when(sharedViewRepo.findByUserIdOrderByCreatedAtDesc(viewer.getId())).thenReturn(List.of(view));
        when(highlightRepo.findById(10L)).thenReturn(Optional.of(highlight));

        List<Map<String, Object>> result = shareService.listSharedWithMe(viewer);

        assertEquals(1, result.size());
        Map<String, Object> item = result.get(0);
        assertEquals("hash", item.get("hash"));
        assertEquals("Test highlight text", item.get("preview")); // under 80 chars
        assertEquals("owner@example.com", item.get("sharedBy"));
    }
}
