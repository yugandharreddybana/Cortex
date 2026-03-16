package com.cortex.api.controller;

import com.cortex.api.entity.Tag;
import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.service.TagService;
import com.cortex.api.service.WebSocketService;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/tags")
public class TagController {

    private final TagService tagService;
    private final UserRepository userRepo;
    private final WebSocketService webSocketService;

    public TagController(TagService tagService, UserRepository userRepo,
                         WebSocketService webSocketService) {
        this.tagService = tagService;
        this.userRepo = userRepo;
        this.webSocketService = webSocketService;
    }

    @GetMapping
    public List<TagDTO> list(Authentication auth) {
        return tagService.getTagsByUserId(Long.parseLong(auth.getName()))
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<TagDTO> create(Authentication auth, @RequestBody TagDTO dto) {
        User user = resolveUser(auth);
        Tag t = new Tag();
        // Never use client-supplied id — the DB assigns the PK via IDENTITY auto-increment
        t.setUser(user);
        t.setName(dto.name);
        t.setColor(dto.color != null ? dto.color : "#6366f1");
        Tag created = tagService.createTag(t);
        TagDTO result = toDTO(created);
        webSocketService.sendToUser(auth.getName(), "/topic/tags", result);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PatchMapping("/{id}")
    public TagDTO update(Authentication auth,
                         @PathVariable Long id,
                         @RequestBody TagDTO dto) {
        User user = resolveUser(auth);
        TagDTO result = toDTO(tagService.updateTag(id, dto, user));
        webSocketService.sendToUser(auth.getName(), "/topic/tags/updated", result);
        return result;
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Boolean>> delete(Authentication auth,
                                                        @PathVariable Long id) {
        User user = resolveUser(auth);
        tagService.deleteTag(id, user);
        webSocketService.sendToUser(auth.getName(), "/topic/tags/deleted", id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PutMapping("/sync")
    @Transactional
    public List<TagDTO> sync(Authentication auth, @RequestBody List<TagDTO> dtos) {
        User user = resolveUser(auth);
        return tagService.syncTags(user, dtos)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    private User resolveUser(Authentication auth) {
        return userRepo.findById(Long.parseLong(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private TagDTO toDTO(Tag t) {
        TagDTO dto = new TagDTO();
        dto.id = t.getId();
        dto.name = t.getName();
        dto.color = t.getColor();
        return dto;
    }
}