package com.squadmap.trip.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * @param destination optional: a trip can start without one
 * @param shareHours  how long location sharing lasts: 1, 2, 4 or 8 hours
 */
public record CreateTripRequest(
        @NotBlank(message = "Give the trip a name.")
        @Size(max = 60, message = "Use 60 characters or fewer.")
        String name,

        @Valid
        DestinationInput destination,

        @NotNull(message = "Choose how long to share.")
        Integer shareHours,

        boolean chatEnabled) {

    public record DestinationInput(
            @NotBlank(message = "Destination needs a name.")
            @Size(max = 120, message = "Use 120 characters or fewer.")
            String name,

            @NotNull @DecimalMin("-90") @DecimalMax("90")
            Double lat,

            @NotNull @DecimalMin("-180") @DecimalMax("180")
            Double lng) {
    }
}
