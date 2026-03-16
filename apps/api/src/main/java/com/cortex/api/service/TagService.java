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

import java.util.List;

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
        for (TagDTO dto : dtos) {
            Tag t;
            if (dto.id != null) {
                // dto.id is already a Long (auto-increment PK); use it directly for upsert lookup
                t = tagRepository.findByIdAndUserId(dto.id, user.getId())
                        .orElseGet(() -> {
                            Tag newTag = new Tag();
                            newTag.setUser(user);
                            return newTag;
                        });
            } else {
                t = new Tag();
                t.setUser(user);
            }
            if (dto.name != null) t.setName(dto.name);
            if (dto.color != null) t.setColor(dto.color);
            tagRepository.save(t);
        }
        return tagRepository.findByUserId(user.getId());
    }
}