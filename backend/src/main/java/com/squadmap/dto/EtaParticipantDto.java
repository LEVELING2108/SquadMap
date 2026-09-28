package com.squadmap.dto;

public record EtaParticipantDto(
    String participantId,
    String displayName,
    String colorHex,
    Double distanceMeters,
    Long durationSeconds,
    String etaFormatted,
    String distanceFormatted,
    Boolean hasArrived,
    Double speedKmh,
    String routeGeometry
) {}
