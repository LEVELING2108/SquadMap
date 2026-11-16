package com.squadmap.notify;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import com.squadmap.notify.alert.AlertService;
import com.squadmap.trip.service.TripLifecycleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
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

class AlertsIT extends IntegrationTest {

    private static final String ALERTS = "/api/v1/me/alerts";

    @Autowired
    private TripLifecycleService lifecycle;

    @Autowired
    private AlertService alertService;

    private String priya;
    private String aman;
    private String rohan;

    @BeforeEach
    void signUp() {
        priya = signUpAs("Priya", "priya@example.com");
        aman = signUpAs("Aman", "aman@example.com");
        rohan = signUpAs("Rohan", "rohan@example.com");
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

    private JsonNode createTrip(String token, String name) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("shareHours", 2);
        body.put("chatEnabled", true);
        return send(HttpMethod.POST, "/api/v1/trips", token, body).getBody();
    }

    private void join(String token, JsonNode trip) {
        send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), token, Map.of("shareLocation", false));
    }

    private String joinAsGuest(String name, JsonNode trip) {
        return send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), null,
                Map.of("displayName", name, "shareLocation", false)).getBody().get("accessToken").asText();
    }

    private JsonNode alertsOf(String token) {
        return get(ALERTS, token).getBody();
    }

    private static List<String> kinds(JsonNode page) {
        List<String> kinds = new ArrayList<>();
        page.get("items").forEach(item -> kinds.add(item.get("kind").asText()));
        return kinds;
    }

    /** Sets a trip to end in the given number of minutes from now (negative: already past). */
    private void endsIn(JsonNode trip, int minutes) {
        jdbc.update("UPDATE trips SET starts_at = now() - interval '3 hours', expires_at = now() + make_interval(mins => ?) "
                + "WHERE id = ?::uuid", minutes, trip.get("id").asText());
    }

    // --- who hears what ---

    @Test
    void theHostHearsWhoJoinedWithTheirNameAndColour() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        joinAsGuest("Sourav", trip);

        JsonNode page = alertsOf(priya);

        assertThat(kinds(page)).containsExactly("member_joined", "member_joined");
        JsonNode newest = page.get("items").get(0);
        assertThat(newest.get("actorName").asText()).isEqualTo("Sourav");
        assertThat(newest.get("actorColor").asText()).startsWith("#");
        assertThat(newest.get("tripName").asText()).isEqualTo("Saturday out");
        assertThat(newest.get("tripId").asText()).isEqualTo(trip.get("id").asText());
        assertThat(newest.get("read").asBoolean()).isFalse();
        assertThat(newest.get("tripLive").asBoolean()).isTrue();
        assertThat(page.get("unread").asLong()).isEqualTo(2);
        // Joining is news for the host only.
        assertThat(alertsOf(aman).get("items")).isEmpty();
    }

    @Test
    void joiningTwiceWithAnAccountTellsTheHostOnce() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        join(aman, trip);

        assertThat(kinds(alertsOf(priya))).containsExactly("member_joined");
    }

    @Test
    void theHostHearsWhoLeft() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        send(HttpMethod.DELETE, "/api/v1/trips/" + trip.get("id").asText() + "/members/me", aman, null);

        JsonNode newest = alertsOf(priya).get("items").get(0);

        assertThat(newest.get("kind").asText()).isEqualTo("member_left");
        assertThat(newest.get("actorName").asText()).isEqualTo("Aman");
    }

    @Test
    void whenTheHostEndsATripEveryOtherAccountOnItHears() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        join(rohan, trip);
        String guest = joinAsGuest("Sourav", trip);
        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/end", priya, null);

        assertThat(kinds(alertsOf(aman))).containsExactly("trip_ended");
        assertThat(kinds(alertsOf(rohan))).containsExactly("trip_ended");
        assertThat(alertsOf(aman).get("items").get(0).get("tripLive").asBoolean()).isFalse();
        // The host ended it, so isn't told; the guest has no inbox.
        assertThat(kinds(alertsOf(priya))).doesNotContain("trip_ended");
        assertThat(get(ALERTS, guest).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void whenATripRunsOutEveryAccountOnItHearsOnce() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        endsIn(trip, -1);

        assertThat(lifecycle.expireDueTrips()).isEqualTo(1);
        assertThat(lifecycle.expireDueTrips()).isZero();

        assertThat(kinds(alertsOf(priya))).containsExactly("trip_ended", "member_joined");
        assertThat(kinds(alertsOf(aman))).containsExactly("trip_ended");
    }

    @Test
    void someoneWhoLeftIsNotToldTheTripEnded() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        send(HttpMethod.DELETE, "/api/v1/trips/" + trip.get("id").asText() + "/members/me", aman, null);
        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/end", priya, null);

        assertThat(alertsOf(aman).get("items")).isEmpty();
    }

    // --- sharing ends soon ---

    @Test
    void theHostIsWarnedOnceTenMinutesBeforeTheEndAndAgainAfterAnExtension() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);

        endsIn(trip, 30);
        assertThat(lifecycle.warnEndingSoon()).isZero();

        endsIn(trip, 9);
        assertThat(lifecycle.warnEndingSoon()).isEqualTo(1);
        assertThat(lifecycle.warnEndingSoon()).isZero();
        assertThat(kinds(alertsOf(priya))).containsExactly("ending_soon", "member_joined");
        assertThat(alertsOf(aman).get("items")).isEmpty();

        // Extended by 30 minutes: when the new end comes near, a new warning.
        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/extend", priya, Map.of("minutes", 30));
        assertThat(lifecycle.warnEndingSoon()).isZero();
        endsIn(trip, 5);
        assertThat(lifecycle.warnEndingSoon()).isEqualTo(1);
    }

    @Test
    void anEndedTripIsNotWarnedAbout() {
        JsonNode trip = createTrip(priya, "Saturday out");
        endsIn(trip, 5);
        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/end", priya, null);

        assertThat(lifecycle.warnEndingSoon()).isZero();
    }

    // --- reading ---

    @Test
    void alertsCanBeMarkedReadOneByOneOrAllAtOnce() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        join(rohan, trip);
        String newest = alertsOf(priya).get("items").get(0).get("id").asText();

        assertThat(send(HttpMethod.POST, ALERTS + "/" + newest + "/read", priya, null).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(get(ALERTS + "/unread-count", priya).getBody().get("unread").asLong()).isEqualTo(1);
        assertThat(alertsOf(priya).get("items").get(0).get("read").asBoolean()).isTrue();

        send(HttpMethod.POST, ALERTS + "/read-all", priya, null);
        assertThat(get(ALERTS + "/unread-count", priya).getBody().get("unread").asLong()).isZero();
    }

    @Test
    void nobodyCanReadOrMarkSomeoneElsesAlerts() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        String priyasAlert = alertsOf(priya).get("items").get(0).get("id").asText();

        assertThat(send(HttpMethod.POST, ALERTS + "/" + priyasAlert + "/read", aman, null).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(alertsOf(priya).get("items").get(0).get("read").asBoolean()).isFalse();
        assertThat(get(ALERTS, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void alertsPageNewestFirstWithoutRepeats() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        join(rohan, trip);
        joinAsGuest("Sourav", trip);

        JsonNode first = get(ALERTS + "?limit=2", priya).getBody();
        JsonNode second = get(ALERTS + "?limit=2&before=" + first.get("nextBefore").asText(), priya).getBody();

        assertThat(first.get("items").findValuesAsText("actorName")).containsExactly("Sourav", "Rohan");
        assertThat(second.get("items").findValuesAsText("actorName")).containsExactly("Aman");
        assertThat(second.get("nextBefore").isNull()).isTrue();
    }

    @Test
    void alertsOlderThanThirtyDaysAreDeleted() {
        JsonNode trip = createTrip(priya, "Saturday out");
        join(aman, trip);
        join(rohan, trip);
        jdbc.update("UPDATE alerts SET created_at = now() - interval '31 days' WHERE actor_name = 'Aman'");

        assertThat(alertService.purgeOld()).isEqualTo(1);
        assertThat(alertsOf(priya).get("items").findValuesAsText("actorName")).containsExactly("Rohan");
    }
}
