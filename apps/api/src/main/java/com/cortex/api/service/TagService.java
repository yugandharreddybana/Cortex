package com.cortex.api.service;

import com.cortex.api.controller.TagDTO;
import com.cortex.api.entity.Tag;
import com.cortex.api.entity.User;
import com.cortex.api.repository.HighlightTagRepository;
import com.cortex.api.repository.TagRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TagService {

    private final TagRepository tagRepository;
    private final HighlightTagRepository highlightTagRepository;

    @Autowired
    public TagService(TagRepository tagRepository, HighlightTagRepository highlightTagRepository) {
        this.tagRepository = tagRepository;
        this.highlightTagRepository = highlightTagRepository;
    }

    public List<Tag> getTagsByUserId(Long userId) {
        return tagRepository.findByUserId(userId);
    }

    @Transactional
    public Tag createTag(Tag tag) {
        return tagRepository.save(tag);
    }

    @Transactional
    public Tag updateTag(Long tagId, TagDTO dto, User user) {
        Tag t = tagRepository.findByIdAndUserId(tagId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (dto.name != null) t.setName(dto.name);
        if (dto.color != null) t.setColor(dto.color);
        return tagRepository.save(t);
    }

    @Transactional
    public void deleteTag(Long tagId, User user) {
        Tag t = tagRepository.findByIdAndUserId(tagId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // Remove all highlight-tag associations before deleting the tag
        highlightTagRepository.deleteByTagId(tagId);
        tagRepository.delete(t);
    }

    @Transactional
    public List<Tag> syncTags(User user, List<TagDTO> dtos) {
        List<Long> existingIds = dtos.stream()
                .filter(dto -> dto.id != null)
                .map(dto -> dto.id)
                .collect(Collectors.toList());

        Map<Long, Tag> existingTagsMap = existingIds.isEmpty() ? Map.of() :
                tagRepository.findByIdInAndUserId(existingIds, user.getId()).stream()
                .collect(Collectors.toMap(Tag::getId, tag -> tag));

        List<Tag> tagsToSave = new ArrayList<>();

        for (TagDTO dto : dtos) {
            Tag t;
            if (dto.id != null) {
                // dto.id is already a Long (auto-increment PK); use it directly for upsert lookup
                t = existingTagsMap.getOrDefault(dto.id, new Tag());
                if (t.getId() == null) {
                    t.setUser(user);
                }
            } else {
                t = new Tag();
                t.setUser(user);
            }
            if (dto.name != null) t.setName(dto.name);
            if (dto.color != null) t.setColor(dto.color);
            tagsToSave.add(t);
        }

        tagRepository.saveAll(tagsToSave);

        return tagRepository.findByUserId(user.getId());
    }
}