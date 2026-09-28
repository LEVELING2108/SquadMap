package com.squadmap.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "sessions")
public class Session {

    @Id
    private String id;

    @Column(nullable = false, unique = true, length = 16)
    private String code;

    @Column(nullable = false)
    private String name;

    private String destinationName;

    private Double destinationLat;

    private Double destinationLng;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;

    @Column(nullable = false, length = 32)
    private String status = "ACTIVE"; // ACTIVE, EXPIRED, ENDED

    public Session() {}

    public Session(String id, String code, String name, String destinationName, Double destinationLat, Double destinationLng, Instant createdAt, Instant expiresAt) {
        this.id = id;
        this.code = code;
        this.name = name;
        this.destinationName = destinationName;
        this.destinationLat = destinationLat;
        this.destinationLng = destinationLng;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.status = "ACTIVE";
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDestinationName() { return destinationName; }
    public void setDestinationName(String destinationName) { this.destinationName = destinationName; }

    public Double getDestinationLat() { return destinationLat; }
    public void setDestinationLat(Double destinationLat) { this.destinationLat = destinationLat; }

    public Double getDestinationLng() { return destinationLng; }
    public void setDestinationLng(Double destinationLng) { this.destinationLng = destinationLng; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
