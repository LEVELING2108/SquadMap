package com.squadmap.trip.dto;

import jakarta.validation.constraints.NotNull;

/** @param minutes how much longer to share: 30, 60 or 120 */
public record ExtendTripRequest(@NotNull(message = "Choose how much longer to share.") Integer minutes) {
}
