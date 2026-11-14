package com.squadmap;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;

/**
 * Stands in for Mapbox's geocoding API in tests: answers whatever the test sets and remembers each
 * request's query parameters. One instance serves the whole test run.
 */
public final class FakeMapbox {

    public static final String TOKEN = "test-mapbox-token";

    private static FakeMapbox instance;

    private final HttpServer server;
    private final List<Map<String, String>> requests = new CopyOnWriteArrayList<>();
    private volatile int status;
    private volatile String body;
    private volatile Duration delay;

    private FakeMapbox() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/search/geocode/v6/forward", exchange -> {
            requests.add(query(exchange.getRequestURI().getRawQuery()));
            try {
                Thread.sleep(delay.toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            try {
                exchange.sendResponseHeaders(status, bytes.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(bytes);
                }
            } catch (IOException e) {
                // The app gave up waiting (a timeout test); nothing to do.
            }
        });
        server.start();
        reset();
    }

    public static synchronized FakeMapbox get() {
        if (instance == null) {
            instance = new FakeMapbox();
        }
        return instance;
    }

    public String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    /** Back to answering with no results, at once. */
    public void reset() {
        requests.clear();
        status = 200;
        body = collection();
        delay = Duration.ZERO;
    }

    public void answer(int status, String body) {
        this.status = status;
        this.body = body;
    }

    public void answerWith(String... features) {
        answer(200, collection(features));
    }

    public void delay(Duration delay) {
        this.delay = delay;
    }

    /** The query parameters of each request so far, decoded. */
    public List<Map<String, String>> requests() {
        return new ArrayList<>(requests);
    }

    /** A Geocoding v6 feature with the fields the app reads. */
    public static String feature(String id, String name, String placeFormatted, String type, double lat, double lng) {
        return """
                {"type":"Feature","id":"%1$s","geometry":{"type":"Point","coordinates":[%6$s,%5$s]},
                 "properties":{"mapbox_id":"%1$s","name":"%2$s","place_formatted":"%3$s",
                   "full_address":"%2$s, %3$s","feature_type":"%4$s",
                   "coordinates":{"latitude":%5$s,"longitude":%6$s}}}
                """.formatted(id, name, placeFormatted, type, lat, lng);
    }

    private static String collection(String... features) {
        return "{\"type\":\"FeatureCollection\",\"features\":[" + String.join(",", features) + "]}";
    }

    private static Map<String, String> query(String raw) {
        Map<String, String> values = new LinkedHashMap<>();
        if (raw == null) {
            return values;
        }
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            String key = eq < 0 ? pair : pair.substring(0, eq);
            String value = eq < 0 ? "" : pair.substring(eq + 1);
            values.put(URLDecoder.decode(key, StandardCharsets.UTF_8), URLDecoder.decode(value, StandardCharsets.UTF_8));
        }
        return values;
    }
}
