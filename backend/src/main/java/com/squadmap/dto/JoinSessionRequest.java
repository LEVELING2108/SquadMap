package com.squadmap.dto;

import jakarta.validation.constraints.NotBlank;

public record JoinSessionRequest(
    @NotBlank(message = "Display name is required")
    String displayName,

    String colorHex
) {}
