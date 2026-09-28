package com.squadmap.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "participants", indexes = {
    @Index(name = "idx_participant_session", columnList = "sessionId")
})
public class Participant {

    @Id
    private String id;

    @Column(nullable = false)
    private String sessionId;

    @Column(nullable = false)
    private String displayName;

    @Column(length = 16)
    private String colorHex;

    private Double lat;

    private Double lng;

    private Double speed; // in km/h

    private Double heading; // 0 to 360 degrees

    private Boolean isPaused = false;

    private Boolean hasArrived = false;

    private Instant lastPing;

    @Column(nullable = false)
    private Instant joinedAt;

    public Participant() {}

    public Participant(String id, String sessionId, String displayName, String colorHex) {
        this.id = id;
        this.sessionId = sessionId;
        this.displayName = displayName;
        this.colorHex = colorHex;
        this.joinedAt = Instant.now();
        this.lastPing = Instant.now();
        this.isPaused = false;
        this.hasArrived = false;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getColorHex() { return colorHex; }
    public void setColorHex(String colorHex) { this.colorHex = colorHex; }

    public Double getLat() { return lat; }
    public void setLat(Double lat) { this.lat = lat; }

    public Double getLng() { return lng; }
    public void setLng(Double lng) { this.lng = lng; }

    public Double getSpeed() { return speed; }
    public void setSpeed(Double speed) { this.speed = speed; }

    public Double getHeading() { return heading; }
    public void setHeading(Double heading) { this.heading = heading; }

    public Boolean getIsPaused() { return isPaused; }
    public void setIsPaused(Boolean isPaused) { this.isPaused = isPaused; }

    public Boolean getHasArrived() { return hasArrived; }
    public void setHasArrived(Boolean hasArrived) { this.hasArrived = hasArrived; }

    public Instant getLastPing() { return lastPing; }
    public void setLastPing(Instant lastPing) { this.lastPing = lastPing; }

    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }
}
