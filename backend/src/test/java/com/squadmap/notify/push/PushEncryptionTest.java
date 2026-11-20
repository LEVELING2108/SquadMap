package com.squadmap.notify.push;

import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PushEncryptionTest {

    // RFC 8291, Appendix A.
    private static final String PLAINTEXT = "When I grow up, I want to be a watermelon";
    private static final String SERVER_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
    private static final String SERVER_PUBLIC =
            "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    private static final String BROWSER_PRIVATE = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94";
    private static final String BROWSER_PUBLIC =
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
    private static final String SALT = "DGv6ra1nlYgDCS1FRnbzlw";
    private static final String AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
    private static final String MESSAGE = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6"
            + "e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxs"
            + "j_Qulcy4a-fN";

    @Test
    void matchesTheRfcExample() {
        KeyPair server = new KeyPair(EcKeys.publicKey(EcKeys.unbase64(SERVER_PUBLIC)),
                EcKeys.privateKey(EcKeys.unbase64(SERVER_PRIVATE)));

        byte[] message = PushEncryption.encrypt(PLAINTEXT.getBytes(StandardCharsets.UTF_8),
                EcKeys.publicKey(EcKeys.unbase64(BROWSER_PUBLIC)), EcKeys.unbase64(AUTH), server,
                EcKeys.unbase64(SALT));

        assertThat(EcKeys.base64(message)).isEqualTo(MESSAGE);
    }

    @Test
    void theBrowserCanReadAFreshlyEncryptedMessage() throws Exception {
        KeyPair browser = EcKeys.generate();
        byte[] auth = new byte[16];
        Arrays.fill(auth, (byte) 7);

        byte[] message = PushEncryption.encrypt("{\"kind\":\"trip_ended\"}".getBytes(StandardCharsets.UTF_8),
                (ECPublicKey) browser.getPublic(), auth);

        assertThat(new String(decrypt(message, browser, auth), StandardCharsets.UTF_8))
                .isEqualTo("{\"kind\":\"trip_ended\"}");
    }

    @Test
    void refusesAMessageTooLongForOneRecord() {
        KeyPair browser = EcKeys.generate();
        assertThatThrownBy(() -> PushEncryption.encrypt(new byte[PushEncryption.MAX_PLAINTEXT + 1],
                (ECPublicKey) browser.getPublic(), new byte[16]))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void keysSurviveTheRawForm() {
        KeyPair pair = EcKeys.generate();
        ECPublicKey publicKey = (ECPublicKey) pair.getPublic();
        ECPrivateKey privateKey = (ECPrivateKey) pair.getPrivate();

        assertThat(EcKeys.raw(EcKeys.publicKey(EcKeys.raw(publicKey)))).isEqualTo(EcKeys.raw(publicKey));
        assertThat(EcKeys.raw(EcKeys.privateKey(EcKeys.raw(privateKey)))).isEqualTo(EcKeys.raw(privateKey));
        assertThatThrownBy(() -> EcKeys.publicKey(new byte[10])).isInstanceOf(IllegalArgumentException.class);
    }

    /** What the browser does on receipt (RFC 8291 section 3), written separately from the code under test. */
    private static byte[] decrypt(byte[] message, KeyPair browser, byte[] auth) throws Exception {
        ByteBuffer in = ByteBuffer.wrap(message);
        byte[] salt = new byte[16];
        in.get(salt);
        assertThat(in.getInt()).isEqualTo(4096);
        byte[] serverPublic = new byte[in.get()];
        in.get(serverPublic);
        byte[] sealed = new byte[in.remaining()];
        in.get(sealed);

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(browser.getPrivate());
        agreement.doPhase(EcKeys.publicKey(serverPublic), true);
        byte[] shared = agreement.generateSecret();
        byte[] browserPublic = EcKeys.raw((ECPublicKey) browser.getPublic());

        byte[] info = ByteBuffer.allocate(14 + 65 + 65)
                .put("WebPush: info\0".getBytes(StandardCharsets.US_ASCII)).put(browserPublic).put(serverPublic)
                .array();
        byte[] ikm = expand(extract(auth, shared), info, 32);
        byte[] prk = extract(salt, ikm);
        byte[] key = expand(prk, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = expand(prk, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
        byte[] padded = cipher.doFinal(sealed);
        assertThat(padded[padded.length - 1]).isEqualTo((byte) 2);
        return Arrays.copyOf(padded, padded.length - 1);
    }

    private static byte[] extract(byte[] salt, byte[] input) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        return mac.doFinal(input);
    }

    private static byte[] expand(byte[] prk, byte[] info, int length) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }
}
