package com.squadmap.auth.service;

import com.squadmap.notify.mail.EmailSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.util.UUID;

/** Emails about changes to an account, sent after the request has been answered. */
@Component
public class AccountNotices {

    private static final Logger log = LoggerFactory.getLogger(AccountNotices.class);

    private final EmailSender email;

    public AccountNotices(EmailSender email) {
        this.email = email;
    }

    /**
     * Tells the old address that the account moved, so someone who took over a signed-in session can't
     * change the email quietly. The new address is shown only partly.
     */
    @Async
    public void emailChanged(UUID userId, String oldAddress, String name, String newAddress) {
        try {
            String shown = mask(newAddress);
            String text = """
                    Hi %s,

                    The email address for your SquadMap account was just changed to %s.
                    You'll log in with the new address from now on.

                    If this wasn't you, reset your password from the log in screen straight away,
                    using the new address, or reply to this email.

                    SquadMap
                    """.formatted(name, shown);
            String safeName = HtmlUtils.htmlEscape(name);
            String html = """
                    <!doctype html>
                    <html lang="en"><body style="margin:0;padding:24px;background:#FFF6E5;font-family:Arial,sans-serif;color:#12263A">
                    <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:20px;padding:28px">
                    <h1 style="margin:0 0 12px;font-size:22px">Your email address changed</h1>
                    <p style="margin:0 0 12px;font-size:15px;line-height:21px">Hi %s, the email address for your SquadMap account was just changed to <strong>%s</strong>. You'll log in with the new address from now on.</p>
                    <p style="margin:0;font-size:15px;line-height:21px">If this wasn't you, reset your password from the log in screen straight away, using the new address, or reply to this email.</p>
                    </div></body></html>
                    """.formatted(safeName, HtmlUtils.htmlEscape(shown));
            email.send(oldAddress, "Your SquadMap email address changed", text, html);
            log.info("Email change notice sent for user {}", userId);
        } catch (RuntimeException e) {
            log.error("Could not send an email change notice: {}", e.getClass().getName());
        }
    }

    /**
     * Confirms a deletion request and says how to undo it, so a request made from someone else's hands on
     * a signed-in phone doesn't go unnoticed.
     *
     * @param deleteOn the day the data is removed, already in words ("20 December 2026")
     */
    @Async
    public void deletionScheduled(UUID userId, String address, String name, String deleteOn) {
        try {
            String text = """
                    Hi %s,

                    Your SquadMap account is closed, and its data will be deleted for good on %s.
                    You've been signed out everywhere and your location is no longer shared.

                    Changed your mind? Log in before then with your email and password, and the account
                    stays as it was.

                    If this wasn't you, log in straight away, then change your password.

                    SquadMap
                    """.formatted(name, deleteOn);
            String safeName = HtmlUtils.htmlEscape(name);
            String html = """
                    <!doctype html>
                    <html lang="en"><body style="margin:0;padding:24px;background:#FFF6E5;font-family:Arial,sans-serif;color:#12263A">
                    <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:20px;padding:28px">
                    <h1 style="margin:0 0 12px;font-size:22px">Your account is closed</h1>
                    <p style="margin:0 0 12px;font-size:15px;line-height:21px">Hi %s, your SquadMap account is closed, and its data will be deleted for good on <strong>%s</strong>. You've been signed out everywhere and your location is no longer shared.</p>
                    <p style="margin:0 0 12px;font-size:15px;line-height:21px">Changed your mind? Log in before then with your email and password, and the account stays as it was.</p>
                    <p style="margin:0;font-size:15px;line-height:21px">If this wasn't you, log in straight away, then change your password.</p>
                    </div></body></html>
                    """.formatted(safeName, HtmlUtils.htmlEscape(deleteOn));
            email.send(address, "Your SquadMap account is closed", text, html);
            log.info("Deletion notice sent for user {}", userId);
        } catch (RuntimeException e) {
            log.error("Could not send a deletion notice: {}", e.getClass().getName());
        }
    }

    /** "pr***@example.com": enough to recognise, not enough to copy. */
    static String mask(String address) {
        int at = address.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        String local = address.substring(0, at);
        String visible = local.substring(0, Math.min(2, local.length()));
        return visible + "***" + address.substring(at);
    }
}
