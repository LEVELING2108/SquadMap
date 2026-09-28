package com.squadmap.service;

import com.squadmap.dto.ChatMessageDto;
import com.squadmap.model.ChatMessage;
import com.squadmap.model.Session;
import com.squadmap.repository.ChatMessageRepository;
import com.squadmap.repository.SessionRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final SessionRepository sessionRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatService(ChatMessageRepository chatMessageRepository,
                       SessionRepository sessionRepository,
                       SimpMessagingTemplate messagingTemplate) {
        this.chatMessageRepository = chatMessageRepository;
        this.sessionRepository = sessionRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public ChatMessageDto sendChatMessage(String sessionCode, String senderId, String senderName, String text, Boolean isQuickReply) {
        Session session = sessionRepository.findByCodeIgnoreCase(sessionCode)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionCode));

        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();

        ChatMessage chatMessage = new ChatMessage(
                id,
                session.getId(),
                senderId,
                senderName,
                text,
                now,
                Boolean.TRUE.equals(isQuickReply)
        );
        chatMessageRepository.save(chatMessage);

        ChatMessageDto dto = new ChatMessageDto(
                id,
                session.getId(),
                senderId,
                senderName,
                text,
                now,
                Boolean.TRUE.equals(isQuickReply)
        );

        messagingTemplate.convertAndSend("/topic/session/" + sessionCode.toUpperCase() + "/chat", dto);
        return dto;
    }

    @Transactional(readOnly = true)
    public List<ChatMessageDto> getRecentMessages(String sessionCode) {
        Session session = sessionRepository.findByCodeIgnoreCase(sessionCode).orElse(null);
        if (session == null) {
            return Collections.emptyList();
        }

        return chatMessageRepository.findTop50BySessionIdOrderByTimestampAsc(session.getId()).stream()
                .map(m -> new ChatMessageDto(
                        m.getId(),
                        m.getSessionId(),
                        m.getSenderId(),
                        m.getSenderName(),
                        m.getText(),
                        m.getTimestamp(),
                        m.getIsQuickReply()
                )).toList();
    }
}
