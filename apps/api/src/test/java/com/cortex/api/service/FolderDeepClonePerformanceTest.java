package com.cortex.api.service;

import com.cortex.api.entity.Folder;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.User;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
public class FolderDeepClonePerformanceTest {

    @Mock private FolderRepository folderRepository;
    @Mock private HighlightRepository highlightRepository;
    @Mock private UserRepository userRepository;

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
            h.setFolderId(10L); // 3 highlights in root
            if (i > 3) h.setFolderId(11L); // 2 highlights in child
            highlights.add(h);
        }
    }

    @Test
    @DisplayName("Verify optimization: saveAll() is called exactly once for folders and highlights")
    @SuppressWarnings("unchecked")
    void testDeepClone_Optimized() {
        // Setup source nested structure: Root (10) -> Child (11)
        Folder childFolder = new Folder();
        childFolder.setId(11L);
        childFolder.setName("Child Folder");
        childFolder.setParentFolder(sourceFolder);
        childFolder.setUser(owner);

        List<Folder> sourceSubtree = List.of(sourceFolder, childFolder);
        
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(folderRepository.findAllDescendantsInclusive(10L)).thenReturn(sourceSubtree);
        when(highlightRepository.findByFolderIdInAndNotDeleted(any())).thenReturn(highlights);

        // Mock folder batch save — simulates database assigning IDs
        when(folderRepository.saveAll(any())).thenAnswer(invocation -> {
            Collection<Folder> folders = invocation.getArgument(0);
            long id = 100L;
            for (Folder f : folders) {
                if (f.getId() == null) f.setId(id++);
            }
            return (List<Folder>) new ArrayList<>(folders);
        });

        // Trigger clone
        Folder rootClone = folderService.deepCloneFolder(10L, 1L, null);

        // 1. Verify structural efficiency (Query reduction)
        verify(folderRepository, times(1)).findAllDescendantsInclusive(10L);
        verify(highlightRepository, times(1)).findByFolderIdInAndNotDeleted(any());

        // 2. Verify write efficiency (Batching)
        verify(folderRepository, times(1)).saveAll(any());
        verify(highlightRepository, times(1)).saveAll(any());
        
        // Ensure NO individual saves are made
        verify(folderRepository, never()).save(any());
        verify(highlightRepository, never()).save(any());

        // 3. Verify End-to-End Integrity (Structure & Data)
        assertNotNull(rootClone);
        assertEquals("Source Folder", rootClone.getName());
        assertEquals(100L, rootClone.getId());

        // Capture the saved folders to inspect relationships
        ArgumentCaptor<Collection<Folder>> folderCaptor = ArgumentCaptor.forClass(Collection.class);
        verify(folderRepository).saveAll(folderCaptor.capture());
        Collection<Folder> savedFolders = folderCaptor.getValue();
        
        assertEquals(2, savedFolders.size());
        
        Folder clonedChild = savedFolders.stream()
                .filter(f -> f.getName().equals("Child Folder"))
                .findFirst()
                .orElseThrow();
        
        assertNotNull(clonedChild.getParentFolder(), "Child clone must have a parent");
        assertEquals(rootClone.getId(), clonedChild.getParentFolder().getId(), "Child clone must point to the root clone");

        // 4. Verify highlights were correctly mapped to new folder IDs
        ArgumentCaptor<List<Highlight>> highlightCaptor = ArgumentCaptor.forClass(List.class);
        verify(highlightRepository).saveAll(highlightCaptor.capture());
        List<Highlight> savedHighlights = highlightCaptor.getValue();
        
        long rootCount = savedHighlights.stream().filter(h -> h.getFolderId().equals(100L)).count();
        long childCount = savedHighlights.stream().filter(h -> h.getFolderId().equals(101L)).count();
        
        assertEquals(3, rootCount, "Root clone should get 3 highlights");
        assertEquals(2, childCount, "Child clone should get 2 highlights");
    }
}
