package com.squadmap.common.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Walks every API route the app has, so a new one can't slip in unguarded: without a token only the public
 * routes answer, and a guest's pass opens only the routes a guest needs, for its own trip.
 */
class RouteAccessIT extends IntegrationTest {

    /** Routes anyone may call, signed in or not. */
    private static final Set<String> PUBLIC = Set.of(
            "POST /api/v1/auth/signup",
            "POST /api/v1/auth/login",
            "POST /api/v1/auth/refresh",
            "POST /api/v1/auth/logout",
            "POST /api/v1/auth/forgot",
            "POST /api/v1/auth/reset",
            "GET /api/v1/join/{code}/preview",
            "POST /api/v1/join/{code}",
            "POST /api/v1/guest/session",
            "POST /api/v1/guest/logout");

    /** Routes a guest's pass may use (the service then checks it is the guest's own trip). */
    private static final Set<String> GUEST = Set.of(
            "GET /api/v1/trips/{tripId}",
            "GET /api/v1/trips/{tripId}/summary",
            "DELETE /api/v1/trips/{tripId}/members/me",
            "GET /api/v1/trips/{tripId}/members",
            "GET /api/v1/trips/{tripId}/eta",
            "POST /api/v1/trips/{tripId}/locations",
            "POST /api/v1/trips/{tripId}/sharing",
            "PUT /api/v1/trips/{tripId}/members/me/travel-mode",
            "PUT /api/v1/trips/{tripId}/members/me/pause",
            "GET /api/v1/trips/{tripId}/messages",
            "POST /api/v1/trips/{tripId}/messages",
            "POST /api/v1/trips/{tripId}/messages/read",
            "POST /api/v1/trips/{tripId}/guest-pass");

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping mappings;

    /** Every "METHOD /path" the app serves under /api. */
    private List<String> routes() {
        List<String> routes = new ArrayList<>();
        for (RequestMappingInfo info : mappings.getHandlerMethods().keySet()) {
            for (String path : info.getPatternValues()) {
                if (!path.startsWith("/api/")) {
                    continue;
                }
                for (RequestMethod method : info.getMethodsCondition().getMethods()) {
                    routes.add(method.name() + " " + path);
                }
            }
        }
        routes.sort(null);
        return routes;
    }

    @TestFactory
    Stream<DynamicTest> everyRouteNeedsATokenUnlessItIsPublic() {
        return routes().stream().filter(route -> !PUBLIC.contains(route)).map(route ->
                DynamicTest.dynamicTest(route, () -> assertThat(call(route, null))
                        .as(route).isEqualTo(HttpStatus.UNAUTHORIZED)));
    }

    @TestFactory
    Stream<DynamicTest> aGuestPassOpensOnlyTheGuestRoutes() {
        String guest = guestPass();
        return routes().stream().filter(route -> !PUBLIC.contains(route) && !GUEST.contains(route)).map(route ->
                DynamicTest.dynamicTest(route, () -> assertThat(call(route, guest))
                        .as(route).isEqualTo(HttpStatus.FORBIDDEN)));
    }

    @TestFactory
    Stream<DynamicTest> aGuestPassCannotReachAnotherTrip() {
        String guest = guestPass();
        return GUEST.stream().sorted().map(route -> DynamicTest.dynamicTest(route, () -> {
            HttpStatus status = call(route, guest);
            // Another trip id: either "no such trip" or the pass doesn't fit; never served.
            assertThat(status).as(route).isIn(HttpStatus.NOT_FOUND, HttpStatus.FORBIDDEN, HttpStatus.BAD_REQUEST);
        }));
    }

    @TestFactory
    Stream<DynamicTest> theListsAboveMatchRealRoutes() {
        List<String> real = routes();
        return Stream.concat(PUBLIC.stream(), GUEST.stream()).sorted().map(route ->
                DynamicTest.dynamicTest(route, () -> assertThat(real).as("still a route").contains(route)));
    }

    // --- helpers

    /** A guest on a fresh trip; routes are then called with other (random) ids. */
    private String guestPass() {
        String host = post("/api/v1/auth/signup", Map.of("name", "Priya", "email",
                "priya-" + UUID.randomUUID() + "@example.com", "password", "correct horse battery",
                "acceptedTerms", true)).getBody().get("accessToken").asText();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(host);
        JsonNode trip = rest.exchange("/api/v1/trips", HttpMethod.POST, new HttpEntity<>(
                Map.of("name", "Dinner", "shareHours", 1, "chatEnabled", true), headers), JsonNode.class).getBody();
        return post("/api/v1/join/" + trip.get("code").asText(),
                Map.of("displayName", "Aman", "shareLocation", false)).getBody().get("accessToken").asText();
    }

    private HttpStatus call(String route, String token) {
        String[] parts = route.split(" ", 2);
        String path = parts[1].replaceAll("\\{[^}]+}", UUID.randomUUID().toString());
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        Object body = "GET".equals(parts[0]) || "DELETE".equals(parts[0]) ? null : Map.of();
        return HttpStatus.valueOf(rest.exchange(path, HttpMethod.valueOf(parts[0]), new HttpEntity<>(body, headers),
                JsonNode.class).getStatusCode().value());
    }
}
