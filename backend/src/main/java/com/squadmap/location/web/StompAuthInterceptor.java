package com.squadmap.location.web;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.security.Caller;
import com.squadmap.location.service.TripAccess;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Guards the live connection, deny by default. CONNECT must carry a valid access token (an account's or a
 * guest's). A client may only subscribe to the topics of a running trip it is on, plus its own error queue,
 * and may only send location updates and "typing" signals; anything else closes the connection.
 *
 * <p>Refusals become a STOMP ERROR frame whose message is a stable code, such as {@code UNAUTHENTICATED},
 * which the web app reads to decide whether to sign in again or stop.
 */
@Component
public class StompAuthInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompAuthInterceptor.class);

    public static final String ERRORS_QUEUE = "/user/queue/errors";

    private static final String UUID_PATTERN = "([0-9a-fA-F-]{36})";
    private static final Pattern TRIP_TOPIC = Pattern.compile("^/topic/trip\\." + UUID_PATTERN + "\\.(locations|events|eta|chat)$");
    private static final Pattern TRIP_SEND = Pattern.compile("^/app/trip\\." + UUID_PATTERN + "\\.(loc|typing)$");

    private final JwtDecoder tokens;
    private final TripAccess access;
    private final Clock clock;

    public StompAuthInterceptor(JwtDecoder tokens, TripAccess access, Clock clock) {
        this.tokens = tokens;
        this.access = access;
        this.clock = clock;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor stomp = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (stomp == null || stomp.getCommand() == null) {
            return message;
        }
        try {
            switch (stomp.getCommand()) {
                case CONNECT, STOMP -> stomp.setUser(signIn(stomp.getFirstNativeHeader("Authorization")));
                case SUBSCRIBE -> checkSubscribe(principal(stomp), stomp.getDestination());
                case SEND -> checkSend(principal(stomp), stomp.getDestination());
                default -> {
                    // DISCONNECT, UNSUBSCRIBE, ACK and heartbeats need no check.
                }
            }
        } catch (MessageDeliveryException refused) {
            log.debug("Live connection refused: {}", refused.getMessage());
            throw refused;
        } catch (RuntimeException e) {
            // Spring's own log of refusals is switched off (they are routine), so real faults are logged here.
            log.error("Live connection check failed", e);
            throw refuse("INTERNAL_ERROR");
        }
        return message;
    }

    private LivePrincipal signIn(String header) {
        if (header == null || !header.startsWith("Bearer ")) {
            throw refuse("UNAUTHENTICATED");
        }
        try {
            Jwt jwt = tokens.decode(header.substring("Bearer ".length()).trim());
            return new LivePrincipal(Caller.from(jwt), jwt.getExpiresAt());
        } catch (JwtException | IllegalArgumentException e) {
            throw refuse("UNAUTHENTICATED");
        }
    }

    private LivePrincipal principal(StompHeaderAccessor stomp) {
        if (!(stomp.getUser() instanceof LivePrincipal principal)) {
            throw refuse("UNAUTHENTICATED");
        }
        // The connection outlives the token; once it has run out, the client reconnects with a fresh one.
        if (principal.expiresAt() != null && !principal.expiresAt().isAfter(clock.instant())) {
            throw refuse("UNAUTHENTICATED");
        }
        return principal;
    }

    private void checkSubscribe(LivePrincipal principal, String destination) {
        if (ERRORS_QUEUE.equals(destination)) {
            return;
        }
        Matcher topic = destination == null ? null : TRIP_TOPIC.matcher(destination);
        if (topic == null || !topic.matches()) {
            throw refuse("FORBIDDEN");
        }
        requireLiveMember(topic.group(1), principal.caller());
    }

    /** Membership is checked by the service that handles the message, which needs the member anyway. */
    private void checkSend(LivePrincipal principal, String destination) {
        Matcher send = destination == null ? null : TRIP_SEND.matcher(destination);
        if (send == null || !send.matches()) {
            throw refuse("FORBIDDEN");
        }
    }

    private void requireLiveMember(String tripId, Caller caller) {
        UUID trip;
        try {
            trip = UUID.fromString(tripId);
        } catch (IllegalArgumentException e) {
            throw refuse("FORBIDDEN");
        }
        try {
            access.requireLiveMember(trip, caller);
        } catch (ApiException e) {
            throw refuse(e.getCode().name());
        }
    }

    private static MessageDeliveryException refuse(String code) {
        return new MessageDeliveryException(code);
    }
}
