package com.squadmap.notify.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param from        sender shown on every email, for example {@code SquadMap <no-reply@example.com>}
 * @param webBaseUrl  where the web app is served; links in emails point here. No trailing slash.
 */
@ConfigurationProperties("squadmap.mail")
public record MailProperties(
        @DefaultValue("SquadMap <no-reply@squadmap.local>") String from,
        @DefaultValue("http://localhost:5480") String webBaseUrl) {
}
