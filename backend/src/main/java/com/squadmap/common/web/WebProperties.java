package com.squadmap.common.web;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param baseUrl where the web app is served, with no trailing slash. Links the backend hands out
 *                (reset emails, trip invites) point here.
 */
@ConfigurationProperties("squadmap.web")
public record WebProperties(@DefaultValue("http://localhost:5480") String baseUrl) {

    /** An absolute link into the web app, for a path starting with "/". */
    public String link(String path) {
        return baseUrl.replaceAll("/+$", "") + path;
    }
}
