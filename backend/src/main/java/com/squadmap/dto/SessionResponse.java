package com.squadmap.dto;

import java.time.Instant;
import java.util.List;

public record SessionResponse(
    String id,
    String code,
    String name,
    String destinationName,
    Double destinationLat,
    Double destinationLng,
    Instant createdAt,
    Instant expiresAt,
    String status,
    List<ParticipantDto> participants
) {}
