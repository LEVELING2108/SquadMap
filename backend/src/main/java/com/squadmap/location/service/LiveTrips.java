package com.squadmap.location.service;

import com.squadmap.location.dto.TripEvent;
import com.squadmap.trip.domain.TripMember;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Keeps the live map in step with the trip: tells everyone when people join or leave and when the trip
 * changes, and deletes spots as soon as they may no longer be shared.
 */
@Service
public class LiveTrips {

    private final LiveChannel channel;
    private final PositionStore positions;
    private final Clock clock;

    public LiveTrips(LiveChannel channel, PositionStore positions, Clock clock) {
        this.channel = channel;
        this.positions = positions;
        this.clock = clock;
    }

    public void memberJoined(TripMember member) {
        publish(member.getTripId(), TripEvent.Type.MEMBER_JOINED, member, null);
    }

    /** The member's spot is deleted straight away: they no longer share with this trip. */
    public void memberLeft(TripMember member) {
        positions.delete(member.getTripId(), List.of(member.getId()));
        publish(member.getTripId(), TripEvent.Type.MEMBER_LEFT, member, null);
    }

    public void sharingStarted(TripMember member) {
        publish(member.getTripId(), TripEvent.Type.SHARING_STARTED, member, null);
    }

    public void extended(UUID tripId, Instant expiresAt) {
        channel.publish(LiveChannel.eventsTopic(tripId),
                new TripEvent(TripEvent.Type.TRIP_EXTENDED, null, null, null, expiresAt, clock.instant()));
    }

    /** Ended by the host or out of time: every spot on the trip is deleted and everyone is told. */
    public void ended(UUID tripId, Collection<UUID> memberIds) {
        positions.delete(tripId, memberIds);
        channel.publish(LiveChannel.eventsTopic(tripId),
                new TripEvent(TripEvent.Type.TRIP_ENDED, null, null, null, null, clock.instant()));
    }

    private void publish(UUID tripId, TripEvent.Type type, TripMember member, Instant expiresAt) {
        channel.publish(LiveChannel.eventsTopic(tripId), new TripEvent(type, member.getId(),
                member.getDisplayName(), member.getColor(), expiresAt, clock.instant()));
    }
}
