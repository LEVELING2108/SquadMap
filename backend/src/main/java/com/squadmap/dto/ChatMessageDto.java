package com.squadmap.dto;

import java.time.Instant;

public record ChatMessageDto(
    String id,
    String sessionId,
    String senderId,
    String senderName,
    String text,
    Instant timestamp,
    Boolean isQuickReply
) {}
