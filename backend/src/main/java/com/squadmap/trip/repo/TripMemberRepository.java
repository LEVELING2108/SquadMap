package com.squadmap.trip.repo;

import com.squadmap.trip.domain.TripMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripMemberRepository extends JpaRepository<TripMember, UUID> {

    List<TripMember> findByTripIdAndLeftAtIsNullOrderByJoinedAt(UUID tripId);

    Optional<TripMember> findByTripIdAndUserIdAndLeftAtIsNull(UUID tripId, UUID userId);

    long countByTripIdAndLeftAtIsNull(UUID tripId);

    Optional<TripMember> findByIdAndTripIdAndLeftAtIsNull(UUID id, UUID tripId);

    /** Everyone who was ever on these trips, including people who left, in the order they joined. */
    List<TripMember> findByTripIdInOrderByJoinedAt(Collection<UUID> tripIds);

    @Query(nativeQuery = true, value = "SELECT count(DISTINCT trip_id) FROM trip_members WHERE user_id = :userId")
    long countTripsOf(@Param("userId") UUID userId);

    /**
     * Different people the account has shared a trip with, whether or not anyone left. An account counts
     * once; a guest has no identity across trips, so guests count once per name.
     */
    @Query(nativeQuery = true, value = """
            SELECT count(*) FROM (
                SELECT DISTINCT CASE WHEN other.user_id IS NOT NULL THEN 'u:' || other.user_id::text
                                     ELSE 'g:' || lower(other.display_name) END
                FROM trip_members mine
                JOIN trip_members other ON other.trip_id = mine.trip_id
                WHERE mine.user_id = :userId
                  AND (other.user_id IS NULL OR other.user_id <> :userId)
            ) people
            """)
    long countFriendsOf(@Param("userId") UUID userId);
}
