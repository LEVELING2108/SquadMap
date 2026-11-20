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
@Table(name = "trip_members")
public class TripMember {

    @Id
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    /** Empty for guests, who join without an account. */
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(nullable = false)
    private String color;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(10)")
    private MemberRole role;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    @Column(name = "left_at")
    private Instant leftAt;

    /** When they reached the destination: within 60 m for 20 seconds. Set once, by an UPDATE. */
    @Column(name = "arrived_at", insertable = false, updatable = false)
    private Instant arrivedAt;

    /** How they said they are travelling; set by an UPDATE (see TripMemberRepository#setTravelMode). */
    @Column(name = "travel_mode", insertable = false, updatable = false)
    private String travelMode;

    /** When they paused sharing their location, or null while they share. Set by an UPDATE (see #pause). */
    @Column(name = "paused_at", insertable = false, updatable = false)
    private Instant pausedAt;

    /** Metres moved while sharing, saved when the trip ends or they leave; null if they never shared. */
    @Column(name = "distance_m")
    private Integer distanceM;

    protected TripMember() {
        // for JPA
    }

    public TripMember(UUID id, UUID tripId, UUID userId, String displayName, String color, MemberRole role,
                      Instant now) {
        this.id = id;
        this.tripId = tripId;
        this.userId = userId;
        this.displayName = displayName;
        this.color = color;
        this.role = role;
        this.joinedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTripId() {
        return tripId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getColor() {
        return color;
    }

    public MemberRole getRole() {
        return role;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }

    public Instant getArrivedAt() {
        return arrivedAt;
    }

    /** "car", "bike" or "walk" as the member chose, or null before they choose. */
    public String getTravelMode() {
        return travelMode;
    }

    public Instant getPausedAt() {
        return pausedAt;
    }

    public Integer getDistanceM() {
        return distanceM;
    }

    /** Saves how far they moved on the trip. Null keeps "never shared". */
    public void recordDistance(Integer metres) {
        if (metres != null) {
            this.distanceM = Math.max(0, metres);
        }
    }

    public boolean isActive() {
        return leftAt == null;
    }

    public void leave(Instant now) {
        this.leftAt = now;
    }
}
