package com.squadmap.user.domain;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String color;

    @Column(name = "terms_version", nullable = false)
    private String termsVersion;

    @Column(name = "terms_accepted_at", nullable = false)
    private Instant termsAcceptedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> settings = new HashMap<>();

    protected User() {
        // for JPA
    }

    public User(UUID id, String email, String passwordHash, String name, String color,
                String termsVersion, Instant now) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.name = name;
        this.color = color;
        this.termsVersion = termsVersion;
        this.termsAcceptedAt = now;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getName() {
        return name;
    }

    public String getColor() {
        return color;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public UserSettings getSettings() {
        return UserSettings.fromJson(settings);
    }

    public void changeSettings(UserSettings changed, Instant now) {
        // Keys this version doesn't know are kept, so an older server never erases a newer one's settings.
        Map<String, Object> merged = new HashMap<>(settings == null ? Map.of() : settings);
        merged.putAll(changed.toJson());
        this.settings = merged;
        this.updatedAt = now;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public void changePasswordHash(String newHash, Instant now) {
        this.passwordHash = newHash;
        this.updatedAt = now;
    }

    public void changeProfile(String newName, String newColor, Instant now) {
        this.name = newName;
        this.color = newColor;
        this.updatedAt = now;
    }

    /** @param newEmail already normalised to lower case */
    public void changeEmail(String newEmail, Instant now) {
        this.email = newEmail;
        this.updatedAt = now;
    }
}
