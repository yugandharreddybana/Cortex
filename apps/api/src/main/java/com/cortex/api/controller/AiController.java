package com.cortex.api.controller;

import com.cortex.api.aspect.RequireTier;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.User;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.service.OllamaService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final OllamaService ollamaService;
    private final HighlightRepository highlightRepository;

    public AiController(OllamaService ollamaService, HighlightRepository highlightRepository) {
        this.ollamaService = ollamaService;
        this.highlightRepository = highlightRepository;
    }

    @PostMapping("/auto-draft")
    @RequireTier({"pro", "premium", "team"})
    public Mono<ResponseEntity<String>> generateAutoDraft(
            @AuthenticationPrincipal User user,
            @RequestBody AutoDraftRequest request) {

        List<Highlight> highlights = highlightRepository.findByFolderIdAndNotDeleted(request.folderId());

        if (highlights.isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().body("No highlights found in this folder."));
        }

        String texts = highlights.stream()
                .map(Highlight::getText)
                .collect(Collectors.joining("\n- "));

        String prompt = String.format(
            "Synthesize the following highlights into a structured outline formatted as %s.\n\nHighlights:\n- %s",
            request.format(), texts
        );

        return ollamaService.generate(prompt)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.internalServerError().body("Failed to generate outline"));
    }

    @PostMapping("/devils-advocate")
    @RequireTier({"pro", "premium", "team"})
    public Mono<ResponseEntity<String>> devilsAdvocate(
            @AuthenticationPrincipal User user,
            @RequestBody HighlightRequest request) {

        String prompt = String.format(
            "Play Devil's Advocate against the following text. Provide a 1-sentence warning of its potential bias or flaw, and assign a Trust Score from 1 to 10.\n\nText: %s\n\nReturn JSON in exactly this format: {\"score\": 5, \"warning\": \"your warning here\"}",
            request.text()
        );

        return ollamaService.generate(prompt, true)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.internalServerError().body("Failed to analyze highlight"));
    }

    @PostMapping("/connect-dots")
    @RequireTier({"pro", "premium", "team"})
    public Mono<ResponseEntity<String>> connectDots(
            @AuthenticationPrincipal User user,
            @RequestBody ConnectDotsRequest request) {

        List<Highlight> recentHighlights = highlightRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        String recentTexts = recentHighlights.stream()
                .limit(100)
                .map(Highlight::getText)
                .collect(Collectors.joining("\n- "));

        String prompt = String.format(
            "Cross-reference the following target highlight with the user's recent highlights to find semantic linkages and common themes. Provide a short 3-4 sentence paragraph connecting the dots.\n\nTarget Highlight: %s\n\nRecent Highlights:\n- %s",
            request.text(), recentTexts
        );

        return ollamaService.generate(prompt)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.internalServerError().body("Failed to connect dots"));
    }

    @PostMapping("/suggest-actions")
    @RequireTier({"pro", "premium", "team"})
    public Mono<ResponseEntity<String>> suggestActions(
            @AuthenticationPrincipal User user,
            @RequestBody HighlightRequest request) {

        String prompt = String.format(
            "Based on the following text, suggest exactly 3 clear, concise actionable steps the user should take. For example: 'Create a Jira ticket to...'. Return them as a JSON array of strings.\n\nText: %s",
            request.text()
        );

        return ollamaService.generate(prompt, true)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.internalServerError().body("Failed to suggest actions"));
    }

    public record AutoDraftRequest(Long folderId, String format) {}
    public record HighlightRequest(String text) {}
    public record ConnectDotsRequest(String text) {}
}
