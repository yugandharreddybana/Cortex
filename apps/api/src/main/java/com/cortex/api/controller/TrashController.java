package com.cortex.api.controller;

import com.cortex.api.dto.HighlightDTO;
import com.cortex.api.entity.Highlight;
import com.cortex.api.repository.HighlightRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/trash")
public class TrashController {

    private final HighlightRepository highlightRepository;

    public TrashController(HighlightRepository highlightRepository) {
        this.highlightRepository = highlightRepository;
    }

    /**
     * Get items in the trash that are scheduled for permanent deletion in the next 3 days.
     * Retention period is 30 days. "Expiring in 3 days" = deleted between 27 and 30 days ago.
     */
    @GetMapping("/expiring")
    public List<HighlightDTO> getExpiringSoon(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        
        // Items deleted between 30 and 27 days ago will be purged in 0-3 days.
        Instant thirtyDaysAgo = Instant.now().minus(30, ChronoUnit.DAYS);
        Instant twentySevenDaysAgo = Instant.now().minus(27, ChronoUnit.DAYS);
        
        return highlightRepository.findDeletedBetween(thirtyDaysAgo, twentySevenDaysAgo).stream()
                .filter(h -> h.getUser().getId().equals(userId))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Clear all items in the user's trash immediately.
     */
    @DeleteMapping("/empty")
    public ResponseEntity<Void> emptyTrash(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        highlightRepository.emptyTrashByUserId(userId);
        return ResponseEntity.ok().build();
    }

    private HighlightDTO toDTO(Highlight h) {
        HighlightDTO dto = new HighlightDTO();
        dto.id = h.getId();
        dto.text = h.getText();
        dto.url = h.getUrl();
        dto.source = h.getSource(); // Mapped from pageTitle
        dto.highlightColor = h.getHighlightColor();
        dto.isCode = h.isCode();
        dto.isAI = h.isAI();
        dto.deletedAt = h.getDeletedAt();
        if (h.getFolder() != null) {
            dto.folderId = h.getFolder().getId();
            dto.folderName = h.getFolder().getName();
        }
        return dto;
    }
}
