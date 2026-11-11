package com.squadmap.user.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.id.UuidV7;
import com.squadmap.user.domain.User;
import com.squadmap.user.repo.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class UserService {

    /** Avatar colors from the design system; each keeps white text readable. */
    private static final List<String> AVATAR_COLORS =
            List.of("#0F6E56", "#534AB7", "#993C1D", "#854F0B", "#993556");

    private final UserRepository users;
    private final Clock clock;

    public UserService(UserRepository users, Clock clock) {
        this.users = users;
        this.clock = clock;
    }

    /**
     * Creates an account. The email must already be normalised and the password already hashed.
     *
     * @throws ApiException 409 {@code EMAIL_TAKEN} when the email belongs to an existing account
     */
    @Transactional
    public User create(String name, String email, String passwordHash, String termsVersion) {
        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        String color = AVATAR_COLORS.get(ThreadLocalRandom.current().nextInt(AVATAR_COLORS.size()));
        User user = new User(UuidV7.generate(clock), email, passwordHash, name, color, termsVersion, clock.instant());
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Two sign-ups with the same email raced; the unique index let only one through.
            throw emailTaken();
        }
    }

    /** An account that can still be used: it exists and is not pending deletion. */
    @Transactional(readOnly = true)
    public Optional<User> findActiveByEmail(String email) {
        return users.findByEmail(email).filter(user -> !user.isDeleted());
    }

    @Transactional(readOnly = true)
    public Optional<User> findActiveById(UUID id) {
        return users.findById(id).filter(user -> !user.isDeleted());
    }

    private static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, ErrorCode.EMAIL_TAKEN,
                "This email already has an account. Log in instead.");
    }
}
