package com.squadmap.common.security;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/**
 * Who is calling, read from a verified access token.
 *
 * @param kind    a signed-in account or a guest
 * @param subject the account id for an account, the trip member id for a guest
 * @param tripId  the one trip a guest may use; {@code null} for an account
 */
public record Caller(TokenKind kind, UUID subject, UUID tripId) {

    /** The claim that ties a guest token to its trip. */
    public static final String TRIP_CLAIM = "trip";

    public static Caller from(Jwt token) {
        TokenKind kind = TokenKind.fromClaim(token.getClaim(TokenKind.CLAIM));
        String trip = token.getClaimAsString(TRIP_CLAIM);
        return new Caller(kind, UUID.fromString(token.getSubject()), trip == null ? null : UUID.fromString(trip));
    }

    public boolean isGuest() {
        return kind == TokenKind.GUEST;
    }

    /** May this caller use the given trip at all? A guest only ever has their own trip. */
    public boolean mayUseTrip(UUID trip) {
        return !isGuest() || trip.equals(tripId);
    }
}
