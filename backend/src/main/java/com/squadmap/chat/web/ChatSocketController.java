package com.squadmap.chat.web;

import com.squadmap.chat.service.ChatService;
import com.squadmap.common.error.ApiException;
import com.squadmap.location.dto.LiveError;
import com.squadmap.location.web.LivePrincipal;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

/** "Typing" signals over the live connection. Messages themselves are sent over REST, so each gets an answer. */
@Controller
public class ChatSocketController {

    private final ChatService chat;

    public ChatSocketController(ChatService chat) {
        this.chat = chat;
    }

    @MessageMapping("trip.{tripId}.typing")
    public void typing(@DestinationVariable UUID tripId, Principal principal) {
        chat.typing(tripId, ((LivePrincipal) principal).caller());
    }

    @MessageExceptionHandler(ApiException.class)
    @SendToUser(destinations = "/queue/errors", broadcast = false)
    public LiveError refused(ApiException e) {
        return new LiveError(e.getCode(), e.getMessage(), null);
    }
}
