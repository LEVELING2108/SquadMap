package com.squadmap.chat.service;

import com.squadmap.chat.domain.ChatMessage;
import com.squadmap.chat.dto.ChatEvent;
import com.squadmap.chat.dto.MessagePage;
import com.squadmap.chat.dto.MessageView;
import com.squadmap.chat.dto.SendMessageRequest;
import com.squadmap.chat.repo.ChatMessageRepository;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.id.UuidV7;
import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimitedException;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.security.Caller;
import com.squadmap.common.text.Text;
import com.squadmap.location.service.LiveChannel;
import com.squadmap.location.service.TripAccess;
import com.squadmap.trip.domain.Trip;
import com.squadmap.trip.domain.TripMember;
import com.squadmap.trip.repo.TripMemberRepository;
import com.squadmap.trip.repo.TripRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Trip chat. Everyone on the trip may read it, and write while the trip is running, unless the host turned
 * chat off when starting the trip. New messages and "typing" signals go out live on the trip's chat topic.
 * Messages are plain text; the app shows them as text, never as markup.
 */
@Service
public class ChatService {

    static final int MAX_PAGE = 50;
    /** Chat is kept this long after the trip ends, then deleted. */
    static final int KEEP_DAYS_AFTER_TRIP = 7;

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final ChatMessageRepository messages;
    private final TripRepository trips;
    private final TripMemberRepository members;
    private final TripAccess access;
    private final RateLimiter rateLimiter;
    private final LiveChannel channel;
    private final Clock clock;

    public ChatService(ChatMessageRepository messages, TripRepository trips, TripMemberRepository members,
                       TripAccess access, RateLimiter rateLimiter, LiveChannel channel, Clock clock) {
        this.messages = messages;
        this.trips = trips;
        this.members = members;
        this.access = access;
        this.rateLimiter = rateLimiter;
        this.channel = channel;
        this.clock = clock;
    }

    /**
     * A page of the trip's chat, newest first, with how many messages the caller hasn't seen. Readable after
     * the trip ends, until the chat is deleted.
     *
     * @throws ApiException 404 {@code TRIP_NOT_FOUND} off the trip; 403 {@code CHAT_OFF} when chat is off
     */
    @Transactional(readOnly = true)
    public MessagePage page(UUID tripId, Caller caller, UUID before, int limit) {
        TripMember me = access.requireMember(tripId, caller);
        requireChatOn(tripId);
        int size = Math.clamp(limit, 1, MAX_PAGE);
        List<ChatMessage> found = before == null
                ? messages.findNewest(tripId, Limit.of(size + 1))
                : messages.findOlder(tripId, before, Limit.of(size + 1));
        List<ChatMessage> page = found.size() > size ? found.subList(0, size) : found;
        Map<UUID, TripMember> senders = everyoneOn(tripId);
        List<MessageView> items = page.stream().map(message -> view(message, senders)).toList();
        UUID next = found.size() > size ? page.getLast().getId() : null;
        return new MessagePage(items, next, messages.countUnread(me.getId()), me.getId());
    }

    /**
     * Posts a message to everyone on the trip. A repeat with the same {@code clientId} returns the first
     * message and posts nothing.
     *
     * @throws ApiException 410 {@code TRIP_EXPIRED} after the trip ends; 403 {@code CHAT_OFF}; 400
     *                      {@code VALIDATION_FAILED} for an empty message; 429 {@code RATE_LIMITED} above 20 a
     *                      minute
     */
    @Transactional
    public MessageView send(UUID tripId, Caller caller, SendMessageRequest request) {
        TripMember me = access.requireLiveMember(tripId, caller);
        requireChatOn(tripId);
        if (request.clientId() != null) {
            Optional<ChatMessage> sent = messages.findByMemberIdAndClientId(me.getId(), request.clientId());
            if (sent.isPresent()) {
                return view(sent.get(), Map.of(me.getId(), me));
            }
        }
        String text = Text.clean(request.text());
        if (text == null || text.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Write a message.");
        }
        rateLimiter.check(RateLimit.CHAT_PER_MEMBER, me.getId().toString());
        ChatMessage message = messages.save(new ChatMessage(UuidV7.generate(clock), tripId, me.getId(),
                request.clientId(), text, clock.instant()));
        // Your own message is never unread for you.
        messages.markReadUpTo(me.getId(), message.getId());
        MessageView view = view(message, Map.of(me.getId(), me));
        channel.publish(LiveChannel.chatTopic(tripId), ChatEvent.message(view));
        return view;
    }

    /** Marks everything up to and including this message as seen by the caller. */
    @Transactional
    public void markRead(UUID tripId, Caller caller, UUID lastSeenId) {
        TripMember me = access.requireMember(tripId, caller);
        requireChatOn(tripId);
        messages.markReadUpTo(me.getId(), lastSeenId);
    }

    /**
     * Tells the others that the caller is writing. Signals beyond one per 2 seconds are dropped quietly: the
     * dots stay up for a few seconds anyway.
     */
    @Transactional(readOnly = true)
    public void typing(UUID tripId, Caller caller) {
        TripMember me = access.requireLiveMember(tripId, caller);
        requireChatOn(tripId);
        try {
            rateLimiter.check(RateLimit.TYPING_PER_MEMBER, me.getId().toString());
        } catch (RateLimitedException tooSoon) {
            return;
        }
        channel.publish(LiveChannel.chatTopic(tripId), ChatEvent.typing(me.getId(), clock.instant()));
    }

    /** Every night, the chat of trips that ended over {@value #KEEP_DAYS_AFTER_TRIP} days ago is deleted. */
    @Scheduled(cron = "0 47 2 * * *", zone = "UTC")
    @Transactional
    public int purgeOld() {
        int deleted = messages.deleteForTripsEndedBefore(
                clock.instant().minus(Duration.ofDays(KEEP_DAYS_AFTER_TRIP)));
        if (deleted > 0) {
            log.info("Deleted {} chat messages of trips that ended over {} days ago", deleted, KEEP_DAYS_AFTER_TRIP);
        }
        return deleted;
    }

    private void requireChatOn(UUID tripId) {
        Trip trip = trips.findById(tripId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                ErrorCode.TRIP_NOT_FOUND, "This trip doesn't exist."));
        if (!trip.isChatEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.CHAT_OFF, "Chat is off for this trip.");
        }
    }

    /** Everyone who was ever on the trip, so messages from people who left still say who wrote them. */
    private Map<UUID, TripMember> everyoneOn(UUID tripId) {
        return members.findByTripIdInOrderByJoinedAt(List.of(tripId)).stream()
                .collect(Collectors.toMap(TripMember::getId, Function.identity()));
    }

    private static MessageView view(ChatMessage message, Map<UUID, TripMember> senders) {
        TripMember sender = senders.get(message.getMemberId());
        return new MessageView(message.getId(), message.getMemberId(),
                sender == null ? "Someone" : sender.getDisplayName(),
                sender == null ? null : sender.getColor(),
                message.getBody(), message.getCreatedAt(), message.getClientId());
    }
}
