package com.squadmap.trip.repo;

import com.squadmap.trip.domain.TripMember;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
