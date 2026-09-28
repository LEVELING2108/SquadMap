package com.squadmap.dto;

import java.time.Instant;

public record LocationBroadcastDto(
    String userId,
    Double lat,
    Double lng,
    Double speed,
    Double heading,
    Boolean isPaused,
    Boolean hasArrived,
    Instant timestamp
) {}
