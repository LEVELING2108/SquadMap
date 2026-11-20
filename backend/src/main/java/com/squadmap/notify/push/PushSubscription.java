package com.squadmap.notify.push;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** One device that gets an account's push notifications. */
@Entity
@Table(name = "push_subscriptions")
public class PushSubscription {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String endpoint;

    @Column(nullable = false)
    private String p256dh;

    @Column(nullable = false)
    private String auth;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PushSubscription() {
        // for JPA
    }

    public PushSubscription(UUID id, UUID userId, String endpoint, String p256dh, String auth, Instant createdAt) {
        this.id = id;
        this.userId = userId;
        this.endpoint = endpoint;
        this.p256dh = p256dh;
        this.auth = auth;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public String getP256dh() {
        return p256dh;
    }

    public String getAuth() {
        return auth;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    /**
     * The same device signed in to another account, or the browser renewed its keys: from now on it
     * belongs to this account, with these keys.
     */
    public void renew(UUID userId, String p256dh, String auth, Instant now) {
        this.userId = userId;
        this.p256dh = p256dh;
        this.auth = auth;
        this.createdAt = now;
    }
}
