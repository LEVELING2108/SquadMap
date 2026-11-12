package com.squadmap.invite.service;

import com.squadmap.auth.service.AccessTokenService;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.id.UuidV7;
import com.squadmap.common.text.Text;
import com.squadmap.invite.config.InviteProperties;
import com.squadmap.invite.domain.LocationConsent;
import com.squadmap.invite.dto.JoinPreviewResponse;
import com.squadmap.invite.dto.JoinRequest;
import com.squadmap.invite.dto.JoinResponse;
import com.squadmap.invite.repo.LocationConsentRepository;
import com.squadmap.trip.domain.MemberRole;
import com.squadmap.trip.domain.Trip;
import com.squadmap.trip.domain.TripMember;
import com.squadmap.trip.repo.TripMemberRepository;
import com.squadmap.trip.repo.TripRepository;
import com.squadmap.trip.service.TripCodes;
import com.squadmap.user.domain.User;
import com.squadmap.user.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Joining a trip from its invite code, as a guest or with an account. */
@Service
public class JoinService {

    /** Colours for people who join; each keeps white text readable. The host keeps their own. */
    private static final List<String> MEMBER_COLORS =
            List.of("#0F6E56", "#534AB7", "#993C1D", "#854F0B", "#993556");

    private final TripRepository trips;
    private final TripMemberRepository members;
    private final LocationConsentRepository consents;
    private final UserService users;
    private final AccessTokenService accessTokens;
    private final InviteProperties properties;
    private final Clock clock;

    public JoinService(TripRepository trips, TripMemberRepository members, LocationConsentRepository consents,
                       UserService users, AccessTokenService accessTokens, InviteProperties properties, Clock clock) {
        this.trips = trips;
        this.members = members;
        this.consents = consents;
        this.users = users;
        this.accessTokens = accessTokens;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * @throws ApiException 404 {@code INVALID_CODE} when no trip has this code;
     *                      410 {@code TRIP_EXPIRED} when the trip has ended or run out
     */
    @Transactional(readOnly = true)
    public JoinPreviewResponse preview(String typedCode) {
        Trip trip = trips.findByCode(codeOrThrow(typedCode)).orElseThrow(JoinService::invalidCode);
        requireLive(trip);
        String hostName = users.findActiveById(trip.getHostId()).map(User::getName).orElse("Your host");
        return new JoinPreviewResponse(trip.getCode(), trip.getName(), hostName, trip.getDestination(),
                members.countByTripIdAndLeftAtIsNull(trip.getId()), trip.getExpiresAt());
    }

    /**
     * Adds the caller to the trip. A signed-in person who is already on it gets their existing place back,
     * so tapping the link twice is harmless.
     *
     * @param userId the signed-in account, or empty for a guest
     */
    @Transactional
    public JoinResponse join(String typedCode, JoinRequest request, Optional<UUID> userId) {
        Trip trip = trips.lockByCode(codeOrThrow(typedCode)).orElseThrow(JoinService::invalidCode);
        requireLive(trip);
        Instant now = clock.instant();

        if (userId.isPresent()) {
            Optional<TripMember> existing = members.findByTripIdAndUserIdAndLeftAtIsNull(trip.getId(), userId.get());
            if (existing.isPresent()) {
                return response(existing.get(), false, null);
            }
        }

        List<TripMember> current = members.findByTripIdAndLeftAtIsNullOrderByJoinedAt(trip.getId());
        if (current.size() >= properties.maxMembers()) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.TRIP_FULL,
                    "This trip is full: it already has " + properties.maxMembers() + " people.");
        }

        String name = displayName(request, userId);
        TripMember member = members.save(new TripMember(UuidV7.generate(clock), trip.getId(), userId.orElse(null),
                name, nextColor(current), MemberRole.member, now));
        if (request.shareLocation()) {
            consents.save(new LocationConsent(UuidV7.generate(clock), member.getId(),
                    properties.locationPolicyVersion(), now));
        }

        AccessTokenService.IssuedToken pass = userId.isPresent()
                ? null
                : accessTokens.issueForGuest(member.getId(), trip.getId(), trip.getExpiresAt());
        return response(member, request.shareLocation(), pass);
    }

    /**
     * A fresh pass for a guest, valid until the trip's current end time. A guest calls this after the host
     * extends the trip, while their old pass still works, so they stay on the trip for the extra time.
     */
    @Transactional(readOnly = true)
    public JoinResponse renewGuestPass(UUID tripId, UUID memberId) {
        Trip trip = trips.findById(tripId).orElseThrow(JoinService::notOnTrip);
        TripMember member = members.findByIdAndTripIdAndLeftAtIsNull(memberId, tripId)
                .orElseThrow(JoinService::notOnTrip);
        requireLive(trip);
        boolean sharing = consents.existsByTripMemberIdAndWithdrawnAtIsNull(member.getId());
        return response(member, sharing, accessTokens.issueForGuest(member.getId(), tripId, trip.getExpiresAt()));
    }

    private static ApiException notOnTrip() {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TRIP_NOT_FOUND, "This trip doesn't exist.");
    }

    private String displayName(JoinRequest request, Optional<UUID> userId) {
        String typed = Text.clean(request.displayName());
        if (typed != null && !typed.isEmpty()) {
            return typed;
        }
        return userId.flatMap(users::findActiveById).map(User::getName)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED,
                        "Enter your name so friends know who you are.")
                        .with("errors", List.of(Map.of("field", "displayName",
                                "message", "Enter your name so friends know who you are."))));
    }

    /** The first colour nobody on the trip is using; when all are taken, they repeat in order. */
    private static String nextColor(List<TripMember> current) {
        Set<String> used = current.stream().map(TripMember::getColor).collect(Collectors.toSet());
        return MEMBER_COLORS.stream().filter(color -> !used.contains(color)).findFirst()
                .orElse(MEMBER_COLORS.get(current.size() % MEMBER_COLORS.size()));
    }

    private void requireLive(Trip trip) {
        Instant now = clock.instant();
        if (!trip.isLiveAt(now)) {
            Instant endedAt = trip.getEndedAt() != null ? trip.getEndedAt() : trip.getExpiresAt();
            throw new ApiException(HttpStatus.GONE, ErrorCode.TRIP_EXPIRED,
                    "This trip has ended, so its link no longer works.").with("endedAt", endedAt.toString());
        }
    }

    private static String codeOrThrow(String typedCode) {
        String code = TripCodes.normalize(typedCode);
        if (code == null) {
            throw invalidCode();
        }
        return code;
    }

    private static ApiException invalidCode() {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorCode.INVALID_CODE,
                "That code doesn't match a trip. Check it and try again.");
    }

    private static JoinResponse response(TripMember member, boolean sharing, AccessTokenService.IssuedToken pass) {
        return new JoinResponse(member.getTripId(), member.getId(), member.getDisplayName(), member.getColor(),
                member.getRole(), sharing, pass == null ? null : pass.value(),
                pass == null ? null : pass.expiresInSeconds());
    }
}
