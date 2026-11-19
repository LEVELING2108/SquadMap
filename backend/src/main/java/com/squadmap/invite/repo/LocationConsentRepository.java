package com.squadmap.invite.repo;

import com.squadmap.invite.domain.LocationConsent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

public interface LocationConsentRepository extends JpaRepository<LocationConsent, UUID> {

    boolean existsByTripMemberIdAndWithdrawnAtIsNull(UUID tripMemberId);

    /** Of these trip members, the ones currently sharing their location. */
    @Query("SELECT c.tripMemberId FROM LocationConsent c WHERE c.tripMemberId IN :memberIds AND c.withdrawnAt IS NULL")
    Set<UUID> findSharing(@Param("memberIds") Collection<UUID> memberIds);
}
