package com.squadmap;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

/**
 * Base for tests that run the whole application against real Postgres and Redis containers.
 * Every subclass shares one application context, so the containers start once per build.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "squadmap.cors.allowed-origins=" + IntegrationTest.ALLOWED_ORIGIN,
                // Tests call scheduled jobs directly instead of racing the timer.
                "squadmap.scheduling.enabled=false",
                // Makes Spring create the mail sender; the Mailpit container replaces this host.
                "spring.mail.host=placeholder"
        })
@Import(TestcontainersConfig.class)
public abstract class IntegrationTest {

    protected static final String ALLOWED_ORIGIN = "https://app.squadmap.test";

    @Autowired
    protected TestRestTemplate rest;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    private RedisConnectionFactory redis;

    protected Mailpit mailpit;

    @BeforeEach
    void cleanState(@Value("${" + Mailpit.API_URL_PROPERTY + "}") String mailpitUrl) {
        // The HTTP client otherwise waits out a 429's Retry-After and silently retries,
        // which would hide the very responses the tests check.
        rest.getRestTemplate().setRequestFactory(new HttpComponentsClientHttpRequestFactory(
                HttpClients.custom().disableAutomaticRetries().build()));
        jdbc.execute("TRUNCATE TABLE users CASCADE");
        // Every test starts with untouched rate limits.
        try (RedisConnection connection = redis.getConnection()) {
            connection.serverCommands().flushAll();
        }
        mailpit = new Mailpit(mailpitUrl);
        mailpit.deleteAll();
    }

    protected ResponseEntity<JsonNode> post(String path, Map<String, ?> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(path, HttpMethod.POST, new HttpEntity<>(body, headers), JsonNode.class);
    }

    /** A JSON POST that appears to come from the given client address. */
    protected ResponseEntity<JsonNode> postFrom(String clientIp, String path, Map<String, ?> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Forwarded-For", clientIp);
        return rest.exchange(path, HttpMethod.POST, new HttpEntity<>(body, headers), JsonNode.class);
    }

    protected ResponseEntity<JsonNode> get(String path, String bearerToken) {
        HttpHeaders headers = new HttpHeaders();
        if (bearerToken != null) {
            headers.setBearerAuth(bearerToken);
        }
        return rest.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
    }
}
