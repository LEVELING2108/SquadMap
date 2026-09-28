package com.squadmap.controller;

import com.squadmap.dto.*;
import com.squadmap.service.ChatService;
import com.squadmap.service.RoutingEtaService;
import com.squadmap.service.SessionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
public class SessionRestController {

    private final SessionService sessionService;
    private final RoutingEtaService routingEtaService;
    private final ChatService chatService;

    public SessionRestController(SessionService sessionService,
                                 RoutingEtaService routingEtaService,
                                 ChatService chatService) {
        this.sessionService = sessionService;
        this.routingEtaService = routingEtaService;
        this.chatService = chatService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createSession(@Valid @RequestBody CreateSessionRequest request) {
        Map<String, Object> response = sessionService.createSession(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{code}")
    public ResponseEntity<SessionResponse> getSession(@PathVariable String code) {
        SessionResponse response = sessionService.getSessionByCode(code);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{code}/join")
    public ResponseEntity<Map<String, Object>> joinSession(@PathVariable String code,
                                                           @Valid @RequestBody JoinSessionRequest request) {
        Map<String, Object> response = sessionService.joinSession(code, request);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{code}/destination")
    public ResponseEntity<SessionResponse> updateDestination(@PathVariable String code,
                                                             @Valid @RequestBody DestinationUpdateRequest request) {
        SessionResponse response = sessionService.updateDestination(code, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{code}")
    public ResponseEntity<Map<String, String>> endSession(@PathVariable String code) {
        sessionService.endSession(code);
        return ResponseEntity.ok(Map.of("message", "Session ended successfully"));
    }

    @GetMapping("/{code}/eta")
    public ResponseEntity<List<EtaParticipantDto>> getEtas(@PathVariable String code) {
        List<EtaParticipantDto> etas = routingEtaService.calculateEtasForSession(code);
        return ResponseEntity.ok(etas);
    }

    @GetMapping("/{code}/chat")
    public ResponseEntity<List<ChatMessageDto>> getRecentChat(@PathVariable String code) {
        List<ChatMessageDto> messages = chatService.getRecentMessages(code);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/{code}/chat")
    public ResponseEntity<ChatMessageDto> sendChat(@PathVariable String code,
                                                   @RequestBody Map<String, Object> body) {
        String senderId = (String) body.get("senderId");
        String senderName = (String) body.get("senderName");
        String text = (String) body.get("text");
        Boolean isQuickReply = (Boolean) body.getOrDefault("isQuickReply", false);

        ChatMessageDto dto = chatService.sendChatMessage(code, senderId, senderName, text, isQuickReply);
        return ResponseEntity.ok(dto);
    }
}
