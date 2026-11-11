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
    private final AuthProperties properties;

    /** Verified when the email is unknown, so both failure paths take the same time. */
    private final String decoyHash;

    public AuthService(UserService users, PasswordEncoder passwordEncoder,
                       AccessTokenService accessTokens, AuthProperties properties) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.accessTokens = accessTokens;
        this.properties = properties;
        this.decoyHash = passwordEncoder.encode("decoy-password-never-matches");
    }

    public AuthResponse signup(SignupRequest request) {
        String name = Text.clean(request.name());
        if (name.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Enter your name.");
        }
        String email = Text.normalizeEmail(request.email());
        String hash = passwordEncoder.encode(request.password());

        User user = users.create(name, email, hash, properties.termsVersion());
        return respond(user);
    }

    public AuthResponse login(LoginRequest request) {
        Optional<User> found = users.findActiveByEmail(Text.normalizeEmail(request.email()));

        // Always run one password check. Skipping it for unknown emails would make those
        // requests answer faster and reveal which emails have an account.
        String hash = found.map(User::getPasswordHash).orElse(decoyHash);
        boolean passwordMatches = passwordEncoder.matches(request.password(), hash);

        if (found.isEmpty() || !passwordMatches) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS,
                    "Email or password is incorrect.");
        }
        return respond(found.get());
    }

    private AuthResponse respond(User user) {
        AccessTokenService.IssuedToken token = accessTokens.issueForUser(user.getId());
        return new AuthResponse(token.value(), token.expiresInSeconds(), UserResponse.from(user));
    }
}
