package com.squadmap.invite.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** One person's agreement to share their location on one trip, kept as proof of consent. */
@Entity
@Table(name = "consent_log")
public class LocationConsent {

    @Id
    private UUID id;

    @Column(name = "trip_member_id", nullable = false)
    private UUID tripMemberId;

    @Column(name = "policy_version", nullable = false)
    private String policyVersion;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    protected LocationConsent() {
        // for JPA
    }

    public LocationConsent(UUID id, UUID tripMemberId, String policyVersion, Instant grantedAt) {
        this.id = id;
        this.tripMemberId = tripMemberId;
        this.policyVersion = policyVersion;
        this.grantedAt = grantedAt;
    }
}
