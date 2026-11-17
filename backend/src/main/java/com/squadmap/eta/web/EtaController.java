package com.squadmap.eta.web;

import com.squadmap.common.security.Caller;
import com.squadmap.eta.dto.EtaView;
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
}
