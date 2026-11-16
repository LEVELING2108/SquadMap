package com.squadmap.notify.alert;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AlertRepository extends JpaRepository<Alert, UUID> {

    /** Newest first. Alert ids are time-ordered, so "older than this id" pages without repeats. */
    @Query("SELECT a FROM Alert a WHERE a.userId = :userId ORDER BY a.createdAt DESC, a.id DESC")
    List<Alert> findNewestFor(@Param("userId") UUID userId, Limit limit);

    @Query("""
            SELECT a FROM Alert a WHERE a.userId = :userId AND a.id < :before
            ORDER BY a.createdAt DESC, a.id DESC
            """)
    List<Alert> findOlderFor(@Param("userId") UUID userId, @Param("before") UUID before, Limit limit);

    Optional<Alert> findByIdAndUserId(UUID id, UUID userId);

    long countByUserIdAndReadAtIsNull(UUID userId);

    @Modifying
    @Query("UPDATE Alert a SET a.readAt = :now WHERE a.userId = :userId AND a.readAt IS NULL")
    int markAllRead(@Param("userId") UUID userId, @Param("now") Instant now);

    /** Which of these trips are still running, to know where tapping an alert should lead. */
    @Query("""
            SELECT t.id FROM Trip t
            WHERE t.id IN :tripIds AND t.status = com.squadmap.trip.domain.TripStatus.active AND t.expiresAt > :now
            """)
    List<UUID> liveTripsAmong(@Param("tripIds") List<UUID> tripIds, @Param("now") Instant now);

    @Modifying
    @Query("DELETE FROM Alert a WHERE a.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
