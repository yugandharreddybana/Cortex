package com.cortex.api.service;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Profile({"dev", "test"})
public class TestEmailService {

    private final List<Map<String, String>> sentEmails = Collections.synchronizedList(new ArrayList<>());

    public List<Map<String, String>> getSentEmails() {
        return new ArrayList<>(sentEmails);
    }

    public void clearSentEmails() {
        sentEmails.clear();
    }

    public void recordTestEmail(String to, String subject, String body) {
        Map<String, String> email = new HashMap<>();
        email.put("to", to);
        email.put("subject", subject);
        email.put("body", body);
        email.put("timestamp", Instant.now().toString());

        // Avoid memory leak from E2E suite
        if (sentEmails.size() > 500) {
            sentEmails.remove(0);
        }
        sentEmails.add(email);
    }
}
