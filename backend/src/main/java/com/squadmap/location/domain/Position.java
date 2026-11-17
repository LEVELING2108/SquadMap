package com.squadmap.location.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * One member's last known spot, as kept in Redis for a few minutes and sent to the rest of the trip.
 *
 * @param acc     accuracy radius in metres
 * @param speed   metres per second, when the phone knows it
 * @param heading degrees clockwise from north, when the phone knows it
 * @param ts      when the phone took the reading
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Position(double lat, double lng, double acc, Double speed, Double heading, Instant ts) {
}
