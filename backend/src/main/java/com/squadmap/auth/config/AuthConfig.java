package com.squadmap.auth.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.squadmap.common.security.TokenKind;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

@Configuration
@EnableConfigurationProperties(AuthProperties.class)
public class AuthConfig {

    private static final Logger log = LoggerFactory.getLogger(AuthConfig.class);
    private static final int MIN_KEY_BYTES = 32;

    /**
     * Argon2id with the OWASP-recommended minimum: 19 MiB of memory, 2 passes, 1 thread.
     * The parameters are stored inside each hash, so they can be raised later without a migration.
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new Argon2PasswordEncoder(16, 32, 1, 19_456, 2);
    }

    @Bean
    SecretKey accessTokenKey(AuthProperties properties, Environment environment) {
        byte[] key = properties.jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (key.length == 0) {
            if (environment.acceptsProfiles(Profiles.of("prod"))) {
                throw new IllegalStateException("JWT_SECRET must be set in production.");
            }
            // Development and tests: sessions simply end when the app restarts.
            log.warn("No signing key configured; using a temporary one. Access tokens stop working on restart.");
            key = new byte[MIN_KEY_BYTES];
            new SecureRandom().nextBytes(key);
        } else if (key.length < MIN_KEY_BYTES) {
            throw new IllegalStateException("JWT_SECRET must be at least " + MIN_KEY_BYTES + " bytes long.");
        }
        return new SecretKeySpec(key, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey accessTokenKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(accessTokenKey));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey accessTokenKey, AuthProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(accessTokenKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        // Signature, expiry and issuer, plus a known kind: a token without one is never accepted.
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(properties.issuer()), knownKind()));
        return decoder;
    }

    private static OAuth2TokenValidator<Jwt> knownKind() {
        OAuth2Error error = new OAuth2Error("invalid_token", "The token kind is missing or unknown.", null);
        return token -> TokenKind.fromClaim(token.getClaim(TokenKind.CLAIM)) == null
                ? OAuth2TokenValidatorResult.failure(error)
                : OAuth2TokenValidatorResult.success();
    }
}
