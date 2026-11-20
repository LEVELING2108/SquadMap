package com.squadmap.notify.push;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    /** Oldest first, so the ones past the device limit are at the front. */
    List<PushSubscription> findByUserIdOrderByCreatedAtAscIdAsc(UUID userId);

    @Modifying
    @Query("DELETE FROM PushSubscription s WHERE s.userId = :userId AND s.endpoint = :endpoint")
    int deleteByUserIdAndEndpoint(@Param("userId") UUID userId, @Param("endpoint") String endpoint);

    /** Runs in its own transaction when there is none, as when sending. */
    @Transactional
    @Modifying
    @Query("DELETE FROM PushSubscription s WHERE s.id = :id")
    int deleteNow(@Param("id") UUID id);
}
