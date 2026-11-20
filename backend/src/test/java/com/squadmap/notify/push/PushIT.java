package com.squadmap.notify.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.squadmap.FakePushService;
import com.squadmap.IntegrationTest;
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

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Turning push on and off, and alerts arriving at the devices of the people who want them. */
class PushIT extends IntegrationTest {

    private static final String PUSH = "/api/v1/me/push";
    private static final Duration WAIT = Duration.ofSeconds(5);

    @Autowired
    private TripLifecycleService lifecycle;

    @Autowired
    private ObjectMapper json;

    private final FakePushService pushService = FakePushService.get();

    private String priya;
    private String aman;

    @BeforeEach
    void signUpTwo() {
        pushService.reset();
        priya = signUpAs("Priya", "priya@example.com");
        aman = signUpAs("Aman", "aman@example.com");
    }

    @Test
    void givesTheKeyToSubscribeWith() {
        ResponseEntity<JsonNode> response = get(PUSH + "/key", priya);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        byte[] key = EcKeys.unbase64(response.getBody().get("publicKey").asText());
        assertThat(key).hasSize(65);
        assertThat(key[0]).isEqualTo((byte) 4);
    }

    @Test
    void theKeyIsOnlyForAccounts() {
        assertThat(get(PUSH + "/key", null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void aJoinIsPushedToTheHostEncryptedAndSigned() throws Exception {
        Device phone = new Device("priya-phone");
        assertThat(subscribe(priya, phone).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        JsonNode trip = createTrip(priya, "Saturday at Phoenix");

        join(aman, trip);

        List<FakePushService.Received> got = pushService.await(1, WAIT);
        assertThat(got).hasSize(1);
        FakePushService.Received message = got.get(0);
        assertThat(message.path()).isEqualTo("/push/priya-phone");
        assertThat(message.headers()).containsEntry("content-encoding", "aes128gcm")
                .containsEntry("ttl", "86400")
                .containsEntry("urgency", "normal");
        assertSignedForThisServer(message.headers().get("authorization"), priya);

        JsonNode body = json.readTree(phone.read(message.body()));
        assertThat(body.get("kind").asText()).isEqualTo("member_joined");
        assertThat(body.get("tripId").asText()).isEqualTo(trip.get("id").asText());
        assertThat(body.get("tripName").asText()).isEqualTo("Saturday at Phoenix");
        assertThat(body.get("actorName").asText()).isEqualTo("Aman");
        assertThat(body.get("alertId").asText()).isNotBlank();
        // Never where anyone is.
        assertThat(body.toString()).doesNotContain("lat").doesNotContain("lng");
    }

    @Test
    void sendsToEveryDeviceOfTheAccount() throws Exception {
        subscribe(priya, new Device("priya-phone"));
        subscribe(priya, new Device("priya-laptop"));
        JsonNode trip = createTrip(priya, "Dinner");

        join(aman, trip);

        assertThat(pushService.await(2, WAIT)).extracting(FakePushService.Received::path)
                .containsExactlyInAnyOrder("/push/priya-phone", "/push/priya-laptop");
    }

    @Test
    void leavingIsNotPushedUntilTurnedOn() throws Exception {
        subscribe(priya, new Device("priya-phone"));
        JsonNode trip = createTrip(priya, "Dinner");
        join(aman, trip);
        pushService.await(1, WAIT);
        pushService.reset();

        leave(aman, trip);
        Thread.sleep(500);
        assertThat(pushService.received()).isEmpty();

        assertThat(settings(priya, Map.of("pushLeft", true)).getStatusCode()).isEqualTo(HttpStatus.OK);
        String rohan = signUpAs("Rohan", "rohan@example.com");
        join(rohan, trip);
        leave(rohan, trip);
        assertThat(pushService.await(2, WAIT)).hasSize(2);
    }

    @Test
    void aKindTurnedOffIsNotPushed() throws Exception {
        subscribe(priya, new Device("priya-phone"));
        settings(priya, Map.of("pushJoined", false));
        JsonNode trip = createTrip(priya, "Dinner");

        join(aman, trip);
        Thread.sleep(500);

        assertThat(pushService.received()).isEmpty();
        // Still in the inbox.
        assertThat(get("/api/v1/me/alerts", priya).getBody().get("unread").asLong()).isEqualTo(1);
    }

    @Test
    void settingsShowThePushChoicesWithTheirDefaults() {
        JsonNode settings = get("/api/v1/me/settings", priya).getBody();

        assertThat(settings.get("pushJoined").asBoolean()).isTrue();
        assertThat(settings.get("pushLeft").asBoolean()).isFalse();
        assertThat(settings.get("pushEndingSoon").asBoolean()).isTrue();
        assertThat(settings.get("pushTripEnded").asBoolean()).isTrue();
    }

    @Test
    void theEndingSoonWarningIsUrgentAndShortLived() throws Exception {
        subscribe(priya, new Device("priya-phone"));
        JsonNode trip = createTrip(priya, "Dinner");
        jdbc.update("UPDATE trips SET expires_at = now() + interval '5 minutes' WHERE id = ?::uuid",
                trip.get("id").asText());

        lifecycle.warnEndingSoon();

        FakePushService.Received message = pushService.await(1, WAIT).get(0);
        assertThat(message.headers()).containsEntry("ttl", "600").containsEntry("urgency", "high");
    }

    @Test
    void theEndOfATripReachesEveryAccountOnIt() throws Exception {
        Device amansPhone = new Device("aman-phone");
        subscribe(aman, amansPhone);
        JsonNode trip = createTrip(priya, "Dinner");
        join(aman, trip);

        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/end", priya, Map.of());

        FakePushService.Received message = pushService.await(1, WAIT).get(0);
        assertThat(message.path()).isEqualTo("/push/aman-phone");
        assertThat(json.readTree(amansPhone.read(message.body())).get("kind").asText()).isEqualTo("trip_ended");
    }

    @Test
    void aDeviceThePushServiceNoLongerKnowsIsForgotten() throws Exception {
        subscribe(priya, new Device("old-phone"));
        pushService.answer("old-phone", 410);
        JsonNode trip = createTrip(priya, "Dinner");

        join(aman, trip);
        pushService.await(1, WAIT);

        assertThat(waitForDevices(0)).isZero();
    }

    @Test
    void otherFailuresKeepTheDevice() throws Exception {
        subscribe(priya, new Device("busy-phone"));
        pushService.answer("busy-phone", 500);
        JsonNode trip = createTrip(priya, "Dinner");

        join(aman, trip);
        pushService.await(1, WAIT);
        Thread.sleep(300);

        assertThat(devices()).isEqualTo(1);
    }

    @Test
    void subscribingAgainKeepsOneDevice() {
        Device phone = new Device("priya-phone");
        subscribe(priya, phone);
        subscribe(priya, phone);

        assertThat(devices()).isEqualTo(1);
    }

    @Test
    void aSharedPhoneFollowsWhoeverSignedInLast() throws Exception {
        Device phone = new Device("shared-phone");
        subscribe(priya, phone);
        subscribe(aman, phone);
        JsonNode trip = createTrip(priya, "Dinner");

        join(aman, trip);
        Thread.sleep(500);

        // The join is Priya's alert, and the phone is now Aman's.
        assertThat(pushService.received()).isEmpty();
    }

    @Test
    void keepsTheNewestTenDevices() {
        String userId = jdbc.queryForObject("SELECT id::text FROM users WHERE email = 'priya@example.com'",
                String.class);
        Device template = new Device("template");
        Map<?, ?> keys = (Map<?, ?>) template.subscription().get("keys");
        for (int i = 0; i < PushService.MAX_DEVICES; i++) {
            jdbc.update("""
                    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
                    VALUES (gen_random_uuid(), ?::uuid, ?, ?, ?, now() - make_interval(hours => ?))
                    """, userId, pushService.endpoint("device-" + i), keys.get("p256dh"), keys.get("auth"), 20 - i);
        }

        subscribe(priya, new Device("newest"));

        assertThat(devices()).isEqualTo(PushService.MAX_DEVICES);
        assertThat(jdbc.queryForList("SELECT endpoint FROM push_subscriptions", String.class))
                .noneMatch(endpoint -> endpoint.endsWith("/device-0"))
                .anyMatch(endpoint -> endpoint.endsWith("/newest"));
    }

    @Test
    void unsubscribingStopsIt() throws Exception {
        Device phone = new Device("priya-phone");
        subscribe(priya, phone);

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, PUSH + "/unsubscribe", priya,
                Map.of("endpoint", phone.endpoint));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(devices()).isZero();
    }

    @Test
    void someoneElseCannotUnsubscribeYourDevice() {
        Device phone = new Device("priya-phone");
        subscribe(priya, phone);

        send(HttpMethod.POST, PUSH + "/unsubscribe", aman, Map.of("endpoint", phone.endpoint));

        assertThat(devices()).isEqualTo(1);
    }

    @Test
    void refusesAddressesThatAreNotAPushService() {
        Device phone = new Device("priya-phone");
        Map<String, Object> body = phone.subscription();
        body.put("endpoint", "https://example.com/steal");

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, PUSH + "/subscribe", priya, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(devices()).isZero();
    }

    @Test
    void refusesKeysThatCannotBeUsed() {
        Map<String, Object> body = new Device("priya-phone").subscription();
        body.put("keys", Map.of("p256dh", "AAAA", "auth", "AAAA"));

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, PUSH + "/subscribe", priya, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void refusesMissingKeysAndUnknownFields() {
        assertThat(send(HttpMethod.POST, PUSH + "/subscribe", priya,
                Map.of("endpoint", pushService.endpoint("x"))).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        Map<String, Object> extra = new Device("priya-phone").subscription();
        extra.put("color", "red");
        assertThat(send(HttpMethod.POST, PUSH + "/subscribe", priya, extra).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void guestsCannotSubscribe() {
        JsonNode trip = createTrip(priya, "Dinner");
        String guest = send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), null,
                Map.of("displayName", "Rohan", "shareLocation", false)).getBody().get("accessToken").asText();

        ResponseEntity<JsonNode> response = subscribe(guest, new Device("guest-phone"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void subscribingIsRateLimited() {
        Device phone = new Device("priya-phone");
        for (int i = 0; i < 10; i++) {
            subscribe(priya, phone);
        }

        assertThat(subscribe(priya, phone).getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void deletingTheAccountForgetsItsDevices() {
        subscribe(priya, new Device("priya-phone"));

        jdbc.update("DELETE FROM users WHERE email = 'priya@example.com'");

        assertThat(devices()).isZero();
    }

    // --- helpers

    /** A pretend browser: its own keys, so the test can read what it was sent. */
    private final class Device {
        private final KeyPair keys = EcKeys.generate();
        private final byte[] auth = new byte[16];
        private final String endpoint;

        Device(String name) {
            Arrays.fill(auth, (byte) name.length());
            endpoint = pushService.endpoint(name);
        }

        Map<String, Object> subscription() {
            Map<String, Object> body = new HashMap<>();
            body.put("endpoint", endpoint);
            body.put("expirationTime", null);
            body.put("keys", Map.of("p256dh", EcKeys.base64(EcKeys.raw((ECPublicKey) keys.getPublic())),
                    "auth", EcKeys.base64(auth)));
            return body;
        }

        String read(byte[] message) throws Exception {
            ByteBuffer in = ByteBuffer.wrap(message);
            byte[] salt = new byte[16];
            in.get(salt);
            in.getInt();
            byte[] serverPublic = new byte[in.get()];
            in.get(serverPublic);
            byte[] sealed = new byte[in.remaining()];
            in.get(sealed);
            KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
            agreement.init(keys.getPrivate());
            agreement.doPhase(EcKeys.publicKey(serverPublic), true);
            byte[] info = ByteBuffer.allocate(14 + 65 + 65).put("WebPush: info\0".getBytes(StandardCharsets.US_ASCII))
                    .put(EcKeys.raw((ECPublicKey) keys.getPublic())).put(serverPublic).array();
            byte[] ikm = hkdf(auth, agreement.generateSecret(), info, 32);
            byte[] key = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
            byte[] nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
            byte[] padded = cipher.doFinal(sealed);
            return new String(padded, 0, padded.length - 1, StandardCharsets.UTF_8);
        }
    }

    private static byte[] hkdf(byte[] salt, byte[] input, byte[] info, int length) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(input);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }

    /** The VAPID token is signed by the key the browser subscribed with, for this push service. */
    private void assertSignedForThisServer(String authorization, String token) throws Exception {
        assertThat(authorization).startsWith("vapid t=");
        String jwt = authorization.substring("vapid t=".length(), authorization.indexOf(", k="));
        String k = authorization.substring(authorization.indexOf(", k=") + 4);
        assertThat(k).isEqualTo(get(PUSH + "/key", token).getBody().get("publicKey").asText());

        String[] parts = jwt.split("\\.");
        JsonNode claims = json.readTree(EcKeys.unbase64(parts[1]));
        assertThat(claims.get("aud").asText()).isEqualTo(pushService.endpoint("x").replaceAll("/push/x$", ""));
        assertThat(claims.get("exp").asLong()).isGreaterThan(System.currentTimeMillis() / 1000);
        assertThat(claims.get("sub").asText()).startsWith("mailto:");

        Signature verifier = Signature.getInstance("SHA256withECDSAinP1363Format");
        verifier.initVerify(EcKeys.publicKey(EcKeys.unbase64(k)));
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verifier.verify(EcKeys.unbase64(parts[2]))).isTrue();
    }

    private ResponseEntity<JsonNode> subscribe(String token, Device device) {
        return send(HttpMethod.POST, PUSH + "/subscribe", token, device.subscription());
    }

    private ResponseEntity<JsonNode> settings(String token, Map<String, Object> changes) {
        return send(HttpMethod.PATCH, "/api/v1/me/settings", token, changes);
    }

    private int devices() {
        return jdbc.queryForObject("SELECT count(*) FROM push_subscriptions", Integer.class);
    }

    private int waitForDevices(int expected) throws InterruptedException {
        long until = System.nanoTime() + WAIT.toNanos();
        while (devices() != expected && System.nanoTime() < until) {
            Thread.sleep(25);
        }
        return devices();
    }

    private String signUpAs(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email,
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    private JsonNode createTrip(String token, String name) {
        return send(HttpMethod.POST, "/api/v1/trips", token,
                Map.of("name", name, "shareHours", 2, "chatEnabled", true)).getBody();
    }

    private void join(String token, JsonNode trip) {
        send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), token, Map.of("shareLocation", false));
    }

    private void leave(String token, JsonNode trip) {
        send(HttpMethod.DELETE, "/api/v1/trips/" + trip.get("id").asText() + "/members/me", token, null);
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, String token, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }
}
