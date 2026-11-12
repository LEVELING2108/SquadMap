package com.squadmap.invite.repo;

import com.squadmap.invite.domain.LocationConsent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface LocationConsentRepository extends JpaRepository<LocationConsent, UUID> {

    boolean existsByTripMemberIdAndWithdrawnAtIsNull(UUID tripMemberId);
}
