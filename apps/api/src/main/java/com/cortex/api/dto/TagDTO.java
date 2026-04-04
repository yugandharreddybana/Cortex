package com.cortex.api.dto;

public class TagDTO {
    public Long id;
    public String name;
    public String color;

    public TagDTO() {}

    public TagDTO(Long id, String name, String color) {
        this.id = id;
        this.name = name;
        this.color = color;
    }
}
