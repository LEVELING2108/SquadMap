package com.squadmap.trip.web;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.security.Caller;
import com.squadmap.common.security.CurrentUser;
import com.squadmap.trip.dto.CreateTripRequest;
import com.squadmap.trip.dto.InviteResponse;
import com.squadmap.trip.dto.TripResponse;
import com.squadmap.trip.service.TripService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/trips")
@Tag(name = "Trips")
public class TripController {

    private final TripService trips;
    private final RateLimiter rateLimiter;

    public TripController(TripService trips, RateLimiter rateLimiter) {
        this.trips = trips;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Start a trip", description = "The caller becomes its host. Returns the invite code and link.")
    public TripResponse create(@AuthenticationPrincipal Jwt token, @Valid @RequestBody CreateTripRequest request) {
        rateLimiter.check(RateLimit.TRIP_CREATE_PER_USER, token.getSubject());
        return trips.create(CurrentUser.id(token), request);
    }

    @GetMapping
    @Operation(summary = "Trips I'm on that are still running", description = "Only status=active is supported.")
    public List<TripResponse> list(@AuthenticationPrincipal Jwt token,
                                   @RequestParam(defaultValue = "active") String status) {
        if (!"active".equals(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, "Only status=active is supported.");
        }
        return trips.liveTripsOf(CurrentUser.id(token));
    }

    @GetMapping("/{tripId}")
    @Operation(summary = "One trip I'm on", description = "Also open to a guest, for the trip their pass is for.")
    public TripResponse get(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId) {
        return trips.get(tripId, Caller.from(token));
    }

    @GetMapping("/{tripId}/invite")
    @Operation(summary = "The invite for a trip I'm on: code, link and boarding-pass details")
    public InviteResponse invite(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId) {
        return trips.invite(tripId, CurrentUser.id(token));
    }
}
