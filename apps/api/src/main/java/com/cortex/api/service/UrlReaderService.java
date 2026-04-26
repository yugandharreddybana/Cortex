package com.cortex.api.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Safelist;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * UrlReaderService — fetches a URL and extracts its main readable text so
 * the AI endpoints can ground their answers in the actual page content,
 * not just the user's saved snippet.
 *
 *  • Jsoup with a 6 s timeout and a real-browser UA (avoids 403s on most sites)
 *  • Selects {@code <article>} / {@code <main>} when present, else falls back to body
 *  • Strips script / style / nav / footer / aside
 *  • Caps output at 8 000 chars to keep prompts well under the model's context limit
 *  • In-memory LRU-ish cache, 24 h TTL, max 256 entries — no persistence
 *
 * NEVER throws — returns empty string on any failure so AI endpoints degrade gracefully.
 */
@Service
public class UrlReaderService {
    private static final Logger log = LoggerFactory.getLogger(UrlReaderService.class);

    private static final int    MAX_CHARS      = 8_000;
    private static final long   CACHE_TTL_MS   = Duration.ofHours(24).toMillis();
    private static final int    CACHE_MAX_SIZE = 256;
    private static final String UA             = "Mozilla/5.0 (compatible; CortexBot/1.0; +https://cortex.so)";

    private record CacheEntry(String text, Instant fetchedAt) {}
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public Mono<String> read(String url) {
        if (url == null || url.isBlank()) return Mono.just("");

        // Cache hit — fresh
        CacheEntry hit = cache.get(url);
        if (hit != null && Instant.now().toEpochMilli() - hit.fetchedAt().toEpochMilli() < CACHE_TTL_MS) {
            return Mono.just(hit.text());
        }

        return Mono.fromCallable(() -> fetchSync(url))
            .subscribeOn(Schedulers.boundedElastic())
            .onErrorResume(e -> {
                log.debug("UrlReader failed for {}: {}", url, e.getMessage());
                return Mono.just("");
            });
    }

    private String fetchSync(String url) {
        try {
            Document doc = Jsoup.connect(url)
                .userAgent(UA)
                .timeout(6_000)
                .followRedirects(true)
                .ignoreContentType(false)
                .maxBodySize(2_000_000)
                .get();

            // Strip noise
            doc.select("script, style, nav, footer, aside, noscript, iframe, form, header").remove();

            Element main = doc.selectFirst("article");
            if (main == null) main = doc.selectFirst("main");
            if (main == null) main = doc.body();
            if (main == null) return "";

            String text = Jsoup.clean(main.html(), Safelist.none())
                .replaceAll("\\s+", " ")
                .trim();

            if (text.length() > MAX_CHARS) text = text.substring(0, MAX_CHARS) + "…";

            putBounded(url, text);
            return text;
        } catch (Exception e) {
            log.debug("UrlReader sync error: {}", e.getMessage());
            return "";
        }
    }

    private void putBounded(String url, String text) {
        if (cache.size() >= CACHE_MAX_SIZE) {
            // Evict the oldest entry — simple, predictable, no extra deps.
            cache.entrySet().stream()
                .min((a, b) -> a.getValue().fetchedAt().compareTo(b.getValue().fetchedAt()))
                .ifPresent(oldest -> cache.remove(oldest.getKey()));
        }
        cache.put(url, new CacheEntry(text, Instant.now()));
    }
}
