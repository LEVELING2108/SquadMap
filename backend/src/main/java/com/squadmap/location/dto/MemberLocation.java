package com.squadmap.location.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.squadmap.location.domain.Position;

import java.time.Instant;
import java.util.UUID;

/** What everyone on the trip receives on {@code /topic/trip.{id}.locations} when a member moves. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MemberLocation(UUID memberId, double lat, double lng, double acc, Double speed, Double heading,
                             Instant ts) {

    public static MemberLocation of(UUID memberId, Position position) {
        return new MemberLocation(memberId, position.lat(), position.lng(), position.acc(), position.speed(),
                position.heading(), position.ts());
    }
}
