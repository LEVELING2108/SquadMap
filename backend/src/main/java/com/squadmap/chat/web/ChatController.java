package com.squadmap.chat.web;

import com.squadmap.chat.dto.MarkReadRequest;
import com.squadmap.chat.dto.MessagePage;
import com.squadmap.chat.dto.MessageView;
import com.squadmap.chat.dto.SendMessageRequest;
import com.squadmap.chat.service.ChatService;
import com.squadmap.common.security.Caller;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Trip chat. Open to everyone on the trip, guests included; 403 CHAT_OFF when the host turned chat off. */
@RestController
@RequestMapping("/api/v1/trips/{tripId}/messages")
@Tag(name = "Chat")
public class ChatController {

    private final ChatService chat;

    public ChatController(ChatService chat) {
        this.chat = chat;
    }

    @GetMapping
    @Operation(summary = "The trip's chat",
            description = "Newest first, with how many messages from others I haven't seen. Pass the previous "
                    + "page's nextBefore as `before` for older ones. Still readable after the trip ends; deleted 7 "
                    + "days later. New messages arrive live on /topic/trip.{id}.chat.")
    public MessagePage list(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId,
                            @RequestParam(required = false) UUID before,
                            @RequestParam(defaultValue = "50")
                            @Min(value = 1, message = "Ask for at least 1.")
                            @Max(value = 50, message = "Ask for 50 or fewer.") int limit) {
        return chat.page(tripId, Caller.from(token), before, limit);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Send a message to the trip",
            description = "Plain text, up to 280 characters. Send a clientId so a retried request returns the "
                    + "same message instead of posting it twice. 410 TRIP_EXPIRED once the trip has ended, 429 "
                    + "RATE_LIMITED above 20 messages a minute.")
    public MessageView send(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId,
                            @Valid @RequestBody SendMessageRequest request) {
        return chat.send(tripId, Caller.from(token), request);
    }

    @PostMapping("/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Mark the chat read up to a message",
            description = "Everything up to and including lastSeenId stops counting as unread for me.")
    public void markRead(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId,
                         @Valid @RequestBody MarkReadRequest request) {
        chat.markRead(tripId, Caller.from(token), request.lastSeenId());
    }
}
