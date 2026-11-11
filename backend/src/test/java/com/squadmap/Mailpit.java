package com.squadmap;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Reads the emails the app sent, through Mailpit's API. */
public class Mailpit {

    public static final String API_URL_PROPERTY = "test.mailpit.api-url";

    private final RestClient api;

    public Mailpit(String apiUrl) {
        this.api = RestClient.create(apiUrl);
    }

    public void deleteAll() {
        api.delete().uri("/api/v1/messages").retrieve().toBodilessEntity();
    }

    /** Every email sent to an address, newest first. */
    public List<Email> messagesTo(String address) {
        JsonNode list = api.get().uri("/api/v1/messages").retrieve().body(JsonNode.class);
        List<Email> found = new ArrayList<>();
        for (JsonNode summary : list.path("messages")) {
            boolean match = false;
            for (JsonNode to : summary.path("To")) {
                match |= address.equalsIgnoreCase(to.path("Address").asText());
            }
            if (match) {
                JsonNode full = api.get().uri("/api/v1/message/{id}", summary.path("ID").asText())
                        .retrieve().body(JsonNode.class);
                found.add(new Email(full.path("Subject").asText(), full.path("From").path("Address").asText(),
                        full.path("Text").asText(), full.path("HTML").asText()));
            }
        }
        return found;
    }

    /** Waits for an email that is sent after the request has been answered. */
    public Email awaitOneTo(String address) {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(10));
        while (Instant.now().isBefore(deadline)) {
            List<Email> messages = messagesTo(address);
            if (!messages.isEmpty()) {
                return messages.get(0);
            }
            sleep();
        }
        throw new AssertionError("No email arrived for " + address);
    }

    /** Waits long enough that an email which was going to be sent would have arrived. */
    public List<Email> settledMessagesTo(String address) {
        sleep();
        sleep();
        return messagesTo(address);
    }

    private static void sleep() {
        try {
            Thread.sleep(250);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public record Email(String subject, String from, String text, String html) {

        /** The token after "#token=" in the reset link. */
        public String resetToken() {
            int start = text.indexOf("#token=");
            if (start < 0) {
                throw new AssertionError("No reset link in: " + text);
            }
            int from = start + "#token=".length();
            int end = from;
            while (end < text.length() && !Character.isWhitespace(text.charAt(end))) {
                end++;
            }
            return text.substring(from, end);
        }
    }
}
