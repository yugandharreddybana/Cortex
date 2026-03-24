package com.cortex.api.service;

import com.cortex.api.entity.AccessLevel;
import com.cortex.api.entity.Folder;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.LinkAccess;
import com.cortex.api.entity.User;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.ResourcePermissionRepository;
import com.cortex.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class FolderDeepClonePerformanceTest {

    @Mock private FolderRepository folderRepository;
    @Mock private HighlightRepository highlightRepository;
    @Mock private ResourcePermissionRepository permissionRepository;
    @Mock private PermissionService permissionService;
    @Mock private EmailService emailService;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private FolderService folderService;

    private User owner;
    private Folder sourceFolder;
    private List<Highlight> highlights;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(1L);
        owner.setEmail("owner@example.com");

        sourceFolder = new Folder();
        sourceFolder.setId(10L);
        sourceFolder.setName("Source Folder");
        sourceFolder.setUser(owner);

        highlights = new ArrayList<>();
        for (long i = 1; i <= 5; i++) {
            Highlight h = new Highlight();
            h.setId(i);
            h.setText("Highlight " + i);
            h.setFolderId(10L);
            highlights.add(h);
        }
    }

    @Test
    @DisplayName("Verify optimization: saveAll() is called once for all highlights during deep clone")
    void testDeepClone_Optimized() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(folderRepository.findById(10L)).thenReturn(Optional.of(sourceFolder));
        when(highlightRepository.findByFolderIdAndNotDeleted(10L)).thenReturn(highlights);

        // Mock saving the folder clone
        when(folderRepository.save(any(Folder.class))).thenAnswer(invocation -> {
            Folder f = invocation.getArgument(0);
            if (f.getId() == null) f.setId(100L);
            return f;
        });

        // Mock saving child folders (empty for this test)
        when(folderRepository.findByParentFolderId(10L)).thenReturn(new ArrayList<>());

        folderService.deepCloneFolder(10L, 1L, null);

        // Verify that save() is NOT called for individual highlights
        verify(highlightRepository, never()).save(any(Highlight.class));

        // Verify that saveAll was called exactly once with the list of highlights
        verify(highlightRepository, times(1)).saveAll(argThat(iterable -> ((java.util.Collection<?>) iterable).size() == 5));
    }
}
