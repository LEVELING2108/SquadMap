package com.squadmap.notify.alert;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "alerts")
public class Alert {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertKind kind;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "trip_name", nullable = false)
    private String tripName;

    @Column(name = "actor_name")
    private String actorName;

    @Column(name = "actor_color")
    private String actorColor;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    protected Alert() {
        // for JPA
    }

    public Alert(UUID id, UUID userId, AlertKind kind, UUID tripId, String tripName, String actorName,
                 String actorColor, Instant createdAt) {
        this.id = id;
        this.userId = userId;
        this.kind = kind;
        this.tripId = tripId;
        this.tripName = tripName;
        this.actorName = actorName;
        this.actorColor = actorColor;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public AlertKind getKind() {
        return kind;
    }

    public UUID getTripId() {
        return tripId;
    }

    public String getTripName() {
        return tripName;
    }

    public String getActorName() {
        return actorName;
    }

    public String getActorColor() {
        return actorColor;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public void markRead(Instant now) {
        if (readAt == null) {
            readAt = now;
        }
    }
}
