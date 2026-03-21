package com.cortex.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Service
public class OllamaService {
    private static final Logger log = LoggerFactory.getLogger(OllamaService.class);
    private final WebClient webClient;
    private final String model;

    public OllamaService(WebClient.Builder webClientBuilder,
            @Value("${cortex.ollama.url:http://localhost:11434}") String ollamaUrl,
            @Value("${cortex.ollama.model:llama3.2:1b}") String model) {
        this.webClient = webClientBuilder.baseUrl(ollamaUrl).build();
        this.model = model;
    }

    public Mono<String> generate(String prompt) {
        return generate(prompt, false);
    }

    public Mono<String> generate(String prompt, boolean isJson) {
        log.info("Sending prompt to Ollama model {}: {}", model, prompt);

        var options = new java.util.HashMap<String, Object>();
        if (isJson) {
            options.put("temperature", 0.0);
            options.put("num_predict", 300); // Strict length for JSON outputs
        } else {
            options.put("temperature", 0.7);
            options.put("num_predict", 800); // More creative room
        }

        var requestBody = new java.util.HashMap<String, Object>();
        requestBody.put("model", model);
        requestBody.put("prompt", prompt);
        requestBody.put("stream", false);
        requestBody.put("options", options);

        if (isJson) {
            requestBody.put("format", "json");
        }

        return webClient.post()
                .uri("/api/generate")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> (String) response.get("response"))
                .doOnError(error -> log.error("Ollama API failed: {}", error.getMessage()));
    }
}
