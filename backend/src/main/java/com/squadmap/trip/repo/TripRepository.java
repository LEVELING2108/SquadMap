package com.squadmap.trip.repo;

import com.squadmap.trip.domain.Trip;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
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

    /** Locks a trip while its host changes it, so an extend and an end can't interleave. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Trip t WHERE t.id = :id")
    Optional<Trip> lockById(@Param("id") UUID id);

    /**
     * Records every trip whose time has run out as expired. Safe to run on several instances at once:
     * a trip can only move from active to expired once.
     */
    @Modifying
    @Query("""
            UPDATE Trip t SET t.status = com.squadmap.trip.domain.TripStatus.expired
            WHERE t.status = com.squadmap.trip.domain.TripStatus.active AND t.expiresAt <= :now
            """)
    int expireDue(@Param("now") Instant now);

    /** Location consent ends with the trip: marks it withdrawn for every trip that is over. */
    @Modifying
    @Query(nativeQuery = true, value = """
            UPDATE consent_log c SET withdrawn_at = :now
            FROM trip_members m JOIN trips t ON t.id = m.trip_id
            WHERE c.trip_member_id = m.id AND c.withdrawn_at IS NULL AND t.status <> 'active'
            """)
    int withdrawConsentForFinishedTrips(@Param("now") Instant now);

    /** Location consent ends when a person leaves. */
    @Modifying
    @Query(nativeQuery = true, value = """
            UPDATE consent_log SET withdrawn_at = :now
            WHERE trip_member_id = :memberId AND withdrawn_at IS NULL
            """)
    int withdrawConsentOf(@Param("memberId") UUID memberId, @Param("now") Instant now);

    @Query("""
            SELECT count(t) FROM Trip t
            WHERE t.hostId = :hostId AND t.status = com.squadmap.trip.domain.TripStatus.active
              AND t.expiresAt > :now
            """)
    long countLiveHostedBy(@Param("hostId") UUID hostId, @Param("now") Instant now);
}
