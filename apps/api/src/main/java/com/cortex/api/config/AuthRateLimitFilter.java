package com.cortex.api.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-IP token bucket rate limit on auth endpoints: 5 requests per minute.
 * Applies to POST /api/v1/auth/login and POST /api/v1/auth/signup.
 *
 * FIX: X-Forwarded-For is only trusted when the actual remoteAddr is a known
 * trusted proxy/load-balancer IP. Otherwise remoteAddr is used directly,
 * preventing IP spoofing via forged X-Forwarded-For headers.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final int CAPACITY = 5;
    private static final Duration REFILL_PERIOD = Duration.ofMinutes(1);

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    /**
     * Comma-separated list of trusted reverse proxy IPs.
     * Set via TRUSTED_PROXY_IPS environment variable.
     * Example: "10.0.0.1,172.31.0.1"
     */
    @Value("${cortex.trusted-proxy-ips:}")
    private String trustedProxyIpsConfig;

    private Set<String> getTrustedProxies() {
        if (trustedProxyIpsConfig == null || trustedProxyIpsConfig.isBlank()) {
            return Set.of();
        }
        Set<String> result = new java.util.HashSet<>();
        for (String ip : trustedProxyIpsConfig.split(",")) {
            String trimmed = ip.trim();
            if (!trimmed.isEmpty()) result.add(trimmed);
        }
        return result;
    }

    private Bucket resolveBucket(String key) {
        return buckets.computeIfAbsent(key, k -> Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(CAPACITY)
                        .refillGreedy(CAPACITY, REFILL_PERIOD)
                        .build())
                .build());
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!HttpMethod.POST.matches(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return !("/api/v1/auth/login".equals(path) || "/api/v1/auth/signup".equals(path));
    }

    @Override
    protected void doFilterInternal(
            @org.springframework.lang.NonNull HttpServletRequest request,
            @org.springframework.lang.NonNull HttpServletResponse response,
            @org.springframework.lang.NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String ip = clientIp(request);
        String key = request.getRequestURI() + ":" + ip;
        Bucket bucket = resolveBucket(key);

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", String.valueOf(REFILL_PERIOD.toSeconds()));
            response.getWriter().write("{\"error\":\"Too many requests. Please try again later.\"}");
        }
    }

    /**
     * FIX: Only trust X-Forwarded-For when the actual TCP connection comes from
     * a known trusted proxy IP. This prevents attackers from spoofing their IP
     * by setting a forged X-Forwarded-For header.
     */
    private String clientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        Set<String> trustedProxies = getTrustedProxies();

        if (trustedProxies.contains(remoteAddr)) {
            // Only read X-Forwarded-For from known trusted proxies
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                int comma = xff.indexOf(',');
                return (comma > 0 ? xff.substring(0, comma) : xff).trim();
            }
            String real = request.getHeader("X-Real-IP");
            if (real != null && !real.isBlank()) {
                return real.trim();
            }
        }

        // For all other connections, use the actual TCP remote address
        return remoteAddr;
    }
}
