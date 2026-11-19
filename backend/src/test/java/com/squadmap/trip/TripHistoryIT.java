package com.squadmap.trip;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TripHistoryIT extends IntegrationTest {

    private static final String HISTORY = "/api/v1/me/trips";

    private String priya;
    private String aman;

    @BeforeEach
    void signUp() {
        priya = signUpAs("Priya", "priya@example.com");
        aman = signUpAs("Aman", "aman@example.com");
    }

    private String signUpAs(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email,
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, String token, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }

    private JsonNode createTrip(String token, String name, boolean withDestination) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("shareHours", 2);
        body.put("chatEnabled", true);
        if (withDestination) {
            body.put("destination", Map.of("name", "Phoenix Marketcity", "lat", 18.5622, "lng", 73.9167));
        }
        return send(HttpMethod.POST, "/api/v1/trips", token, body).getBody();
    }

    private void end(String token, JsonNode trip) {
        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/end", token, null);
    }

    private void joinAs(String token, JsonNode trip) {
        send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), token, Map.of("shareLocation", false));
    }

    private String joinAsGuest(String name, JsonNode trip) {
        return send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), null,
                Map.of("displayName", name, "shareLocation", false)).getBody().get("accessToken").asText();
    }

    /** The trips' own names, in order (not the names of their destinations). */
    private static List<String> names(JsonNode items) {
        List<String> names = new ArrayList<>();
        items.forEach(item -> names.add(item.get("name").asText()));
        return names;
    }

    @Test
    void historyListsEveryTripNewestFirstWhateverItsState() {
        JsonNode ended = createTrip(priya, "Ended by me", true);
        end(priya, ended);
        JsonNode ranOut = createTrip(priya, "Ran out", false);
        jdbc.update("UPDATE trips SET starts_at = now() - interval '3 hours', expires_at = now() - interval '1 hour' "
                + "WHERE id = ?::uuid", ranOut.get("id").asText());
        createTrip(priya, "Running", false);
        createTrip(aman, "Aman's own trip", false);

        ResponseEntity<JsonNode> response = get(HISTORY, priya);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode items = response.getBody().get("items");
        assertThat(names(items)).containsExactly("Running", "Ran out", "Ended by me");
        assertThat(items).extracting(item -> item.get("status").asText()).containsExactly("active", "expired", "ended");
        assertThat(items.get(0).get("endedAt").isNull()).isTrue();
        assertThat(items.get(1).get("endedAt").asText()).isNotEmpty();
        assertThat(items.get(2).get("endedAt").asText()).isNotEmpty();
        assertThat(items.get(2).get("destination").get("name").asText()).isEqualTo("Phoenix Marketcity");
        assertThat(items.get(0).get("destination").isNull()).isTrue();
        assertThat(items.get(0).get("role").asText()).isEqualTo("host");
        assertThat(response.getBody().get("nextBefore").isNull()).isTrue();
    }

    @Test
    void historyShowsWhoElseWasOnEachTripIncludingPeopleWhoLeft() {
        JsonNode trip = createTrip(priya, "Saturday out", true);
        joinAs(aman, trip);
        joinAsGuest("Sourav", trip);
        send(HttpMethod.DELETE, "/api/v1/trips/" + trip.get("id").asText() + "/members/me", aman, null);
        createTrip(priya, "Solo", false);

        JsonNode items = get(HISTORY, priya).getBody().get("items");

        JsonNode solo = items.get(0);
        assertThat(solo.get("friendCount").asInt()).isZero();
        assertThat(solo.get("friends")).isEmpty();
        JsonNode saturday = items.get(1);
        assertThat(saturday.get("friendCount").asInt()).isEqualTo(2);
        assertThat(saturday.get("friends").get(0).asText()).isEqualTo("Aman");
        assertThat(saturday.get("friends").get(1).asText()).isEqualTo("Sourav");
    }

    @Test
    void historyIncludesTripsIJoinedAndLeftAsAMember() {
        JsonNode trip = createTrip(priya, "Priya's trip", false);
        joinAs(aman, trip);
        send(HttpMethod.DELETE, "/api/v1/trips/" + trip.get("id").asText() + "/members/me", aman, null);

        JsonNode item = get(HISTORY, aman).getBody().get("items").get(0);

        assertThat(item.get("name").asText()).isEqualTo("Priya's trip");
        assertThat(item.get("role").asText()).isEqualTo("member");
        assertThat(item.get("friends").get(0).asText()).isEqualTo("Priya");
        // The invite code is not part of history: a past member has no use for it.
        assertThat(item.has("code")).isFalse();
    }

    @Test
    void historyPagesThroughOlderTripsWithoutRepeats() {
        for (int i = 1; i <= 5; i++) {
            end(priya, createTrip(priya, "Trip " + i, false));
        }

        JsonNode first = get(HISTORY + "?limit=2", priya).getBody();
        JsonNode second = get(HISTORY + "?limit=2&before=" + first.get("nextBefore").asText(), priya).getBody();
        JsonNode third = get(HISTORY + "?limit=2&before=" + second.get("nextBefore").asText(), priya).getBody();

        assertThat(names(first.get("items"))).containsExactly("Trip 5", "Trip 4");
        assertThat(names(second.get("items"))).containsExactly("Trip 3", "Trip 2");
        assertThat(names(third.get("items"))).containsExactly("Trip 1");
        assertThat(third.get("nextBefore").isNull()).isTrue();
    }

    @Test
    void historyIsEmptyForSomeoneNew() {
        JsonNode body = get(HISTORY, priya).getBody();

        assertThat(body.get("items")).isEmpty();
        assertThat(body.get("nextBefore").isNull()).isTrue();
    }

    @Test
    void historyRejectsABadPageSizeOrCursor() {
        assertThat(get(HISTORY + "?limit=0", priya).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get(HISTORY + "?limit=51", priya).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get(HISTORY + "?before=not-an-id", priya).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void historyNeedsAnAccount() {
        String guest = joinAsGuest("Sourav", createTrip(priya, "Saturday out", false));

        assertThat(get(HISTORY, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(get(HISTORY, guest).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
