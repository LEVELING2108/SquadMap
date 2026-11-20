package com.squadmap.notify.alert;

import java.util.UUID;

/** Published when an alert is saved; push notifications go out once the change is committed. */
public record AlertSaved(UUID alertId, UUID userId, AlertKind kind, UUID tripId, String tripName, String actorName) {
}
