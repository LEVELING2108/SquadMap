package com.squadmap.eta.web;

import com.squadmap.common.security.Caller;
import com.squadmap.eta.dto.EtaView;
import com.squadmap.eta.dto.TravelModeRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import com.squadmap.eta.service.EtaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@Tag(name = "Live map")
public class EtaController {

    private final EtaService etas;

    public EtaController(EtaService etas) {
        this.etas = etas;
    }

    @GetMapping("/api/v1/trips/{tripId}/eta")
    @Operation(summary = "Everyone's ETA to the destination",
            description = "Distance and time left, how they travel, the route still to go (polyline6) and "
                    + "progress, for each member sharing their location who hasn't arrived. Changes arrive live on "
                    + "/topic/trip.{id}.eta. Empty when the trip has no destination. Open to guests for their trip.")
    public List<EtaView> etas(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId) {
        return etas.snapshot(tripId, Caller.from(token));
    }

    @PutMapping("/api/v1/trips/{tripId}/members/me/travel-mode")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Say how I'm travelling",
            description = "car, bike (a motorbike or scooter, routed like a car) or walk. Until set, the app takes "
                    + "car beyond 2 km from the destination and walk nearer. The ETA is worked out again at once and "
                    + "sent on /topic/trip.{id}.eta. Open to guests for their trip.")
    public void chooseMode(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId,
                           @RequestBody TravelModeRequest request) {
        etas.chooseMode(tripId, Caller.from(token), request.mode());
    }
}
