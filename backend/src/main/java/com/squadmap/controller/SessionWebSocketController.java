package com.squadmap.controller;

import com.squadmap.dto.ChatMessageDto;
import com.squadmap.dto.LocationUpdateRequest;
import com.squadmap.dto.PresenceDto;
import com.squadmap.dto.WebRtcSignalDto;
import com.squadmap.service.ChatService;
import com.squadmap.service.LocationService;
import com.squadmap.service.WebRtcSignalingService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.util.Map;

@Controller
public class SessionWebSocketController {

    private final LocationService locationService;
    private final ChatService chatService;
    private final WebRtcSignalingService webRtcSignalingService;
    private final SimpMessagingTemplate messagingTemplate;

    public SessionWebSocketController(LocationService locationService,
                                      ChatService chatService,
                                      WebRtcSignalingService webRtcSignalingService,
                                      SimpMessagingTemplate messagingTemplate) {
        this.locationService = locationService;
        this.chatService = chatService;
        this.webRtcSignalingService = webRtcSignalingService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/location.update")
    public void handleLocationUpdate(@Payload LocationUpdateRequest request) {
        locationService.updateLocation(request);
    }

    @MessageMapping("/location.pause")
    public void handleLocationPause(@Payload Map<String, Object> payload) {
        String sessionCode = (String) payload.get("sessionCode");
        String userId = (String) payload.get("userId");
        Boolean isPaused = (Boolean) payload.getOrDefault("isPaused", true);

        LocationUpdateRequest request = new LocationUpdateRequest(
                sessionCode,
                userId,
                null,
                null,
                null,
                null,
                isPaused
        );
        locationService.updateLocation(request);
    }

    @MessageMapping("/chat.send")
    public void handleChatSend(@Payload Map<String, Object> payload) {
        String sessionCode = (String) payload.get("sessionCode");
        String senderId = (String) payload.get("senderId");
        String senderName = (String) payload.get("senderName");
        String text = (String) payload.get("text");
        Boolean isQuickReply = (Boolean) payload.getOrDefault("isQuickReply", false);

        if (sessionCode != null && text != null) {
            chatService.sendChatMessage(sessionCode, senderId, senderName, text, isQuickReply);
        }
    }

    @MessageMapping("/session.join")
    public void handleSessionJoinPresence(@Payload Map<String, Object> payload) {
        String sessionCode = (String) payload.get("sessionCode");
        String userId = (String) payload.get("userId");
        String displayName = (String) payload.get("displayName");
        String colorHex = (String) payload.get("colorHex");

        if (sessionCode != null) {
            PresenceDto presence = new PresenceDto(userId, displayName, colorHex, "JOIN", Instant.now());
            messagingTemplate.convertAndSend("/topic/session/" + sessionCode.toUpperCase() + "/presence", presence);
        }
    }

    @MessageMapping("/webrtc.signal")
    public void handleWebRtcSignal(@Payload WebRtcSignalDto signal) {
        webRtcSignalingService.processSignal(signal);
    }
}
