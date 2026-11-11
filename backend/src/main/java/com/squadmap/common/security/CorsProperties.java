package com.squadmap.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.List;

/**
 * @param allowedOrigins exact origins of the web app (scheme, host and port), never a wildcard.
 *                       Empty means only same-origin requests are accepted.
 */
@ConfigurationProperties("squadmap.cors")
public record CorsProperties(@DefaultValue List<String> allowedOrigins) {
}
