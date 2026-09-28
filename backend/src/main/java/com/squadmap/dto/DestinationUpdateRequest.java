package com.squadmap.dto;

import jakarta.validation.constraints.NotNull;

public record DestinationUpdateRequest(
    String destinationName,

    @NotNull(message = "Latitude is required")
    Double destinationLat,

    @NotNull(message = "Longitude is required")
    Double destinationLng
) {}
