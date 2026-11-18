package com.squadmap.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import com.squadmap.chat.service.ChatService;
import com.squadmap.location.LiveClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Trip chat end to end: sending, reading, unread counts, typing, the live topic, and who may do what. */
class ChatIT extends IntegrationTest {

    private static final long WAIT_MS = 3_000;

    @LocalServerPort
    private int port;

    @Autowired
    private ChatService chat;

    private final List<LiveClient> clients = new ArrayList<>();
    private String host;
    private String hostMemberId;
    private String tripId;
    private String code;
    private String guest;
    private String guestMemberId;

    @BeforeEach
    void startATripWithAGuest() {
        host = signUp("Priya", "priya@example.com");
        JsonNode trip = createTrip(host, true);
        tripId = trip.get("id").asText();
        code = trip.get("code").asText();
        JsonNode joined = send(HttpMethod.POST, "/api/v1/join/" + code, null,
                Map.of("displayName", "Aman", "shareLocation", true)).getBody();
        guest = joined.get("accessToken").asText();
        guestMemberId = joined.get("memberId").asText();
        hostMemberId = jdbc.queryForObject("SELECT id::text FROM trip_members WHERE trip_id = ?::uuid AND role = 'host'",
                String.class, tripId);
    }

    @AfterEach
    void closeClients() {
        clients.forEach(LiveClient::close);
    }

    // --- sending and reading ---

    @Test
    void aMessageIsSavedAndReachesEveryoneLive() throws Exception {
        LiveClient aman = live(guest);
        aman.subscribe(chatTopic());
        Thread.sleep(200);

        ResponseEntity<JsonNode> sent = message(host, "Save me a seat please", null);

        assertThat(sent.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(sent.getBody().get("text").asText()).isEqualTo("Save me a seat please");
        assertThat(sent.getBody().get("memberId").asText()).isEqualTo(hostMemberId);
        assertThat(sent.getBody().get("displayName").asText()).isEqualTo("Priya");
        assertThat(sent.getBody().get("color").asText()).startsWith("#");
        JsonNode live = aman.next(chatTopic(), WAIT_MS);
        assertThat(live.get("type").asText()).isEqualTo("MESSAGE");
        assertThat(live.get("message").get("id").asText()).isEqualTo(sent.getBody().get("id").asText());
        assertThat(live.get("message").get("text").asText()).isEqualTo("Save me a seat please");
    }

    @Test
    void theChatIsNewestFirstAndPagesBackwards() {
        for (int i = 1; i <= 5; i++) {
            message(i % 2 == 0 ? host : guest, "Message " + i, null);
        }

        JsonNode first = messages(host, "?limit=2");
        assertThat(texts(first)).containsExactly("Message 5", "Message 4");
        JsonNode second = messages(host, "?limit=2&before=" + first.get("nextBefore").asText());
        assertThat(texts(second)).containsExactly("Message 3", "Message 2");
        JsonNode last = messages(host, "?limit=2&before=" + second.get("nextBefore").asText());
        assertThat(texts(last)).containsExactly("Message 1");
        assertThat(last.get("nextBefore").isNull()).isTrue();
    }

    @Test
    void aGuestCanReadAndWrite() {
        assertThat(message(guest, "Stuck at the signal, 10 min", null).getStatusCode()).isEqualTo(HttpStatus.CREATED);

        JsonNode page = messages(guest, "");

        assertThat(texts(page)).containsExactly("Stuck at the signal, 10 min");
        assertThat(page.get("items").get(0).get("displayName").asText()).isEqualTo("Aman");
        assertThat(page.get("memberId").asText()).isEqualTo(guestMemberId);
    }

    @Test
    void sendingAgainWithTheSameClientIdPostsOnce() {
        UUID clientId = UUID.randomUUID();

        ResponseEntity<JsonNode> first = message(guest, "I'm here", clientId);
        ResponseEntity<JsonNode> retry = message(guest, "I'm here", clientId);

        assertThat(retry.getBody().get("id").asText()).isEqualTo(first.getBody().get("id").asText());
        assertThat(retry.getBody().get("clientId").asText()).isEqualTo(clientId.toString());
        assertThat(messages(host, "").get("items")).hasSize(1);
    }

    @Test
    void messagesAreTrimmedPlainText() {
        ResponseEntity<JsonNode> sent = message(guest, "  <b>Running late</b>\n  ", null);

        assertThat(sent.getBody().get("text").asText()).isEqualTo("<b>Running late</b>");
    }

    @Test
    void emptyAndOverlongMessagesAreRefused() {
        assertThat(message(guest, "   ", null).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(message(guest, "\n\t", null).getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(message(guest, "a".repeat(281), null).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(message(guest, "a".repeat(280), null).getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void moreThanTwentyMessagesAMinuteIsRateLimited() {
        for (int i = 0; i < 20; i++) {
            assertThat(message(guest, "Hello " + i, null).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        }

        ResponseEntity<JsonNode> tooMany = message(guest, "One more", null);

        assertThat(tooMany.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(tooMany.getBody().get("code").asText()).isEqualTo("RATE_LIMITED");
        // The limit is per person: the host can still write.
        assertThat(message(host, "Slow down", null).getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    // --- unread ---

    @Test
    void messagesFromOthersAreUnreadUntilSeen() {
        message(guest, "Almost there", null);
        message(guest, "Parking now", null);
        message(host, "Great", null);

        // Your own messages never count, and writing one marks what came before as seen.
        assertThat(messages(host, "").get("unread").asLong()).isZero();
        assertThat(messages(guest, "").get("unread").asLong()).isEqualTo(1);

        String newest = message(host, "See you at the door", null).getBody().get("id").asText();
        assertThat(messages(guest, "").get("unread").asLong()).isEqualTo(2);
        assertThat(markRead(guest, newest).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(messages(guest, "").get("unread").asLong()).isZero();
    }

    @Test
    void readingOnlyMovesForward() {
        String older = message(host, "One", null).getBody().get("id").asText();
        String newer = message(host, "Two", null).getBody().get("id").asText();

        markRead(guest, newer);
        markRead(guest, older);

        assertThat(messages(guest, "").get("unread").asLong()).isZero();
    }

    @Test
    void aMessageFromAnotherTripCannotMarkThisOneRead() {
        String otherHost = signUp("Rohan", "rohan@example.com");
        JsonNode otherTrip = createTrip(otherHost, true);
        send(HttpMethod.POST, "/api/v1/trips/" + otherTrip.get("id").asText() + "/messages", otherHost,
                Map.of("text", "Elsewhere"));
        String elsewhere = jdbc.queryForObject("SELECT id::text FROM chat_messages WHERE body = 'Elsewhere'",
                String.class);
        message(host, "Here", null);

        markRead(guest, elsewhere);

        assertThat(messages(guest, "").get("unread").asLong()).isEqualTo(1);
    }

    // --- typing ---

    @Test
    void typingIsSentToTheTripButNotStored() throws Exception {
        LiveClient priya = live(host);
        priya.subscribe(chatTopic());
        LiveClient aman = live(guest);
        Thread.sleep(200);

        aman.send(typingDestination(), Map.of());

        JsonNode typing = priya.next(chatTopic(), WAIT_MS);
        assertThat(typing.get("type").asText()).isEqualTo("TYPING");
        assertThat(typing.get("memberId").asText()).isEqualTo(guestMemberId);
        assertThat(typing.has("message")).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM chat_messages", Long.class)).isZero();
    }

    @Test
    void typingFasterThanEveryTwoSecondsIsDroppedQuietly() throws Exception {
        LiveClient priya = live(host);
        priya.subscribe(chatTopic());
        LiveClient aman = live(guest);
        aman.subscribe("/user/queue/errors");
        Thread.sleep(200);

        aman.send(typingDestination(), Map.of());
        aman.send(typingDestination(), Map.of());
        aman.send(typingDestination(), Map.of());

        assertThat(priya.next(chatTopic(), WAIT_MS)).isNotNull();
        assertThat(priya.next(chatTopic(), 700)).isNull();
        assertThat(aman.next("/user/queue/errors", 200)).isNull();
        assertThat(aman.connected()).isTrue();
    }

    @Test
    void typingOnATripWithChatOffIsRefusedToTheSender() throws Exception {
        JsonNode quiet = createTrip(host, false);
        LiveClient priya = live(host);
        priya.subscribe("/user/queue/errors");
        Thread.sleep(200);

        priya.send("/app/trip." + quiet.get("id").asText() + ".typing", Map.of());

        assertThat(priya.next("/user/queue/errors", WAIT_MS).get("code").asText()).isEqualTo("CHAT_OFF");
    }

    // --- who may do what ---

    @Test
    void someoneOffTheTripCannotReadWriteOrListen() throws Exception {
        String stranger = signUp("Rohan", "rohan@example.com");

        assertThat(messages(stranger, "", HttpStatus.NOT_FOUND).get("code").asText()).isEqualTo("TRIP_NOT_FOUND");
        assertThat(message(stranger, "Hi", null).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        LiveClient rohan = live(stranger);
        rohan.subscribe(chatTopic());
        assertThat(rohan.nextError(WAIT_MS)).isEqualTo("TRIP_NOT_FOUND");
    }

    @Test
    void whenTheHostTurnedChatOffThereIsNoChat() {
        String quiet = createTrip(host, false).get("id").asText();

        ResponseEntity<JsonNode> read = get("/api/v1/trips/" + quiet + "/messages", host);
        ResponseEntity<JsonNode> write = send(HttpMethod.POST, "/api/v1/trips/" + quiet + "/messages", host,
                Map.of("text", "Hello"));

        assertThat(read.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(read.getBody().get("code").asText()).isEqualTo("CHAT_OFF");
        assertThat(write.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(write.getBody().get("code").asText()).isEqualTo("CHAT_OFF");
    }

    @Test
    void afterTheTripEndsTheChatCanBeReadButNotWritten() {
        message(guest, "Reached", null);
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null);

        ResponseEntity<JsonNode> late = message(guest, "Bye", null);

        assertThat(late.getStatusCode()).isEqualTo(HttpStatus.GONE);
        assertThat(late.getBody().get("code").asText()).isEqualTo("TRIP_EXPIRED");
        assertThat(texts(messages(host, ""))).containsExactly("Reached");
    }

    @Test
    void someoneWhoLeftCannotReadButTheirMessagesStaySigned() {
        message(guest, "Have to go, sorry", null);

        send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", guest, null);

        JsonNode left = messages(host, "").get("items").get(0);
        assertThat(left.get("displayName").asText()).isEqualTo("Aman");
        assertThat(get("/api/v1/trips/" + tripId + "/messages", guest).getStatusCode())
                .isIn(HttpStatus.NOT_FOUND, HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unknownFieldsAreRefused() {
        Map<String, Object> body = new HashMap<>();
        body.put("text", "Hi");
        body.put("memberId", guestMemberId);

        assertThat(send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/messages", host, body).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // --- retention ---

    @Test
    void chatIsDeletedSevenDaysAfterTheTripEnds() {
        message(guest, "Old news", null);
        String other = createTrip(host, true).get("id").asText();
        send(HttpMethod.POST, "/api/v1/trips/" + other + "/messages", host, Map.of("text", "Still fresh"));
        // This trip ended 8 days ago; the other is still running.
        Instant eightDaysAgo = Instant.now().minus(8, ChronoUnit.DAYS);
        jdbc.update("UPDATE trips SET status = 'ended', ended_at = ? WHERE id = ?::uuid",
                Timestamp.from(eightDaysAgo), tripId);

        assertThat(chat.purgeOld()).isEqualTo(1);

        assertThat(jdbc.queryForList("SELECT body FROM chat_messages", String.class)).containsExactly("Still fresh");
    }

    // --- helpers ---

    private String chatTopic() {
        return "/topic/trip." + tripId + ".chat";
    }

    private String typingDestination() {
        return "/app/trip." + tripId + ".typing";
    }

    private LiveClient live(String token) {
        LiveClient client = LiveClient.connect(port, token);
        clients.add(client);
        return client;
    }

    private JsonNode createTrip(String token, boolean chatEnabled) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Saturday at Phoenix");
        body.put("shareHours", 2);
        body.put("chatEnabled", chatEnabled);
        ResponseEntity<JsonNode> created = send(HttpMethod.POST, "/api/v1/trips", token, body);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return created.getBody();
    }

    private ResponseEntity<JsonNode> message(String token, String text, UUID clientId) {
        Map<String, Object> body = new HashMap<>();
        body.put("text", text);
        if (clientId != null) {
            body.put("clientId", clientId);
        }
        return send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/messages", token, body);
    }

    private ResponseEntity<JsonNode> markRead(String token, String lastSeenId) {
        return send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/messages/read", token,
                Map.of("lastSeenId", lastSeenId));
    }

    private JsonNode messages(String token, String query) {
        return messages(token, query, HttpStatus.OK);
    }

    private JsonNode messages(String token, String query, HttpStatus expected) {
        ResponseEntity<JsonNode> response = get("/api/v1/trips/" + tripId + "/messages" + query, token);
        assertThat(response.getStatusCode()).isEqualTo(expected);
        return response.getBody();
    }

    private static List<String> texts(JsonNode page) {
        List<String> texts = new ArrayList<>();
        page.get("items").forEach(item -> texts.add(item.get("text").asText()));
        return texts;
    }

    private String signUp(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email,
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, String token, Object body) {
        HttpHeaders headers = new HttpHeaders();
        if (body != null) {
            headers.setContentType(MediaType.APPLICATION_JSON);
        }
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }
}
