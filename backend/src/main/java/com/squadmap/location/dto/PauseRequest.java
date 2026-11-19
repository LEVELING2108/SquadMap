package com.squadmap.location.dto;

import jakarta.validation.constraints.NotNull;

/** @param paused true to pause sharing my location, false to share it again */
public record PauseRequest(@NotNull(message = "Say whether to pause or resume.") Boolean paused) {
}
