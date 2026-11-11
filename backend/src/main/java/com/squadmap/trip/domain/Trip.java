package com.squadmap.trip.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "trips")
public class Trip {

    @Id
    private UUID id;

    @Column(name = "host_id", nullable = false)
    private UUID hostId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String code;

    @Column(name = "dest_name")
    private String destinationName;

    @Column(name = "dest_lat")
    private Double destinationLat;

    @Column(name = "dest_lng")
    private Double destinationLng;

    @Column(name = "chat_enabled", nullable = false)
    private boolean chatEnabled;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(10)")
    private TripStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Trip() {
        // for JPA
    }

    public Trip(UUID id, UUID hostId, String name, String code, Destination destination, boolean chatEnabled,
                Instant now, Instant expiresAt) {
        this.id = id;
        this.hostId = hostId;
        this.name = name;
        this.code = code;
        if (destination != null) {
            this.destinationName = destination.name();
            this.destinationLat = destination.lat();
            this.destinationLng = destination.lng();
        }
        this.chatEnabled = chatEnabled;
        this.startsAt = now;
        this.expiresAt = expiresAt;
        this.status = TripStatus.active;
        this.createdAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getHostId() {
        return hostId;
    }

    public String getName() {
        return name;
    }

    public String getCode() {
        return code;
    }

    public Destination getDestination() {
        return destinationName == null ? null : new Destination(destinationName, destinationLat, destinationLng);
    }

    public boolean isChatEnabled() {
        return chatEnabled;
    }

    public Instant getStartsAt() {
        return startsAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    /**
     * The status as of now. A trip past its expiry counts as expired even before the scheduled
     * job has recorded it, so nobody can join a trip that should already be over.
     */
    public TripStatus statusAt(Instant now) {
        if (status == TripStatus.active && !expiresAt.isAfter(now)) {
            return TripStatus.expired;
        }
        return status;
    }

    public boolean isLiveAt(Instant now) {
        return statusAt(now) == TripStatus.active;
    }
}
