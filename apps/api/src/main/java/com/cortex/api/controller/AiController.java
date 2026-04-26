package com.cortex.api.controller;

import com.cortex.api.aspect.RequireTier;
import com.cortex.api.entity.Highlight;
import com.cortex.api.repository.HighlightRepository;
import com.cortex.api.service.GeminiService;
import com.cortex.api.service.UrlReaderService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.stream.Collectors;

/**
 * AiController — Gemini-backed AI features (auto-draft, devil's advocate,
 * connect-dots, suggest-actions). Each endpoint that takes a {@code url}
 * fetches the page server-side and feeds the extracted main text to Gemini
 * so its answers are grounded in the actual source, not just the snippet.
 */
@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final GeminiService     gemini;
    private final UrlReaderService  urlReader;
    private final HighlightRepository highlightRepository;

    public AiController(GeminiService gemini,
                        UrlReaderService urlReader,
                        HighlightRepository highlightRepository) {
        this.gemini              = gemini;
        this.urlReader           = urlReader;
        this.highlightRepository = highlightRepository;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** Returns "Page context (excerpt): ...\n\n" or "" if URL is empty / unfetchable. */
    private Mono<String> pageContextBlock(String url) {
        if (url == null || url.isBlank()) return Mono.just("");
        return urlReader.read(url)
            .map(text -> text.isBlank()
                ? ""
                : "Page context (excerpt — use this to ground your answer):\n" + text + "\n\n");
    }

    private static ResponseEntity<String> error(String msg) {
        return ResponseEntity.internalServerError().body("{\"error\": \"" + msg.replace("\"", "\\\"") + "\"}");
    }

    // ── Auto-draft ─────────────────────────────────────────────────────────────

    @PostMapping("/auto-draft")
    @RequireTier({"starter", "pro", "premium", "team"})
    public Mono<ResponseEntity<String>> generateAutoDraft(Authentication auth,
                                                          @RequestBody AutoDraftRequest request) {
        List<Highlight> highlights = highlightRepository.findByFolderIdAndNotDeleted(request.folderId());
        if (highlights.isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().body("No highlights found in this folder."));
        }

        String texts = highlights.stream()
            .map(h -> {
                String t = h.getText();
                if (h.getUrl() != null && !h.getUrl().isEmpty()) t += " (Source URL: " + h.getUrl() + ")";
                return t;
            })
            .collect(Collectors.joining("\n- "));

        String prompt = String.format(
            "You are an expert synthesizer. Organize the following raw highlights into a cohesive, " +
            "structured outline formatted strictly as %s. Group related concepts together and use " +
            "clear headings.\n\nRaw Highlights:\n- %s",
            request.format(), texts
        );

        return gemini.generate(prompt)
            .map(ResponseEntity::ok)
            .onErrorResume(e -> Mono.just(error("Failed to generate outline.")))
            .defaultIfEmpty(error("Failed to generate outline."));
    }

    // ── Devil's advocate ───────────────────────────────────────────────────────

    @PostMapping("/devils-advocate")
    @RequireTier({"starter", "pro", "premium", "team"})
    public Mono<ResponseEntity<String>> devilsAdvocate(Authentication auth,
                                                       @RequestBody HighlightRequest request) {
        return pageContextBlock(request.url()).flatMap(ctx -> {
            String urlContext = (request.url() != null && !request.url().isEmpty())
                ? "\nSource URL: " + request.url() : "";
            String custom = (request.customPrompt() != null && !request.customPrompt().isEmpty())
                ? "\nUser Custom Instructions: " + request.customPrompt() : "";

            String prompt = String.format(
                "%sYou are a critical thinker. Analyze the text below for hidden biases, logical " +
                "fallacies, or unverified claims. Provide EXACTLY one sentence warning the user " +
                "of potential flaws. Then, assign a 'Trust Score' from 1 to 10 (10 = completely " +
                "factual, 1 = baseless).%s\n\nText: %s%s\n\nOutput STRICTLY in valid JSON " +
                "matching this schema: {\"score\": number, \"warning\": \"string\"}. Do NOT wrap " +
                "the JSON in Markdown backticks.",
                ctx, custom, request.text(), urlContext
            );

            return gemini.generate(prompt, true)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(error("Failed to analyze highlight.")))
                .defaultIfEmpty(error("Failed to analyze highlight."));
        });
    }

    // ── Connect dots ───────────────────────────────────────────────────────────

    @PostMapping("/connect-dots")
    @RequireTier({"starter", "pro", "premium", "team"})
    public Mono<ResponseEntity<String>> connectDots(Authentication auth,
                                                    @RequestBody ConnectDotsRequest request) {
        Long userId = Long.parseLong(auth.getName());
        List<Highlight> recentHighlights = highlightRepository.findByUserIdOrderByCreatedAtDesc(userId);
        String recentTexts = recentHighlights.stream()
            .limit(100)
            .map(h -> {
                String t = h.getText();
                if (h.getUrl() != null && !h.getUrl().isEmpty()) t += " (Source URL: " + h.getUrl() + ")";
                return t;
            })
            .collect(Collectors.joining("\n- "));

        return pageContextBlock(request.url()).flatMap(ctx -> {
            String urlContext = (request.url() != null && !request.url().isEmpty())
                ? "\nTarget Source URL: " + request.url() : "";
            String custom = (request.customPrompt() != null && !request.customPrompt().isEmpty())
                ? "\nUser Custom Instructions: " + request.customPrompt() : "";

            String prompt = String.format(
                "%sYou are an analytical engine. I will provide a 'Target Highlight' and a list " +
                "of 'Recent Highlights'. Find meaningful connections, surprising patterns, or " +
                "contradictions between them. Write a concise 3-4 sentence paragraph connecting " +
                "the ideas. Do not list them; synthesize them.%s\n\nTarget Highlight: %s%s\n\n" +
                "Recent Highlights:\n- %s",
                ctx, custom, request.text(), urlContext, recentTexts
            );

            return gemini.generate(prompt)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(error("Failed to connect dots.")))
                .defaultIfEmpty(error("Failed to connect dots."));
        });
    }

    // ── Suggest actions ────────────────────────────────────────────────────────

    @PostMapping("/suggest-actions")
    @RequireTier({"starter", "pro", "premium", "team"})
    public Mono<ResponseEntity<String>> suggestActions(Authentication auth,
                                                       @RequestBody HighlightRequest request) {
        return pageContextBlock(request.url()).flatMap(ctx -> {
            String urlContext = (request.url() != null && !request.url().isEmpty())
                ? "\nSource URL: " + request.url() : "";
            String custom = (request.customPrompt() != null && !request.customPrompt().isEmpty())
                ? "\nUser Custom Instructions: " + request.customPrompt() : "";

            String prompt = String.format(
                "%sYou are a productivity engine. Extract exactly 3 concrete, actionable steps " +
                "the user should take based on the text below. Each step must start with a " +
                "strong verb.%s Return ONLY a valid JSON array of strings. Do NOT wrap the JSON " +
                "in Markdown backticks.\n\nText: %s%s",
                ctx, custom, request.text(), urlContext
            );

            return gemini.generate(prompt, true)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(error("Failed to suggest actions.")))
                .defaultIfEmpty(error("Failed to suggest actions."));
        });
    }

    public record AutoDraftRequest(Long folderId, String format) {}
    public record HighlightRequest(String text, String url, String customPrompt) {}
    public record ConnectDotsRequest(String text, String url, String customPrompt) {}
}
