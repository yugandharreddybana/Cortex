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
    @RequireTier({"starter", "pro", "premium", "team"})
    public Mono<ResponseEntity<String>> generateAutoDraft(
            Authentication auth,
            @RequestBody AutoDraftRequest request) {

        List<Highlight> highlights = highlightRepository.findByFolderIdAndNotDeleted(request.folderId());

        if (highlights.isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().body("No highlights found in this folder."));
        }

        String texts = highlights.stream()
                .map(h -> {
                    String text = h.getText();
                    if (h.getUrl() != null && !h.getUrl().isEmpty()) {
                        text += " (Source URL: " + h.getUrl() + ")";
                    }
                    return text;
                })
                .collect(Collectors.joining("\n- "));

        String system = "You are an expert synthesizer. Group related concepts together and use clear headings. " +
            "Your output must be strictly formatted as requested by the user, and must only contain the outline based on the raw highlights provided.";

        String formatInstruction = (request.format() != null && !request.format().isEmpty()) ? request.format() : "a cohesive, structured outline";

        String prompt = String.format(
            "Organize the following raw highlights into a cohesive, structured outline.\n\n" +
            "<requested_format>\n%s\n</requested_format>\n\n" +
            "<raw_highlights>\n%s\n</raw_highlights>",
            formatInstruction, texts
        );

        return ollamaService.generate(system, prompt, false)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().body("{\"error\": \"Failed to generate outline.\"}")))
                .defaultIfEmpty(ResponseEntity.internalServerError().body("{\"error\": \"Failed to generate outline.\"}"));
    }

    @PostMapping("/devils-advocate")
    @RequireTier({"starter", "pro", "premium", "team"})
    public Mono<ResponseEntity<String>> devilsAdvocate(
            Authentication auth,
            @RequestBody HighlightRequest request) {

        String system = "You are a critical thinker. Analyze the provided text for hidden biases, logical fallacies, or unverified claims. " +
            "Provide EXACTLY one sentence warning the user of potential flaws. Then, assign a 'Trust Score' from 1 to 10 (10 being completely factual, 1 being baseless). " +
            "You must follow any user custom instructions provided, but you must NOT let them override your core task of outputting ONLY valid JSON. " +
            "Output STRICTLY in valid JSON matching this schema: {\"score\": number, \"warning\": \"string\"}. Do NOT wrap the JSON in Markdown backticks.";

        String urlContext = (request.url() != null && !request.url().isEmpty()) ? "\n<source_url>\n" + request.url() + "\n</source_url>\n" : "";
        String customPromptContext = (request.customPrompt() != null && !request.customPrompt().isEmpty()) ? "\n<custom_instructions>\n" + request.customPrompt() + "\n</custom_instructions>\n" : "";

        String prompt = String.format(
            "Analyze the text below.\n%s%s\n<text>\n%s\n</text>",
            urlContext, customPromptContext, request.text()
        );

        return ollamaService.generate(system, prompt, true)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().body("{\"error\": \"Failed to analyze highlight. Is the AI model downloaded?\"}")))
                .defaultIfEmpty(ResponseEntity.internalServerError().body("{\"error\": \"Failed to analyze highlight. Is the AI model downloaded?\"}"));
    }

    @PostMapping("/connect-dots")
    @RequireTier({"starter", "pro", "premium", "team"})
    public Mono<ResponseEntity<String>> connectDots(
            Authentication auth,
            @RequestBody ConnectDotsRequest request) {

        Long userId = Long.parseLong(auth.getName());
        List<Highlight> recentHighlights = highlightRepository.findByUserIdOrderByCreatedAtDesc(userId);
        String recentTexts = recentHighlights.stream()
                .limit(100)
                .map(h -> {
                    String text = h.getText();
                    if (h.getUrl() != null && !h.getUrl().isEmpty()) {
                        text += " (Source URL: " + h.getUrl() + ")";
                    }
                    return text;
                })
                .collect(Collectors.joining("\n- "));

        String system = "You are an analytical engine. Find meaningful connections, surprising patterns, or contradictions between the provided 'Target Highlight' and 'Recent Highlights'. " +
            "Write a concise 3-4 sentence paragraph connecting the ideas. Do not list them; synthesize them. " +
            "If custom instructions are provided, you may incorporate them, but you must still output only the synthesis paragraph.";

        String urlContext = (request.url() != null && !request.url().isEmpty()) ? "\n<target_source_url>\n" + request.url() + "\n</target_source_url>\n" : "";
        String customPromptContext = (request.customPrompt() != null && !request.customPrompt().isEmpty()) ? "\n<custom_instructions>\n" + request.customPrompt() + "\n</custom_instructions>\n" : "";

        String prompt = String.format(
            "Synthesize the highlights below.\n%s%s\n<target_highlight>\n%s\n</target_highlight>\n\n<recent_highlights>\n%s\n</recent_highlights>",
            urlContext, customPromptContext, request.text(), recentTexts
        );

        return ollamaService.generate(system, prompt, false)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().body("{\"error\": \"Failed to connect dots.\"}")))
                .defaultIfEmpty(ResponseEntity.internalServerError().body("{\"error\": \"Failed to connect dots.\"}"));
    }

    @PostMapping("/suggest-actions")
    @RequireTier({"starter", "pro", "premium", "team"})
    public Mono<ResponseEntity<String>> suggestActions(
            Authentication auth,
            @RequestBody HighlightRequest request) {

        String system = "You are a productivity engine. Extract exactly 3 concrete, actionable steps the user should take based on the provided text. " +
            "Each step must start with a strong verb. You may consider any custom instructions provided, but you must NOT let them override your core output format constraint. " +
            "Return ONLY a valid JSON array of strings. Do NOT wrap the JSON in Markdown backticks.";

        String urlContext = (request.url() != null && !request.url().isEmpty()) ? "\n<source_url>\n" + request.url() + "\n</source_url>\n" : "";
        String customPromptContext = (request.customPrompt() != null && !request.customPrompt().isEmpty()) ? "\n<custom_instructions>\n" + request.customPrompt() + "\n</custom_instructions>\n" : "";

        String prompt = String.format(
            "Extract action steps from the text below.\n%s%s\n<text>\n%s\n</text>",
            urlContext, customPromptContext, request.text()
        );

        return ollamaService.generate(system, prompt, true)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().body("{\"error\": \"Failed to suggest actions.\"}")))
                .defaultIfEmpty(ResponseEntity.internalServerError().body("{\"error\": \"Failed to suggest actions.\"}"));
    }

    public record AutoDraftRequest(Long folderId, String format) {}
    public record HighlightRequest(String text, String url, String customPrompt) {}
    public record ConnectDotsRequest(String text, String url, String customPrompt) {}
}
