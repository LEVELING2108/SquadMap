package com.squadmap.location.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

/**
 * Something that happened on the trip, sent on {@code /topic/trip.{id}.events}.
 *
 * @param type      what happened
 * @param memberId  who it is about, for member events
 * @param expiresAt the trip's new end time, for {@link Type#TRIP_EXTENDED}
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TripEvent(Type type, UUID memberId, String displayName, String color, Instant expiresAt,
                        Instant at) {

    public enum Type {
        MEMBER_JOINED,
        MEMBER_LEFT,
        /** A member started sharing their location. */
        SHARING_STARTED,
        TRIP_EXTENDED,
        TRIP_ENDED
    }
}
