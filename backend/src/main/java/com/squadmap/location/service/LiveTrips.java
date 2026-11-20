package com.squadmap.location.service;

import com.squadmap.eta.service.EtaStore;
import com.squadmap.location.dto.TripEvent;
import com.squadmap.trip.domain.TripMember;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Keeps the live map in step with the trip: tells everyone when people join, leave or arrive and when the
 * trip changes, and deletes spots and ETAs as soon as they may no longer be shared.
 */
@Service
public class LiveTrips {

    private final LiveChannel channel;
    private final PositionStore positions;
    private final EtaStore etas;
    private final DistanceStore distances;
    private final Clock clock;

    public LiveTrips(LiveChannel channel, PositionStore positions, EtaStore etas, DistanceStore distances,
                     Clock clock) {
        this.channel = channel;
        this.positions = positions;
        this.etas = etas;
        this.distances = distances;
        this.clock = clock;
    }

    public void memberJoined(TripMember member) {
        publish(member.getTripId(), TripEvent.Type.MEMBER_JOINED, member, null);
    }

    /**
     * The member's spot and ETA are deleted straight away: they no longer share with this trip. How far they
     * moved is saved with them (the member must be a managed entity), and its running total goes too.
     */
    public void memberLeft(TripMember member) {
        member.recordDistance(distances.total(member.getTripId(), member.getId()));
        distances.delete(member.getTripId(), List.of(member.getId()));
        positions.delete(member.getTripId(), List.of(member.getId()));
        etas.delete(member.getTripId(), List.of(member.getId()));
        publish(member.getTripId(), TripEvent.Type.MEMBER_LEFT, member, null);
    }

    public void sharingStarted(TripMember member) {
        publish(member.getTripId(), TripEvent.Type.SHARING_STARTED, member, null);
    }

    /** The member paused: their spot stays where it was, and their ETA goes, since it would only grow wrong. */
    public void paused(TripMember member) {
        positions.keep(member.getTripId(), member.getId());
        etas.delete(member.getTripId(), List.of(member.getId()));
        publish(member.getTripId(), TripEvent.Type.PAUSED, member, null);
    }

    /** The member is sharing again: their old spot ages out as usual until a new one arrives. */
    public void resumed(TripMember member) {
        positions.expireAgain(member.getTripId(), member.getId());
        publish(member.getTripId(), TripEvent.Type.RESUMED, member, null);
    }

    /** The member reached the destination; their ETA is no longer needed. */
    public void arrived(TripMember member) {
        etas.delete(member.getTripId(), List.of(member.getId()));
        publish(member.getTripId(), TripEvent.Type.ARRIVED, member, null);
    }

    public void extended(UUID tripId, Instant expiresAt) {
        channel.publish(LiveChannel.eventsTopic(tripId),
                new TripEvent(TripEvent.Type.TRIP_EXTENDED, null, null, null, expiresAt, clock.instant()));
    }

    /**
     * Ended by the host or out of time: how far each member moved is saved with them (managed entities),
     * every spot, ETA and running total on the trip is deleted, and everyone is told.
     */
    public void ended(UUID tripId, Collection<TripMember> members) {
        List<UUID> memberIds = members.stream().map(TripMember::getId).toList();
        Map<UUID, Integer> moved = distances.totals(tripId, memberIds);
        members.forEach(member -> member.recordDistance(moved.get(member.getId())));
        distances.delete(tripId, memberIds);
        positions.delete(tripId, memberIds);
        etas.delete(tripId, memberIds);
        channel.publish(LiveChannel.eventsTopic(tripId),
                new TripEvent(TripEvent.Type.TRIP_ENDED, null, null, null, null, clock.instant()));
    }

    private void publish(UUID tripId, TripEvent.Type type, TripMember member, Instant expiresAt) {
        channel.publish(LiveChannel.eventsTopic(tripId), new TripEvent(type, member.getId(),
                member.getDisplayName(), member.getColor(), expiresAt, clock.instant()));
    }
}
