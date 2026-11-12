package com.squadmap.trip.web;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.security.Caller;
import com.squadmap.common.security.CurrentUser;
import com.squadmap.common.web.IdempotencyKeys;
import com.squadmap.trip.dto.CreateTripRequest;
import com.squadmap.trip.dto.ExtendTripRequest;
import com.squadmap.trip.dto.InviteResponse;
import com.squadmap.trip.dto.TripResponse;
import com.squadmap.trip.service.TripLifecycleService;
import com.squadmap.trip.service.TripService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
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
    private final TripLifecycleService lifecycle;
    private final RateLimiter rateLimiter;
    private final IdempotencyKeys idempotency;

    public TripController(TripService trips, TripLifecycleService lifecycle, RateLimiter rateLimiter,
                          IdempotencyKeys idempotency) {
        this.trips = trips;
        this.lifecycle = lifecycle;
        this.rateLimiter = rateLimiter;
        this.idempotency = idempotency;
    }

    @PostMapping
    @Operation(summary = "Start a trip",
            description = "The caller becomes its host. Returns the invite code and link. Send an "
                    + "Idempotency-Key header so a retried request returns the same trip (200) instead of a second one.")
    public ResponseEntity<TripResponse> create(
            @AuthenticationPrincipal Jwt token, @Valid @RequestBody CreateTripRequest request,
            @RequestHeader(name = IdempotencyKeys.HEADER, required = false) String idempotencyKey) {
        UUID userId = CurrentUser.id(token);
        IdempotencyKeys.Result<TripResponse> result = idempotency.once("trip", userId.toString(), idempotencyKey,
                () -> {
                    rateLimiter.check(RateLimit.TRIP_CREATE_PER_USER, userId.toString());
                    TripResponse created = trips.create(userId, request);
                    return new IdempotencyKeys.IdAnd<>(created.id().toString(), created);
                },
                storedId -> trips.get(UUID.fromString(storedId), Caller.user(userId)));
        return ResponseEntity.status(result.replayed() ? HttpStatus.OK : HttpStatus.CREATED).body(result.value());
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

    @PostMapping("/{tripId}/extend")
    @Operation(summary = "Share for longer (host only)",
            description = "Adds 30, 60 or 120 minutes, up to 12 hours in total. Guests then renew their pass.")
    public TripResponse extend(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId,
                               @Valid @RequestBody ExtendTripRequest request) {
        return lifecycle.extend(tripId, CurrentUser.id(token), request.minutes());
    }

    @PostMapping("/{tripId}/end")
    @Operation(summary = "End the trip for everyone (host only)", description = "Sharing stops and the link dies.")
    public TripResponse end(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId) {
        return lifecycle.end(tripId, CurrentUser.id(token));
    }

    @DeleteMapping("/{tripId}/members/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Leave the trip", description = "Open to members and guests. The host ends the trip instead.")
    public void leave(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId) {
        lifecycle.leave(tripId, Caller.from(token));
    }
}
