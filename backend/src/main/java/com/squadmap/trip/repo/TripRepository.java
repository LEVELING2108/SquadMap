package com.squadmap.trip.repo;

import com.squadmap.trip.domain.Trip;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID> {

    boolean existsByCode(String code);

    Optional<Trip> findByCode(String code);

    /** Locks the trip while someone joins, so two people can't both take its last place. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Trip t WHERE t.code = :code")
    Optional<Trip> lockByCode(@Param("code") String code);

    /** Trips an account is currently on, newest first, that have not ended or run out. */
    @Query("""
            SELECT t FROM Trip t, TripMember m
            WHERE m.tripId = t.id AND m.userId = :userId AND m.leftAt IS NULL
              AND t.status = com.squadmap.trip.domain.TripStatus.active AND t.expiresAt > :now
            ORDER BY t.createdAt DESC
            """)
    List<Trip> findLiveForUser(@Param("userId") UUID userId, @Param("now") Instant now);

    @Query("""
            SELECT count(t) FROM Trip t
            WHERE t.hostId = :hostId AND t.status = com.squadmap.trip.domain.TripStatus.active
              AND t.expiresAt > :now
            """)
    long countLiveHostedBy(@Param("hostId") UUID hostId, @Param("now") Instant now);
}
