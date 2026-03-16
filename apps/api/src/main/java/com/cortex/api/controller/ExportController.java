package com.cortex.api.controller;

import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.User;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/export")
public class ExportController {

    private static final String AI_REDACTION_PREFIX =
            "[🔒 Private AI Highlight: Source link omitted for privacy.] ";
    private static final List<String> AI_URL_PATTERNS = List.of(
            "chatgpt.com", "claude.ai", "gemini.google.com"
    );

    private final HighlightRepository highlightRepo;
    private final FolderRepository folderRepo;
    private final UserRepository userRepo;

    public ExportController(HighlightRepository highlightRepo,
                            FolderRepository folderRepo,
                            UserRepository userRepo) {
        this.highlightRepo = highlightRepo;
        this.folderRepo = folderRepo;
        this.userRepo = userRepo;
    }

    /** GET /api/v1/export?scope=all | scope=folder&folderId=xxx | scope=highlight&highlightId=xxx */
    @GetMapping
    public List<Map<String, Object>> exportData(Authentication auth,
                                                 @RequestParam(defaultValue = "all") String scope,
                                                 @RequestParam(required = false) Long folderId,
                                                 @RequestParam(required = false) Long highlightId) {
        Long userId = Long.parseLong(auth.getName());
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        List<Highlight> highlights;

        if ("highlight".equals(scope) && highlightId != null) {
            Highlight h = highlightRepo.findById(highlightId)
                    .filter(hl -> hl.getUser().getId().equals(userId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            highlights = List.of(h);
        } else if ("folder".equals(scope) && folderId != null) {
            // Verify folder belongs to user
            folderRepo.findByIdAndUserId(folderId, userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            // Collect the folder and ALL nested sub-folders recursively
            Set<Long> folderIds = folderRepo.findAllDescendantsInclusive(folderId)
                    .stream().map(f -> f.getId()).collect(Collectors.toSet());
            highlights = highlightRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                    .filter(h -> h.getFolderId() != null && folderIds.contains(h.getFolderId()))
                    .toList();
        } else {
            highlights = highlightRepo.findByUserIdOrderByCreatedAtDesc(userId);
        }

        return highlights.stream().map(this::toExportRow).toList();
    }

    private Map<String, Object> toExportRow(Highlight h) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", h.getId());
        row.put("text", h.getText());
        row.put("source", h.getSource());

        boolean needsRedaction = h.isAI() || isAiUrl(h.getUrl()) || isAiUrl(h.getChatUrl());

        if (needsRedaction) {
            row.put("url", "Private AI Chat");
            String note = h.getNote() != null ? h.getNote() : "";
            row.put("note", AI_REDACTION_PREFIX + note);
        } else {
            row.put("url", h.getUrl());
            row.put("note", h.getNote());
        }

        row.put("topic", h.getTopic());
        row.put("savedAt", h.getSavedAt());
        row.put("isAI", h.isAI());
        return row;
    }

    private boolean isAiUrl(String url) {
        if (url == null || url.isBlank()) return false;
        String lower = url.toLowerCase();
        return AI_URL_PATTERNS.stream().anyMatch(lower::contains);
    }
}
