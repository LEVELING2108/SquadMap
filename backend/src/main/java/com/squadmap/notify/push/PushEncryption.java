package com.squadmap.notify.push;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;

/**
 * Encrypts a push message for one browser, as RFC 8291 describes (the "aes128gcm" content coding of
 * RFC 8188). Only that browser can read it: the push service in between sees nothing but its length.
 */
final class PushEncryption {

    /** The whole message goes in one record; push services accept up to 4096 bytes of body. */
    static final int RECORD_SIZE = 4096;
    static final int MAX_PLAINTEXT = 3_000;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final byte LAST_RECORD = 0x02;

    private PushEncryption() {
    }

    /**
     * @param browserKey  the subscription's p256dh key
     * @param authSecret  the subscription's 16-byte auth secret
     */
    static byte[] encrypt(byte[] plaintext, ECPublicKey browserKey, byte[] authSecret) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return encrypt(plaintext, browserKey, authSecret, EcKeys.generate(), salt);
    }

    /** With a given one-off key pair and salt; tests use the RFC's example values. */
    static byte[] encrypt(byte[] plaintext, ECPublicKey browserKey, byte[] authSecret, KeyPair oneOff,
                          byte[] salt) {
        if (plaintext.length > MAX_PLAINTEXT) {
            throw new IllegalArgumentException("Push message too long");
        }
        try {
            byte[] browserPublic = EcKeys.raw(browserKey);
            byte[] serverPublic = EcKeys.raw((ECPublicKey) oneOff.getPublic());

            KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
            agreement.init(oneOff.getPrivate());
            agreement.doPhase(browserKey, true);
            byte[] shared = agreement.generateSecret();

            // RFC 8291 section 3.4: mix in the auth secret and both public keys.
            byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), browserPublic, serverPublic);
            byte[] ikm = hkdf(authSecret, shared, keyInfo, 32);

            // RFC 8188 section 2.2 and 2.3: the content key and nonce.
            byte[] key = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
            byte[] nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
            byte[] sealed = cipher.doFinal(concat(plaintext, new byte[] {LAST_RECORD}));

            ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + serverPublic.length);
            header.put(salt).putInt(RECORD_SIZE).put((byte) serverPublic.length).put(serverPublic);
            return concat(header.array(), sealed);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt the push message", e);
        }
    }

    /** HKDF-SHA256 (RFC 5869), for outputs of at most 32 bytes. */
    private static byte[] hkdf(byte[] salt, byte[] input, byte[] info, int length) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(input);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) {
            out.writeBytes(part);
        }
        return out.toByteArray();
    }
}
