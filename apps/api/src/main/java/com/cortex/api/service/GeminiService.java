package com.cortex.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * GeminiService — Google Generative Language API client.
 * Replaces the previous Ollama-based local inference path.
 *
 * Endpoint:  https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * Auth:      ?key=GEMINI_API_KEY  (server-side env var, never exposed to clients)
 *
 * Public surface mirrors the old OllamaService so callers stay unchanged:
 *   generate(prompt)              → free-form text
 *   generate(prompt, jsonMode)    → strict JSON when jsonMode == true
 */
@Service
public class GeminiService {
    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private final WebClient webClient;
    private final String apiKey;
    private final String model;

    public GeminiService(WebClient.Builder builder,
                         @Value("${cortex.gemini.base-url:https://generativelanguage.googleapis.com}") String baseUrl,
                         @Value("${cortex.gemini.api-key:}") String apiKey,
                         @Value("${cortex.gemini.model:gemini-2.0-flash}") String model) {
        this.webClient = builder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.model  = model;
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GEMINI_API_KEY is not configured — AI endpoints will return 500 until set.");
        }
    }

    public Mono<String> generate(String prompt) { return generate(prompt, false); }

    public Mono<String> generate(String prompt, boolean jsonMode) {
        if (apiKey == null || apiKey.isBlank()) {
            return Mono.error(new IllegalStateException("GEMINI_API_KEY not configured"));
        }

        // Generation config — temperature low + JSON mime when JSON output is required.
        Map<String, Object> generationConfig = jsonMode
            ? Map.of("temperature", 0.0, "maxOutputTokens", 512, "responseMimeType", "application/json")
            : Map.of("temperature", 0.7, "maxOutputTokens", 1024);

        Map<String, Object> body = Map.of(
            "contents", List.of(Map.of(
                "role",  "user",
                "parts", List.of(Map.of("text", prompt))
            )),
            "generationConfig", generationConfig,
            // Permissive safety so legitimate research excerpts aren't blocked.
            "safetySettings", List.of(
                Map.of("category", "HARM_CATEGORY_HARASSMENT",        "threshold", "BLOCK_ONLY_HIGH"),
                Map.of("category", "HARM_CATEGORY_HATE_SPEECH",       "threshold", "BLOCK_ONLY_HIGH"),
                Map.of("category", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold", "BLOCK_ONLY_HIGH"),
                Map.of("category", "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold", "BLOCK_ONLY_HIGH")
            )
        );

        String uri = String.format("/v1beta/models/%s:generateContent?key=%s", model, apiKey);

        return webClient.post()
            .uri(uri)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .map(this::extractText)
            .timeout(Duration.ofSeconds(45))
            .retryWhen(Retry.backoff(2, Duration.ofMillis(400))
                .filter(t -> !(t instanceof IllegalStateException)))
            .doOnError(e -> log.error("Gemini API failed: {}", e.getMessage()));
    }

    @SuppressWarnings("unchecked")
    private String extractText(Map response) {
        try {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
            if (candidates == null || candidates.isEmpty()) return "";
            Map<String, Object> first = candidates.get(0);
            Map<String, Object> content = (Map<String, Object>) first.get("content");
            if (content == null) return "";
            List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
            if (parts == null || parts.isEmpty()) return "";
            StringBuilder sb = new StringBuilder();
            for (Map<String, Object> part : parts) {
                Object t = part.get("text");
                if (t != null) sb.append(t);
            }
            return sb.toString();
        } catch (Exception e) {
            log.warn("Could not parse Gemini response: {}", e.getMessage());
            return "";
        }
    }
}
