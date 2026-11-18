package com.squadmap.chat.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    /** Time-ordered (UUID v7): newer messages have larger ids. */
    @Id
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    /** The trip member who wrote it. */
    @Column(name = "member_id", nullable = false)
    private UUID memberId;

    /** Chosen by the sender's app; a retried send with the same one returns this message. */
    @Column(name = "client_id")
    private UUID clientId;

    @Column(nullable = false)
    private String body;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ChatMessage() {
        // for JPA
    }

    public ChatMessage(UUID id, UUID tripId, UUID memberId, UUID clientId, String body, Instant createdAt) {
        this.id = id;
        this.tripId = tripId;
        this.memberId = memberId;
        this.clientId = clientId;
        this.body = body;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTripId() {
        return tripId;
    }

    public UUID getMemberId() {
        return memberId;
    }

    public UUID getClientId() {
        return clientId;
    }

    public String getBody() {
        return body;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
