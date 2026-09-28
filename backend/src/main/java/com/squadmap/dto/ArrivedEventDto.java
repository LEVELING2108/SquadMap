package com.squadmap.dto;

import java.time.Instant;

public record ArrivedEventDto(
    String userId,
    String displayName,
    Instant arrivalTime,
    String message
) {}
