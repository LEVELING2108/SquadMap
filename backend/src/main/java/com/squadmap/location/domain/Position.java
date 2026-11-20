package com.squadmap.location.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * One member's last known spot, as kept in Redis for a few minutes and sent to the rest of the trip.
 *
 * @param acc     accuracy radius in metres
 * @param speed   metres per second, when the phone knows it
 * @param heading degrees clockwise from north, when the phone knows it
 * @param ts      when the phone took the reading
 * @param approx  true when the member shares only a rough area (about 220 m), not their spot
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Position(double lat, double lng, double acc, Double speed, Double heading, Instant ts, Boolean approx) {

    public Position(double lat, double lng, double acc, Double speed, Double heading, Instant ts) {
        this(lat, lng, acc, speed, heading, ts, null);
    }

    /** Not part of the JSON: only the {@code approx} field is stored and sent. */
    @JsonIgnore
    public boolean isApproximate() {
        return Boolean.TRUE.equals(approx);
    }
}
