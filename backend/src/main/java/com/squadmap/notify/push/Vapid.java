package com.squadmap.notify.push;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.time.Instant;

/**
 * This server's identity towards push services (VAPID, RFC 8292): each request carries a short token
 * signed with the private key, and browsers only accept messages signed by the key they subscribed with.
 */
public final class Vapid {

    /** Push services accept tokens valid for up to 24 hours. */
    static final Duration TOKEN_TTL = Duration.ofHours(12);

    private final KeyPair keys;
    private final String publicKey;
    private final String subject;

    Vapid(KeyPair keys, String subject) {
        this.keys = keys;
        this.publicKey = EcKeys.base64(EcKeys.raw((ECPublicKey) keys.getPublic()));
        this.subject = subject;
    }

    /** What the browser subscribes with: the public key, base64url. */
    public String publicKey() {
        return publicKey;
    }

    /** The Authorization header for a request to this push address. */
    String authorization(URI endpoint, Instant now) {
        String audience = endpoint.getScheme() + "://" + endpoint.getRawAuthority();
        String header = part("{\"typ\":\"JWT\",\"alg\":\"ES256\"}");
        String claims = part("{\"aud\":\"" + json(audience) + "\",\"exp\":"
                + now.plus(TOKEN_TTL).getEpochSecond() + ",\"sub\":\"" + json(subject) + "\"}");
        String signed = header + "." + claims;
        try {
            // JWT wants the raw 64-byte r||s form, not DER.
            Signature signature = Signature.getInstance("SHA256withECDSAinP1363Format");
            signature.initSign(keys.getPrivate());
            signature.update(signed.getBytes(StandardCharsets.US_ASCII));
            return "vapid t=" + signed + "." + EcKeys.base64(signature.sign()) + ", k=" + publicKey;
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not sign the push request", e);
        }
    }

    private static String part(String json) {
        return EcKeys.base64(json.getBytes(StandardCharsets.UTF_8));
    }

    /** The audience and subject come from configuration and the URL; quotes and backslashes are escaped anyway. */
    private static String json(String text) {
        return text.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
