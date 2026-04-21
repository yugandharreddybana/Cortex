package com.cortex.api.controller;

import com.cortex.api.service.EmailService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.context.annotation.Profile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/test/emails")
@Profile("dev")
public class TestEmailController {

    private final EmailService emailService;

    public TestEmailController(EmailService emailService) {
        this.emailService = emailService;
    }

    @GetMapping
    public List<Map<String, String>> getSentEmails() {
        return emailService.getSentEmails();
    }
}
