package com.squadmap.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateSessionRequest(
    @NotBlank(message = "Session or trip name is required")
    String name,

    @NotBlank(message = "Host display name is required")
    String hostDisplayName,

    String hostColorHex,

    String destinationName,

    @NotNull(message = "Destination latitude is required")
    Double destinationLat,

    @NotNull(message = "Destination longitude is required")
    Double destinationLng
) {}
