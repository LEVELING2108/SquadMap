package com.squadmap;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;

/**
 * Stands in for a browser push service in tests: keeps every message it is sent and answers with the status
 * the test sets for that address. One instance serves the whole test run.
 */
public final class FakePushService {

    /** One message as it arrived. */
    public record Received(String path, Map<String, String> headers, byte[] body) {
    }

    private static FakePushService instance;

    private final HttpServer server;
    private final List<Received> received = new CopyOnWriteArrayList<>();
    private final Map<String, Integer> statuses = new ConcurrentHashMap<>();

    private FakePushService() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            Map<String, String> headers = new ConcurrentHashMap<>();
            exchange.getRequestHeaders().forEach((name, values) -> headers.put(name.toLowerCase(), values.get(0)));
            byte[] body = exchange.getRequestBody().readAllBytes();
            received.add(new Received(path, headers, body));
            exchange.sendResponseHeaders(statuses.getOrDefault(path, 201), -1);
            exchange.close();
        });
        server.start();
    }

    public static synchronized FakePushService get() {
        if (instance == null) {
            instance = new FakePushService();
        }
        return instance;
    }

    /** A push address for one pretend device. */
    public String endpoint(String device) {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/push/" + device;
    }

    public void answer(String device, int status) {
        statuses.put("/push/" + device, status);
    }

    public void reset() {
        received.clear();
        statuses.clear();
    }

    public List<Received> received() {
        return List.copyOf(received);
    }

    /** Waits until at least this many messages have arrived, or the time is up. */
    public List<Received> await(int count, Duration within) throws InterruptedException {
        long until = System.nanoTime() + within.toNanos();
        while (received.size() < count && System.nanoTime() < until) {
            Thread.sleep(25);
        }
        return received();
    }
}
