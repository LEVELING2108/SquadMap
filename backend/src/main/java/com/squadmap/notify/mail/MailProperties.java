package com.squadmap.notify.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** @param from sender shown on every email, for example {@code SquadMap <no-reply@example.com>} */
@ConfigurationProperties("squadmap.mail")
public record MailProperties(@DefaultValue("SquadMap <no-reply@squadmap.local>") String from) {
}
