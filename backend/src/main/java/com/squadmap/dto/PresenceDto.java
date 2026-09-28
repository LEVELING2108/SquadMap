package com.squadmap.dto;

import java.time.Instant;

public record PresenceDto(
    String userId,
    String displayName,
    String colorHex,
    String action, // "JOIN", "LEAVE", "PAUSE", "RESUME"
    Instant timestamp
) {}
