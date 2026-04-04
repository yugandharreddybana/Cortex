package com.cortex.api.service;

import com.cortex.api.dto.CommentDTO;
import com.cortex.api.entity.Comment;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.User;
import com.cortex.api.repository.CommentRepository;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CommentServiceTest {

    @Mock private CommentRepository commentRepo;
    @Mock private HighlightRepository highlightRepo;
    @Mock private UserRepository userRepo;
    @Mock private EmailService emailService;
    @Mock private SecurityService securityService;
    @Mock private NotificationService notificationService;
    @Mock private FolderRepository folderRepo;
    @Mock private CommentReactionService reactionService;

    @InjectMocks
    private CommentService commentService;

    private User owner;
    private User author;
    private User other;
    private Highlight highlight;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(1L);
        owner.setEmail("owner@example.com");

        author = new User();
        author.setId(2L);
        author.setEmail("author@example.com");

        other = new User();
        other.setId(3L);
        other.setEmail("other@example.com");

        highlight = new Highlight();
        highlight.setId(10L);
        highlight.setUser(owner);
        highlight.setText("Test highlight text");
    }

    @Test
    @DisplayName("addComment - Success as Owner")
    void testAddComment_Owner_Success() {
        when(highlightRepo.findById(10L)).thenReturn(Optional.of(highlight));
        when(userRepo.findById(1L)).thenReturn(Optional.of(owner));
        when(commentRepo.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(reactionService.getReactionsDTO(any())).thenReturn(java.util.Collections.emptyList());
 
        CommentDTO result = commentService.addComment(10L, "Test comment", 1L);
 
        assertNotNull(result);
        assertEquals("Test comment", result.text());
        verify(securityService, never()).hasHighlightAccess(anyLong(), anyString());
    }

    @Test
    @DisplayName("addComment - Success as Commenter")
    void testAddComment_Commenter_Success() {
        when(highlightRepo.findById(10L)).thenReturn(Optional.of(highlight));
        when(userRepo.findById(2L)).thenReturn(Optional.of(author));
        when(securityService.hasHighlightAccess(10L, "COMMENTER")).thenReturn(true);
        when(commentRepo.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(reactionService.getReactionsDTO(any())).thenReturn(java.util.Collections.emptyList());
 
        CommentDTO result = commentService.addComment(10L, "Test comment", 2L);

        assertNotNull(result);
        verify(securityService).hasHighlightAccess(10L, "COMMENTER");
    }

    @Test
    @DisplayName("addComment - Forbidden for Viewer")
    void testAddComment_Viewer_Forbidden() {
        when(highlightRepo.findById(10L)).thenReturn(Optional.of(highlight));
        when(userRepo.findById(3L)).thenReturn(Optional.of(other));
        when(securityService.hasHighlightAccess(10L, "COMMENTER")).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            commentService.addComment(10L, "Test comment", 3L);
        });

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    @DisplayName("deleteComment - Success as Author")
    void testDeleteComment_Author_Success() {
        Comment comment = new Comment();
        comment.setId(100L);
        comment.setAuthor(author);
        comment.setHighlight(highlight);

        when(commentRepo.findById(100L)).thenReturn(Optional.of(comment));

        commentService.deleteComment(100L, 2L); // 2L is author

        verify(commentRepo).delete(comment);
    }

    @Test
    @DisplayName("deleteComment - Success as Highlight Owner")
    void testDeleteComment_HighlightOwner_Success() {
        Comment comment = new Comment();
        comment.setId(100L);
        comment.setAuthor(author);
        comment.setHighlight(highlight);

        when(commentRepo.findById(100L)).thenReturn(Optional.of(comment));

        commentService.deleteComment(100L, 1L); // 1L is highlight owner

        verify(commentRepo).delete(comment);
    }

    @Test
    @DisplayName("deleteComment - Success as Folder Editor")
    void testDeleteComment_FolderEditor_Success() {
        highlight.setFolderId(20L);
        Comment comment = new Comment();
        comment.setId(100L);
        comment.setAuthor(author);
        comment.setHighlight(highlight);

        when(commentRepo.findById(100L)).thenReturn(Optional.of(comment));
        when(securityService.hasFolderAccess(20L, "EDITOR")).thenReturn(true);

        commentService.deleteComment(100L, 3L); // 3L is folder editor

        verify(commentRepo).delete(comment);
    }

    @Test
    @DisplayName("deleteComment - Forbidden for other users")
    void testDeleteComment_Other_Forbidden() {
        highlight.setFolderId(20L);
        Comment comment = new Comment();
        comment.setId(100L);
        comment.setAuthor(author);
        comment.setHighlight(highlight);

        when(commentRepo.findById(100L)).thenReturn(Optional.of(comment));
        when(securityService.hasFolderAccess(20L, "EDITOR")).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            commentService.deleteComment(100L, 4L); // 4L is random user
        });

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }
}
