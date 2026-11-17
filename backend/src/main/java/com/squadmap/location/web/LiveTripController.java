package com.squadmap.location.web;

import com.squadmap.common.security.Caller;
import com.squadmap.location.dto.LiveMemberResponse;
import com.squadmap.location.dto.LocationUpdate;
import com.squadmap.location.service.LocationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * The live map's REST side: the snapshot it loads first, the switch to start sharing, and a fallback for
 * sending a location when the live connection can't be used. Open to guests for their own trip.
 */
@RestController
@RequestMapping("/api/v1/trips/{tripId}")
@Tag(name = "Live map")
public class LiveTripController {

    private final LocationService locations;

    public LiveTripController(LocationService locations) {
        this.locations = locations;
    }

    @GetMapping("/members")
    @Operation(summary = "Everyone on the trip, with their last known spot",
            description = "Loaded when the live map opens and after the live connection reconnects. A spot is "
                    + "included only for people sharing their location, and only if it is under 10 minutes old.")
    public List<LiveMemberResponse> members(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId) {
        return locations.snapshot(tripId, Caller.from(token));
    }

    @PostMapping("/sharing")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Start sharing my location on this trip",
            description = "Records consent, for people who chose \"Not now\" when joining and for the host. "
                    + "Doing it again changes nothing. Sharing ends when the person leaves or the trip ends.")
    public void startSharing(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId) {
        locations.startSharing(tripId, Caller.from(token));
    }

    @PostMapping("/locations")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Send my location (fallback)",
            description = "The same as sending to /app/trip.{id}.loc on the live connection, with the same "
                    + "checks: 403 NOT_SHARING before sharing is on, 422 LOCATION_REJECTED for accuracy over "
                    + "200 m, a time more than 5 minutes old or in the future, or an impossible jump, and 429 "
                    + "RATE_LIMITED above one update per 2 seconds.")
    public void publish(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId,
                        @RequestBody LocationUpdate update) {
        locations.publish(tripId, Caller.from(token), update);
    }
}
