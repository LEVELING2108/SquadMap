package com.squadmap.auth.service;

import com.squadmap.auth.config.AuthProperties;
import com.squadmap.auth.dto.AuthResponse;
import com.squadmap.auth.dto.LoginRequest;
import com.squadmap.auth.dto.SignupRequest;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.text.Text;
import com.squadmap.user.domain.User;
import com.squadmap.user.dto.UserResponse;
import com.squadmap.user.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService {

    private final UserService users;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokenService accessTokens;
    private final RefreshTokenService refreshTokens;
    private final AuthProperties properties;

    /** Verified when the email is unknown, so both failure paths take the same time. */
    private final String decoyHash;

    public AuthService(UserService users, PasswordEncoder passwordEncoder, AccessTokenService accessTokens,
                       RefreshTokenService refreshTokens, AuthProperties properties) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.accessTokens = accessTokens;
        this.refreshTokens = refreshTokens;
        this.properties = properties;
        this.decoyHash = passwordEncoder.encode("decoy-password-never-matches");
    }

    public SignedIn signup(SignupRequest request) {
        String name = Text.clean(request.name());
        if (name.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Enter your name.");
        }
        String email = Text.normalizeEmail(request.email());
        String hash = passwordEncoder.encode(request.password());

        User user = users.create(name, email, hash, properties.termsVersion());
        return new SignedIn(respond(user), refreshTokens.startSession(user.getId()));
    }

    public SignedIn login(LoginRequest request) {
        Optional<User> found = users.findActiveByEmail(Text.normalizeEmail(request.email()));

        // Always run one password check. Skipping it for unknown emails would make those
        // requests answer faster and reveal which emails have an account.
        String hash = found.map(User::getPasswordHash).orElse(decoyHash);
        boolean passwordMatches = passwordEncoder.matches(request.password(), hash);

        if (found.isEmpty() || !passwordMatches) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS,
                    "Email or password is incorrect.");
        }
        User user = found.get();
        return new SignedIn(respond(user), refreshTokens.startSession(user.getId()));
    }

    /** Swaps a refresh token for a new access token and the next refresh token. */
    public SignedIn refresh(String refreshToken) {
        RefreshTokenService.Rotation rotation = refreshTokens.rotate(refreshToken);
        if (!rotation.accepted()) {
            throw sessionExpired();
        }
        Optional<User> user = users.findActiveById(rotation.userId());
        if (user.isEmpty()) {
            refreshTokens.endSession(rotation.familyId());
            throw sessionExpired();
        }
        return new SignedIn(respond(user.get()), rotation.nextToken());
    }

    public void logout(String refreshToken) {
        refreshTokens.endSession(refreshToken);
    }

    private AuthResponse respond(User user) {
        AccessTokenService.IssuedToken token = accessTokens.issueForUser(user.getId());
        return new AuthResponse(token.value(), token.expiresInSeconds(), UserResponse.from(user));
    }

    private static ApiException sessionExpired() {
        return new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.SESSION_EXPIRED,
                "Your session has ended. Log in again.");
    }

    /**
     * A successful sign-in: the body for the client, and the refresh token, which travels only
     * in an HttpOnly cookie and never in the body.
     */
    public record SignedIn(AuthResponse response, String refreshToken) {

        @Override
        public String toString() {
            return "SignedIn[refreshToken=***]";
        }
    }
}
