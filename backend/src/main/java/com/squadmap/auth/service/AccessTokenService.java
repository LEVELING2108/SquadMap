package com.squadmap.auth.service;

import com.squadmap.auth.config.AuthProperties;
import com.squadmap.common.security.Caller;
import com.squadmap.common.security.TokenKind;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/** Issues the short-lived access tokens the web app sends as a bearer token. */
@Service
public class AccessTokenService {

    private final JwtEncoder encoder;
    private final AuthProperties properties;
    private final Clock clock;

    public AccessTokenService(JwtEncoder encoder, AuthProperties properties, Clock clock) {
        this.encoder = encoder;
        this.properties = properties;
        this.clock = clock;
    }

    public IssuedToken issueForUser(UUID userId) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(properties.accessTokenTtl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(properties.issuer())
                .subject(userId.toString())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim(TokenKind.CLAIM, TokenKind.USER.claimValue())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String value = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedToken(value, properties.accessTokenTtl().toSeconds());
    }

    /**
     * A guest's pass: it names one trip member on one trip, and stops working when the trip is
     * due to end. It grants nothing outside that trip.
     */
    public IssuedToken issueForGuest(UUID memberId, UUID tripId, Instant tripExpiresAt) {
        Instant now = clock.instant();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(properties.issuer())
                .subject(memberId.toString())
                .issuedAt(now)
                .expiresAt(tripExpiresAt)
                .claim(TokenKind.CLAIM, TokenKind.GUEST.claimValue())
                .claim(Caller.TRIP_CLAIM, tripId.toString())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String value = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedToken(value, Math.max(0, tripExpiresAt.getEpochSecond() - now.getEpochSecond()));
    }

    /**
     * @param value            the signed token
     * @param expiresInSeconds lifetime from the moment it was issued
     */
    public record IssuedToken(String value, long expiresInSeconds) {
    }
}
