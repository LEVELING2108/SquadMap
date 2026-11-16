package com.squadmap.notify.alert;

import java.time.Instant;
import java.util.UUID;

/**
 * @param actorName the friend it is about (joined, left), as they were named then; null otherwise
 * @param tripLive  whether the trip is still running, so the app knows where tapping should lead
 */
public record AlertResponse(UUID id, AlertKind kind, UUID tripId, String tripName, String actorName,
                            String actorColor, Instant createdAt, boolean read, boolean tripLive) {

    static AlertResponse of(Alert alert, boolean tripLive) {
        return new AlertResponse(alert.getId(), alert.getKind(), alert.getTripId(), alert.getTripName(),
                alert.getActorName(), alert.getActorColor(), alert.getCreatedAt(), alert.getReadAt() != null,
                tripLive);
    }
}
