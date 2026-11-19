package com.squadmap.location.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Sends a message to everyone subscribed to a trip topic, on every app instance. Each message goes through
 * Redis pub/sub; every instance, this one included, hears it and hands it to its own connected clients.
 */
@Component
public class LiveChannel implements MessageListener {

    public static final String REDIS_CHANNEL = "squadmap:live";

    private static final Logger log = LoggerFactory.getLogger(LiveChannel.class);

    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate clients;
    private final ObjectMapper json;

    public LiveChannel(StringRedisTemplate redis, SimpMessagingTemplate clients, ObjectMapper json) {
        this.redis = redis;
        this.clients = clients;
        this.json = json;
    }

    public static String locationsTopic(UUID tripId) {
        return "/topic/trip." + tripId + ".locations";
    }

    public static String eventsTopic(UUID tripId) {
        return "/topic/trip." + tripId + ".events";
    }

    public static String etaTopic(UUID tripId) {
        return "/topic/trip." + tripId + ".eta";
    }

    public static String chatTopic(UUID tripId) {
        return "/topic/trip." + tripId + ".chat";
    }

    /**
     * Publishes the message. Inside a transaction it waits for the commit, so nobody hears about a change
     * (a join, a trip ending) that was then rolled back.
     */
    public void publish(String destination, Object payload) {
        String envelope;
        try {
            envelope = json.writeValueAsString(new Envelope(destination, json.valueToTree(payload)));
        } catch (Exception e) {
            throw new IllegalStateException("Live message could not be written", e);
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send(envelope);
                }
            });
        } else {
            send(envelope);
        }
    }

    private void send(String envelope) {
        try {
            redis.convertAndSend(REDIS_CHANNEL, envelope);
        } catch (RuntimeException e) {
            // Clients catch up from the snapshot when they reconnect; the error is visible in the logs.
            log.error("Live message not sent, Redis unavailable: {}", e.getClass().getName());
        }
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            Envelope envelope = json.readValue(new String(message.getBody(), StandardCharsets.UTF_8), Envelope.class);
            if (envelope.destination() != null && envelope.destination().startsWith("/topic/trip.")) {
                clients.convertAndSend(envelope.destination(), envelope.payload());
            }
        } catch (Exception e) {
            log.warn("Live message dropped: {}", e.getClass().getName());
        }
    }

    public record Envelope(String destination, JsonNode payload) {
    }
}
