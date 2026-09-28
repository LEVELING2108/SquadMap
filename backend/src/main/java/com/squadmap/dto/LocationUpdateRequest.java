package com.squadmap.dto;

public record LocationUpdateRequest(
    String sessionCode,
    String userId,
    Double lat,
    Double lng,
    Double speed,
    Double heading,
    Boolean isPaused
) {}
