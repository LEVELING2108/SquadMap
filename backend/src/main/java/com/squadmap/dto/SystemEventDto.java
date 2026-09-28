package com.squadmap.dto;

import java.time.Instant;

public record SystemEventDto(
    String type, // "SESSION_EXPIRED", "SESSION_ENDED", "DESTINATION_UPDATED"
    String message,
    Instant timestamp,
    Object data
) {}
