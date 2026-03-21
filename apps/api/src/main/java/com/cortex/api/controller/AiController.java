package com.cortex.api.controller;

import com.cortex.api.aspect.RequireTier;
import com.cortex.api.entity.Highlight;
import com.cortex.api.entity.User;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.service.OllamaService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
            Authentication auth,
            @RequestBody AutoDraftRequest request) {

        List<Highlight> highlights = highlightRepository.findByFolderIdAndNotDeleted(request.folderId());

        if (highlights.isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().body("No highlights found in this folder."));
        }

        String texts = highlights.stream()
                .map(Highlight::getText)
                .collect(Collectors.joining("\n- "));

        String prompt = String.format(
            "You are an expert synthesizer. Organize the following raw highlights into a cohesive, structured outline formatted strictly as %s. Group related concepts together and use clear headings.\n\nRaw Highlights:\n- %s",
            request.format(), texts
        );

        return ollamaService.generate(prompt)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().body("{\"error\": \"Failed to generate outline.\"}")))
                .defaultIfEmpty(ResponseEntity.internalServerError().body("{\"error\": \"Failed to generate outline.\"}"));
    }

    @PostMapping("/devils-advocate")
    @RequireTier({"pro", "premium", "team"})
    public Mono<ResponseEntity<String>> devilsAdvocate(
            Authentication auth,
            @RequestBody HighlightRequest request) {

        String prompt = String.format(
            "You are a critical thinker. Analyze the text below for hidden biases, logical fallacies, or unverified claims. Provide EXACTLY one sentence warning the user of potential flaws. Then, assign a 'Trust Score' from 1 to 10 (10 being completely factual, 1 being baseless).\n\nText: %s\n\nOutput STRICTLY in valid JSON matching this schema: {\"score\": number, \"warning\": \"string\"}. Do NOT wrap the JSON in Markdown backticks.",
            request.text()
        );

        return ollamaService.generate(prompt, true)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().body("{\"error\": \"Failed to analyze highlight. Is the AI model downloaded?\"}")))
                .defaultIfEmpty(ResponseEntity.internalServerError().body("{\"error\": \"Failed to analyze highlight. Is the AI model downloaded?\"}"));
    }

    @PostMapping("/connect-dots")
    @RequireTier({"pro", "premium", "team"})
    public Mono<ResponseEntity<String>> connectDots(
            Authentication auth,
            @RequestBody ConnectDotsRequest request) {

        Long userId = Long.parseLong(auth.getName());
        List<Highlight> recentHighlights = highlightRepository.findByUserIdOrderByCreatedAtDesc(userId);
        String recentTexts = recentHighlights.stream()
                .limit(20) // Reduced from 100 to prevent context explosion on small models
                .map(Highlight::getText)
                .collect(Collectors.joining("\n- "));

        String prompt = String.format(
            "You are an analytical engine. I will provide a 'Target Highlight' and a list of 'Recent Highlights'. Find meaningful connections, surprising patterns, or contradictions between them. Write a concise 3-4 sentence paragraph connecting the ideas. Do not list them; synthesize them.\n\nTarget Highlight: %s\n\nRecent Highlights:\n- %s",
            request.text(), recentTexts
        );

        return ollamaService.generate(prompt)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().body("{\"error\": \"Failed to connect dots.\"}")))
                .defaultIfEmpty(ResponseEntity.internalServerError().body("{\"error\": \"Failed to connect dots.\"}"));
    }

    @PostMapping("/suggest-actions")
    @RequireTier({"pro", "premium", "team"})
    public Mono<ResponseEntity<String>> suggestActions(
            Authentication auth,
            @RequestBody HighlightRequest request) {

        String prompt = String.format(
            "You are a productivity engine. Extract exactly 3 concrete, actionable steps the user should take based on the text below. Each step must start with a strong verb. Return ONLY a valid JSON array of strings. Do NOT wrap the JSON in Markdown backticks.\n\nText: %s",
            request.text()
        );

        return ollamaService.generate(prompt, true)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().body("{\"error\": \"Failed to suggest actions.\"}")))
                .defaultIfEmpty(ResponseEntity.internalServerError().body("{\"error\": \"Failed to suggest actions.\"}"));
    }

    public record AutoDraftRequest(Long folderId, String format) {}
    public record HighlightRequest(String text) {}
    public record ConnectDotsRequest(String text) {}
}
