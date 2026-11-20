package com.squadmap.location.dto;

import java.time.Instant;

/**
 * A reading sent by a member's phone, over the live connection ({@code /app/trip.{id}.loc}) or the REST
 * fallback. Checked by {@code LocationService}, which gives the same answer for both.
 *
 * @param acc     accuracy radius in metres, as the browser reports it
 * @param speed   metres per second, or null when unknown
 * @param heading degrees clockwise from north, or null when unknown
 * @param ts          when the reading was taken, ISO-8601 UTC
 * @param approximate true when the person shares only a rough area; the app has already snapped it
 */
public record LocationUpdate(Double lat, Double lng, Double acc, Double speed, Double heading, Instant ts,
                             Boolean approximate) {

    public LocationUpdate(Double lat, Double lng, Double acc, Double speed, Double heading, Instant ts) {
        this(lat, lng, acc, speed, heading, ts, null);
    }
}
