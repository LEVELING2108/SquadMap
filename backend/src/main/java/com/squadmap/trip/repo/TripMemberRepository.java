package com.squadmap.trip.repo;

import com.squadmap.trip.domain.TripMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripMemberRepository extends JpaRepository<TripMember, UUID> {

    List<TripMember> findByTripIdAndLeftAtIsNullOrderByJoinedAt(UUID tripId);

    Optional<TripMember> findByTripIdAndUserIdAndLeftAtIsNull(UUID tripId, UUID userId);

    long countByTripIdAndLeftAtIsNull(UUID tripId);
}
