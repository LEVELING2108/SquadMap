package com.squadmap.trip.web;

import com.squadmap.common.security.CurrentUser;
import com.squadmap.trip.dto.TripHistoryResponse;
import com.squadmap.trip.service.TripService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@Tag(name = "Trips")
public class TripHistoryController {

    private final TripService trips;

    public TripHistoryController(TripService trips) {
        this.trips = trips;
    }

    @GetMapping("/api/v1/me/trips")
    @Operation(summary = "My trip history",
            description = "Every trip I hosted or joined, running or over, newest first, with who else was on it. "
                    + "Pass the previous page's nextBefore as `before` for older trips.")
    public TripHistoryResponse history(
            @AuthenticationPrincipal Jwt token,
            @Parameter(description = "Return trips older than this trip id")
            @RequestParam(required = false) UUID before,
            @RequestParam(defaultValue = "20")
            @Min(value = 1, message = "Ask for at least 1.") @Max(value = 50, message = "Ask for 50 or fewer.")
            int limit) {
        return trips.history(CurrentUser.id(token), before, limit);
    }
}
