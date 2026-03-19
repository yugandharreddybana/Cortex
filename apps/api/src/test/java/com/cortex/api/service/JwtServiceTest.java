package com.cortex.api.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;
    private final String secret = "mysecretkeythatislongenoughforhs256testing";
    private final long expirationMs = 3600000; // 1 hour
    private final long extensionExpirationMs = 86400000; // 24 hours

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(secret, expirationMs, extensionExpirationMs);
    }

    @Test
    void testGenerateAndParseToken() {
        String subject = "testUser";
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", "ADMIN");

        String token = jwtService.generateToken(subject, claims);
        assertNotNull(token);

        Claims parsedClaims = jwtService.parseToken(token);
        assertEquals(subject, parsedClaims.getSubject());
        assertEquals("ADMIN", parsedClaims.get("role"));
    }

    @Test
    void testGenerateAndParseExtensionToken() {
        String subject = "extensionUser";
        Map<String, Object> claims = new HashMap<>();
        claims.put("ext", "true");

        String token = jwtService.generateExtensionToken(subject, claims);
        assertNotNull(token);

        Claims parsedClaims = jwtService.parseToken(token);
        assertEquals(subject, parsedClaims.getSubject());
        assertEquals("true", parsedClaims.get("ext"));
    }

    @Test
    void testIsValid_ValidToken() {
        String token = jwtService.generateToken("user", new HashMap<>());
        assertTrue(jwtService.isValid(token));
    }

    @Test
    void testIsValid_ExpiredToken() throws InterruptedException {
        JwtService shortLivedService = new JwtService(secret, 1, extensionExpirationMs);
        String token = shortLivedService.generateToken("user", new HashMap<>());
        Thread.sleep(10);
        assertFalse(shortLivedService.isValid(token));
    }

    @Test
    void testIsValid_InvalidToken() {
        assertFalse(jwtService.isValid("invalid.token.here"));
    }

    @Test
    void testGetSubject() {
        String subject = "subjectUser";
        String token = jwtService.generateToken(subject, new HashMap<>());
        assertEquals(subject, jwtService.getSubject(token));
    }

    @Test
    void testParseToken_InvalidSignature() {
        String token = jwtService.generateToken("user", new HashMap<>());
        JwtService otherService = new JwtService("anothersecretkeythatislongenoughforhs256testing", expirationMs, extensionExpirationMs);
        assertThrows(JwtException.class, () -> otherService.parseToken(token));
    }

    @Test
    void testParseToken_MalformedToken() {
        assertThrows(JwtException.class, () -> jwtService.parseToken("not.a.jwt"));
    }
}
