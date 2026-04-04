package com.cortex.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class HighlightDTO {
    public Long id;
    public String text;
    public String source;
    public String url;
    public String topic;
    public String topicColor;
    public String savedAt;
    public String folder;
    public String folderName; // Helper for some UI views
    public Long folderId;
    public String note;
    public List<TagDTO> tags;
    public List<String> tagIds;

    public Boolean isCode;
    public Boolean isFavorite;
    public Boolean isArchived;
    public Boolean isPinned;
    public String highlightColor;
    public Boolean isAI;
    public String chatName;
    public String chatUrl;
    public String resourceType;
    public Integer videoTimestamp;
    public String linkAccess;
    public String defaultLinkRole;

    // Soft deletion support
    public Boolean isDeleted;
    public Instant deletedAt;
}
