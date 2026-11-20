package com.squadmap.notify.push;

import com.squadmap.notify.alert.AlertSaved;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Pushes each alert once it is committed, on its own thread: a slow push service never holds up ending a
 * trip, and an action that is rolled back sends nothing.
 */
@Component
public class PushOnAlert {

    private static final Logger log = LoggerFactory.getLogger(PushOnAlert.class);

    private final PushService push;

    public PushOnAlert(PushService push) {
        this.push = push;
    }

    @Async
    @TransactionalEventListener
    public void alertSaved(AlertSaved alert) {
        try {
            push.send(alert);
        } catch (RuntimeException e) {
            log.warn("Push for an alert failed: {}", e.getClass().getSimpleName());
        }
    }
}
