package com.squadmap.trip.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.id.UuidV7;
import com.squadmap.common.security.Caller;
import com.squadmap.common.text.Text;
import com.squadmap.common.web.WebProperties;
import com.squadmap.trip.domain.Destination;
import com.squadmap.trip.domain.MemberRole;
import com.squadmap.trip.domain.Trip;
import com.squadmap.trip.domain.TripMember;
import com.squadmap.trip.domain.TripStatus;
import com.squadmap.trip.dto.CreateTripRequest;
import com.squadmap.trip.dto.InviteResponse;
import com.squadmap.trip.dto.TripHistoryResponse;
import com.squadmap.trip.dto.TripResponse;
import com.squadmap.trip.repo.TripMemberRepository;
import com.squadmap.trip.repo.TripRepository;
import com.squadmap.user.domain.User;
import com.squadmap.user.service.UserService;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TripService {

    /** Share durations offered when creating a trip. Extending (later) can go up to 12 hours. */
    public static final Set<Integer> SHARE_HOURS = Set.of(1, 2, 4, 8);
    /** A host can run a few trips at once (say, two groups heading out); more is likely abuse. */
    static final int MAX_LIVE_HOSTED_TRIPS = 3;
    private static final int CODE_ATTEMPTS = 5;
    static final int RECENT_PLACES = 5;
    static final int MAX_HISTORY_PAGE = 50;
    private static final int HISTORY_FRIEND_NAMES = 5;
    private static final int RECENT_TRIPS_SCANNED = 50;

    private final TripRepository trips;
    private final TripMemberRepository members;
    private final UserService users;
    private final WebProperties web;
    private final Clock clock;

    public TripService(TripRepository trips, TripMemberRepository members, UserService users, WebProperties web,
                       Clock clock) {
        this.trips = trips;
        this.members = members;
        this.users = users;
        this.web = web;
        this.clock = clock;
    }

    @Transactional
    /**
     * @param destination where the trip is heading, already checked by {@link DestinationResolver}; may be null
     */
    public TripResponse create(UUID hostId, CreateTripRequest request, Destination destination) {
        User host = users.findActiveById(hostId).orElseThrow(TripService::notFound);
        String name = Text.clean(request.name());
        if (name.isEmpty()) {
            throw invalid("Give the trip a name.");
        }
        if (!SHARE_HOURS.contains(request.shareHours())) {
            throw invalid("Choose 1, 2, 4 or 8 hours.");
        }
        Instant now = clock.instant();
        if (trips.countLiveHostedBy(hostId, now) >= MAX_LIVE_HOSTED_TRIPS) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.TOO_MANY_TRIPS,
                    "You already have " + MAX_LIVE_HOSTED_TRIPS + " trips running. End one to start another.");
        }

        Trip trip = new Trip(UuidV7.generate(clock), hostId, name, uniqueCode(), destination,
                request.chatEnabled(), now, now.plus(Duration.ofHours(request.shareHours())));
        trips.save(trip);
        members.save(new TripMember(UuidV7.generate(clock), trip.getId(), hostId, host.getName(), host.getColor(),
                MemberRole.host, now));
        return toResponse(trip, MemberRole.host, 1);
    }

    /** The account's trips that are still running, newest first. */
    @Transactional(readOnly = true)
    public List<TripResponse> liveTripsOf(UUID userId) {
        return trips.findLiveForUser(userId, clock.instant()).stream()
                .map(trip -> toResponse(trip, roleOf(trip, userId), members.countByTripIdAndLeftAtIsNull(trip.getId())))
                .toList();
    }

    /**
     * @throws ApiException 404 {@code TRIP_NOT_FOUND} when the trip does not exist or the account is not
     *                      on it. Both answer the same way, so the API never confirms someone else's trip.
     */
    @Transactional(readOnly = true)
    public TripResponse get(UUID tripId, Caller caller) {
        if (!caller.mayUseTrip(tripId)) {
            throw notFound();
        }
        Trip trip = trips.findById(tripId).orElseThrow(TripService::notFound);
        MemberRole role = caller.isGuest()
                ? members.findByIdAndTripIdAndLeftAtIsNull(caller.subject(), tripId)
                        .map(TripMember::getRole).orElseThrow(TripService::notFound)
                : roleOf(trip, caller.subject());
        return toResponse(trip, role, members.countByTripIdAndLeftAtIsNull(tripId));
    }

    @Transactional(readOnly = true)
    public InviteResponse invite(UUID tripId, UUID userId) {
        Trip trip = trips.findById(tripId).orElseThrow(TripService::notFound);
        roleOf(trip, userId);
        String hostName = users.findActiveById(trip.getHostId()).map(User::getName).orElse("Your host");
        return new InviteResponse(trip.getCode(), inviteUrl(trip), trip.getName(), hostName, trip.getDestination(),
                trip.getExpiresAt());
    }

    private MemberRole roleOf(Trip trip, UUID userId) {
        return members.findByTripIdAndUserIdAndLeftAtIsNull(trip.getId(), userId)
                .map(TripMember::getRole)
                .orElseThrow(TripService::notFound);
    }

    /**
     * The account's last {@value #RECENT_PLACES} different destinations, newest first, from trips it hosted or
     * joined. Nothing extra is stored for this: it reads the trips themselves.
     */
    @Transactional(readOnly = true)
    public List<Destination> recentDestinations(UUID userId) {
        Map<String, Destination> distinct = new LinkedHashMap<>();
        for (Trip trip : trips.findWithDestinationForUser(userId, Limit.of(RECENT_TRIPS_SCANNED))) {
            Destination destination = trip.getDestination();
            // The same place picked twice counts once: same name, within about 100 m.
            String key = destination.name().toLowerCase(Locale.ROOT) + "|"
                    + Math.round(destination.lat() * 1000) + "|" + Math.round(destination.lng() * 1000);
            distinct.putIfAbsent(key, destination);
            if (distinct.size() == RECENT_PLACES) {
                break;
            }
        }
        return List.copyOf(distinct.values());
    }

    /**
     * A page of every trip the account has been on, newest first, with who else was on each.
     *
     * @param before the id of the last trip of the previous page, or null for the first page
     */
    @Transactional(readOnly = true)
    public TripHistoryResponse history(UUID userId, UUID before, int limit) {
        int size = Math.clamp(limit, 1, MAX_HISTORY_PAGE);
        // One extra row tells whether another page exists.
        List<Trip> found = before == null
                ? trips.findAllForUser(userId, Limit.of(size + 1))
                : trips.findAllForUserBefore(userId, before, Limit.of(size + 1));
        List<Trip> page = found.size() > size ? found.subList(0, size) : found;

        Map<UUID, List<TripMember>> membersByTrip = members
                .findByTripIdInOrderByJoinedAt(page.stream().map(Trip::getId).toList()).stream()
                .collect(Collectors.groupingBy(TripMember::getTripId));
        Instant now = clock.instant();
        List<TripHistoryResponse.Item> items = page.stream()
                .map(trip -> historyItem(trip, membersByTrip.getOrDefault(trip.getId(), List.of()), userId, now))
                .toList();
        return new TripHistoryResponse(items, found.size() > size ? page.get(page.size() - 1).getId() : null);
    }

    private static TripHistoryResponse.Item historyItem(Trip trip, List<TripMember> everyone, UUID userId,
                                                        Instant now) {
        List<TripMember> others = everyone.stream().filter(member -> !userId.equals(member.getUserId())).toList();
        TripStatus status = trip.statusAt(now);
        Instant endedAt = status == TripStatus.active ? null
                : trip.getEndedAt() != null ? trip.getEndedAt() : trip.getExpiresAt();
        MemberRole role = trip.getHostId().equals(userId) ? MemberRole.host : MemberRole.member;
        return new TripHistoryResponse.Item(trip.getId(), trip.getName(), trip.getDestination(), trip.getStartsAt(),
                trip.getExpiresAt(), endedAt, status, role, others.size(),
                others.stream().map(TripMember::getDisplayName).limit(HISTORY_FRIEND_NAMES).toList());
    }

    private TripResponse toResponse(Trip trip, MemberRole role, long memberCount) {
        return new TripResponse(trip.getId(), trip.getName(), trip.getCode(), inviteUrl(trip), trip.getDestination(),
                trip.isChatEnabled(), trip.getStartsAt(), trip.getExpiresAt(), trip.statusAt(clock.instant()), role,
                memberCount);
    }

    private String inviteUrl(Trip trip) {
        return web.link("/join/" + trip.getCode());
    }

    /** A clash in 852 billion is rare enough that a few attempts always suffice. */
    private String uniqueCode() {
        for (int attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
            String code = TripCodes.generate();
            if (!trips.existsByCode(code)) {
                return code;
            }
        }
        throw new IllegalStateException("Could not find a free trip code");
    }

    static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TRIP_NOT_FOUND, "This trip doesn't exist.");
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message);
    }
}
