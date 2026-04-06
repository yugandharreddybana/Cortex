package com.cortex.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.context.annotation.Profile;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;

@RestController
@RequestMapping("/api/v1/test/emails")
@CrossOrigin(origins = "*")
@Profile({"dev", "test"})
public class TestEmailController {

    private final List<Map<String, String>> sentEmails = new ArrayList<>();

    @GetMapping
    public List<Map<String, String>> getSentEmails() {
        return new ArrayList<>(sentEmails);
    }
}
