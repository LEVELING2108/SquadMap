package com.squadmap.trip.web;

import com.squadmap.common.security.CurrentUser;
import com.squadmap.place.dto.PlaceResponse;
import com.squadmap.trip.service.TripService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Recent places live with trips because they are read from the account's own trips; the places
 * feature itself never stores anything.
 */
@RestController
@Tag(name = "Places")
public class RecentPlacesController {

    private final TripService trips;

    public RecentPlacesController(TripService trips) {
        this.trips = trips;
    }

    @GetMapping("/api/v1/places/recent")
    @Operation(summary = "My recent destinations",
            description = "Up to 5 different destinations from trips I hosted or joined, newest first.")
    public List<PlaceResponse> recent(@AuthenticationPrincipal Jwt token) {
        return trips.recentDestinations(CurrentUser.id(token)).stream()
                .map(destination -> new PlaceResponse(null, destination.name(), null, destination.lat(),
                        destination.lng(), "recent", null))
                .toList();
    }
}
