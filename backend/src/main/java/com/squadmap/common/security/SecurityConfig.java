package com.squadmap.common.security;

import com.squadmap.common.error.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Deny by default: only the health probes (and the API docs, where enabled) are public.
 * Each feature opens its own public routes explicitly when it is added.
 */
@Configuration
public class SecurityConfig {

    private static final String[] API_DOCS = {"/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"};

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ProblemResponseWriter problems,
            @Value("${springdoc.api-docs.enabled:true}") boolean apiDocsEnabled) throws Exception {
        http
                // The API is called with bearer tokens, not session cookies, so there is no session to forge.
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers("/actuator/health", "/actuator/health/**").permitAll();
                    if (apiDocsEnabled) {
                        auth.requestMatchers(API_DOCS).permitAll();
                    }
                    auth.anyRequest().authenticated();
                })
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, ex) -> problems.write(
                                response, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED,
                                "Sign in to continue."))
                        .accessDeniedHandler((request, response, ex) -> problems.write(
                                response, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN,
                                "You are not allowed to do this.")));
        return http.build();
    }
}
