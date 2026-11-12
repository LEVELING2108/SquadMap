package com.squadmap.common.security;

import com.squadmap.common.error.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Duration;
import java.util.List;

/**
 * Deny by default: a route is reachable only if it is listed here.
 * Each feature opens its own routes explicitly when it is added.
 */
@Configuration
@EnableConfigurationProperties(CorsProperties.class)
public class SecurityConfig {

    private static final String[] API_DOCS = {"/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"};

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ProblemResponseWriter problems,
            @Value("${springdoc.api-docs.enabled:true}") boolean apiDocsEnabled) throws Exception {

        AuthenticationEntryPoint unauthenticated = (request, response, ex) -> problems.write(
                response, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Sign in to continue.");
        AccessDeniedHandler forbidden = (request, response, ex) -> problems.write(
                response, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, "You are not allowed to do this.");

        http
                // The API is called with bearer tokens, not session cookies, so there is no session to forge.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers("/actuator/health", "/actuator/health/**").permitAll();
                    if (apiDocsEnabled) {
                        auth.requestMatchers(API_DOCS).permitAll();
                    }
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/auth/signup", "/api/v1/auth/login",
                            "/api/v1/auth/refresh", "/api/v1/auth/logout",
                            "/api/v1/auth/forgot", "/api/v1/auth/reset").permitAll();
                    // Account routes are for signed-in accounts only; a guest token is refused.
                    auth.requestMatchers("/api/v1/me", "/api/v1/me/**").hasAuthority(TokenKind.USER.authority());
                    // Joining works from an invite link, with or without an account.
                    auth.requestMatchers("/api/v1/join/**").permitAll();
                    // A guest's session comes from their cookie, checked by the guest session routes.
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/guest/session", "/api/v1/guest/logout").permitAll();
                    // A guest may read the one trip their pass is for; the service checks which trip.
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/trips/*")
                            .hasAnyAuthority(TokenKind.USER.authority(), TokenKind.GUEST.authority());
                    auth.requestMatchers(HttpMethod.DELETE, "/api/v1/trips/*/members/me")
                            .hasAnyAuthority(TokenKind.USER.authority(), TokenKind.GUEST.authority());
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/trips/*/guest-pass")
                            .hasAuthority(TokenKind.GUEST.authority());
                    // Everything else about trips is for signed-in accounts.
                    auth.requestMatchers("/api/v1/trips", "/api/v1/trips/**").hasAuthority(TokenKind.USER.authority());
                    auth.anyRequest().authenticated();
                })
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(tokenToAuthentication()))
                        .authenticationEntryPoint(unauthenticated)
                        .accessDeniedHandler(forbidden))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(unauthenticated)
                        .accessDeniedHandler(forbidden));
        return http.build();
    }

    /** The token's kind becomes its single authority. The decoder has already rejected unknown kinds. */
    private static Converter<Jwt, AbstractAuthenticationToken> tokenToAuthentication() {
        return token -> {
            TokenKind kind = TokenKind.fromClaim(token.getClaim(TokenKind.CLAIM));
            return new JwtAuthenticationToken(
                    token, List.of(new SimpleGrantedAuthority(kind.authority())), token.getSubject());
        };
    }

    /** Cross-origin requests are refused (403) unless the origin is in the allow-list. */
    @Bean
    CorsConfigurationSource corsConfigurationSource(CorsProperties properties) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(properties.allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key", "X-Request-Id"));
        // The refresh cookie must be sent on cross-origin calls from the web app.
        config.setAllowCredentials(true);
        config.setMaxAge(Duration.ofHours(1));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
