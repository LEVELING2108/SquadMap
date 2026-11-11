package com.squadmap.notify.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/** Sends one email with a plain-text body and an HTML alternative. */
@Component
@EnableConfigurationProperties(MailProperties.class)
public class EmailSender {

    private final JavaMailSender mailSender;
    private final MailProperties properties;

    public EmailSender(JavaMailSender mailSender, MailProperties properties) {
        this.mailSender = mailSender;
        this.properties = properties;
    }

    public void send(String to, String subject, String text, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(properties.from());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, html);
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new IllegalStateException("Could not build the email", e);
        }
    }

    public String webBaseUrl() {
        return properties.webBaseUrl();
    }
}
