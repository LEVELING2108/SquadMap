package com.squadmap.location;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * A live-map client for tests: connects to {@code /ws} the way the web app does, and collects what it
 * receives per destination, plus any ERROR frame the server sends before closing the connection.
 */
public final class LiveClient implements AutoCloseable {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final Map<String, BlockingQueue<JsonNode>> received = new ConcurrentHashMap<>();
    private final BlockingQueue<String> errors = new LinkedBlockingQueue<>();
    private final WebSocketStompClient stomp = new WebSocketStompClient(new StandardWebSocketClient());
    private StompSession session;

    private LiveClient() {
        stomp.setMessageConverter(new MappingJackson2MessageConverter());
    }

    /** Connects with the given access token (or none), waiting up to 5 seconds. */
    public static LiveClient connect(int port, String token) {
        LiveClient client = new LiveClient();
        StompHeaders connect = new StompHeaders();
        if (token != null) {
            connect.add("Authorization", "Bearer " + token);
        }
        try {
            client.session = client.stomp.connectAsync("ws://localhost:" + port + "/ws/websocket",
                    new WebSocketHttpHeaders(), connect, client.new Handler()).get(5, TimeUnit.SECONDS);
        } catch (Exception e) {
            // Refused: the ERROR frame, if any, is in errors().
        }
        return client;
    }

    public boolean connected() {
        return session != null && session.isConnected();
    }

    /**
     * A refused subscription closes the connection, sometimes before the client has finished sending it;
     * that is fine, as the refusal is in {@link #nextError}.
     */
    public void subscribe(String destination) {
        try {
            subscribeOrThrow(destination);
        } catch (RuntimeException closedByTheServer) {
            // See above.
        }
    }

    private void subscribeOrThrow(String destination) {
        session.subscribe(destination, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return JsonNode.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                queue(destination).add((JsonNode) payload);
            }
        });
    }

    public void send(String destination, Object payload) {
        try {
            StompHeaders headers = new StompHeaders();
            headers.setDestination(destination);
            headers.setContentType(org.springframework.util.MimeTypeUtils.APPLICATION_JSON);
            session.send(headers, JSON.valueToTree(payload));
        } catch (RuntimeException closedByTheServer) {
            // As for subscribe: a refused send can close the connection while it is still being sent.
        }
    }

    /** The next message on the destination, or null after the wait. */
    public JsonNode next(String destination, long millis) throws InterruptedException {
        return queue(destination).poll(millis, TimeUnit.MILLISECONDS);
    }

    /** The message of the next ERROR frame, or null after the wait. */
    public String nextError(long millis) throws InterruptedException {
        return errors.poll(millis, TimeUnit.MILLISECONDS);
    }

    private BlockingQueue<JsonNode> queue(String destination) {
        return received.computeIfAbsent(destination, key -> new LinkedBlockingQueue<>());
    }

    @Override
    public void close() {
        try {
            if (connected()) {
                session.disconnect();
            }
        } catch (RuntimeException alreadyClosedByTheServer) {
            // Nothing left to close.
        }
        stomp.stop();
    }

    private final class Handler extends StompSessionHandlerAdapter {
        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            // Only ERROR frames reach the session handler.
            String message = headers.getFirst("message");
            errors.add(message == null ? "" : message);
        }
    }
}
