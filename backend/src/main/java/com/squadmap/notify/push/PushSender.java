package com.squadmap.notify.push;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;

/**
 * Hands one encrypted message to a browser's push service. Never logs the address (it works like a
 * password for that device) or anything in the message.
 */
@Component
public class PushSender {

    /** What became of a message. */
    public enum Outcome {
        /** The push service took it. */
        SENT,
        /** The subscription is gone (unsubscribed, expired or the keys changed): forget it. */
        GONE,
        /** Something else went wrong; the subscription is kept for next time. */
        FAILED
    }

    /** How urgently the phone should wake for it. */
    public enum Urgency { normal, high }

    private static final Logger log = LoggerFactory.getLogger(PushSender.class);

    private final Vapid vapid;
    private final PushProperties properties;
    private final Clock clock;
    private final HttpClient http;

    public PushSender(Vapid vapid, PushProperties properties, Clock clock) {
        this.vapid = vapid;
        this.properties = properties;
        this.clock = clock;
        this.http = HttpClient.newBuilder()
                .connectTimeout(properties.timeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    /**
     * Whether the server may send to this address: HTTPS, at a known push service. A subscription comes
     * from the browser, so without this anyone could make the server post to an address of their choosing.
     */
    public boolean allowed(String endpoint) {
        URI uri;
        try {
            uri = URI.create(endpoint);
        } catch (IllegalArgumentException e) {
            return false;
        }
        String host = uri.getHost();
        if (host == null || uri.getRawUserInfo() != null) {
            return false;
        }
        boolean secure = "https".equals(uri.getScheme()) || (properties.allowHttp() && "http".equals(uri.getScheme()));
        String lower = host.toLowerCase(Locale.ROOT);
        return secure && properties.allowedHosts().stream()
                .map(allowed -> allowed.toLowerCase(Locale.ROOT))
                .anyMatch(allowed -> lower.equals(allowed) || lower.endsWith("." + allowed));
    }

    /**
     * @param ttl how long the push service should keep it for a phone that is off or offline
     */
    public Outcome send(PushSubscription subscription, byte[] body, Duration ttl, Urgency urgency) {
        if (!allowed(subscription.getEndpoint())) {
            return Outcome.GONE;
        }
        byte[] encrypted;
        URI endpoint = URI.create(subscription.getEndpoint());
        try {
            encrypted = PushEncryption.encrypt(body,
                    EcKeys.publicKey(EcKeys.unbase64(subscription.getP256dh())),
                    EcKeys.unbase64(subscription.getAuth()));
        } catch (IllegalArgumentException e) {
            // Keys that were never usable won't become usable.
            return Outcome.GONE;
        }
        HttpRequest request = HttpRequest.newBuilder(endpoint)
                .timeout(properties.timeout())
                .header("Authorization", vapid.authorization(endpoint, clock.instant()))
                .header("Content-Encoding", "aes128gcm")
                .header("Content-Type", "application/octet-stream")
                .header("TTL", Long.toString(ttl.toSeconds()))
                .header("Urgency", urgency.name())
                .POST(HttpRequest.BodyPublishers.ofByteArray(encrypted))
                .build();
        try {
            int status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status >= 200 && status < 300) {
                return Outcome.SENT;
            }
            if (status == 404 || status == 410) {
                return Outcome.GONE;
            }
            log.warn("Push service at {} answered {}", endpoint.getHost(), status);
            return Outcome.FAILED;
        } catch (IOException e) {
            log.warn("Push to {} failed: {}", endpoint.getHost(), e.getClass().getSimpleName());
            return Outcome.FAILED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Outcome.FAILED;
        }
    }
}
