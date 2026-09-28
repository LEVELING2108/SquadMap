package com.squadmap.dto;

import java.time.Instant;

public record ParticipantDto(
    String id,
    String displayName,
    String colorHex,
    Double lat,
    Double lng,
    Double speed,
    Double heading,
    Boolean isPaused,
    Boolean hasArrived,
    Instant lastPing,
    Instant joinedAt
) {}
