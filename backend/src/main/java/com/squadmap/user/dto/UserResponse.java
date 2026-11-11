package com.squadmap.user.dto;

import com.squadmap.user.domain.User;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(UUID id, String name, String email, String color, Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getColor(), user.getCreatedAt());
    }
}
