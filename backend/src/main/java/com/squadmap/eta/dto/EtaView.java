package com.squadmap.eta.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.squadmap.eta.domain.Eta;
import com.squadmap.eta.domain.TravelMode;

import java.time.Instant;
import java.util.UUID;

/**
 * A member's ETA as the trip sees it, on {@code /topic/trip.{id}.eta} and in {@code GET /trips/{id}/eta}.
 *
 * @param distanceM metres left along the route
 * @param durationS seconds left
 * @param route     the route still to go, polyline6, or null when estimated without one
 * @param progress  share of the way done, 0 to 1
 * @param estimated true when worked out without a fresh route
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record EtaView(UUID memberId, long distanceM, long durationS, TravelMode mode, String route, double progress,
                      boolean estimated, Instant computedAt) {

    public static EtaView of(Eta eta) {
        return new EtaView(eta.memberId(), Math.round(eta.distanceM()), Math.round(eta.durationS()), eta.mode(),
                eta.route(), Math.round(eta.progress() * 100) / 100.0, eta.estimated(), eta.computedAt());
    }
}
