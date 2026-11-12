package com.squadmap.invite.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.context.annotation.Configuration;

/**
 * @param locationPolicyVersion version of the "how we use your location" text a person agrees to on the
 *                              consent screen; recorded with each consent
 * @param maxMembers            most people on one trip, the host included
 */
@ConfigurationProperties("squadmap.invite")
public record InviteProperties(
        @DefaultValue("2026-11") String locationPolicyVersion,
        @DefaultValue("10") int maxMembers) {

    @Configuration
    @EnableConfigurationProperties(InviteProperties.class)
    static class Config {
    }
}
