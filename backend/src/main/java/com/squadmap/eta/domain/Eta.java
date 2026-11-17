package com.squadmap.eta.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

/**
 * A member's way to the destination, as last worked out. Kept in Redis while they share, and sent to the
 * trip on {@code /topic/trip.{id}.eta}.
 *
 * @param distanceM     metres left along the route
 * @param durationS     seconds left
 * @param route         the route still to go, polyline6; null when estimated without one
 * @param progress      share of the way done since the first ETA, 0 to 1
 * @param estimated     true when worked out without a fresh route (Mapbox unavailable or over budget)
 * @param fromLat       where the member was when this was worked out; decides when it is worth redoing
 * @param startDistanceM the distance at the first ETA, which progress is measured against
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Eta(UUID memberId, double distanceM, double durationS, TravelMode mode, String route,
                  double progress, boolean estimated, Instant computedAt, double fromLat, double fromLng,
                  double startDistanceM) {
}
