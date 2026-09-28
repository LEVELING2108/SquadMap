package com.squadmap.dto;

public record WebRtcSignalDto(
    String sessionCode,
    String type,        // "join", "offer", "answer", "candidate", "talking-start", "talking-stop", "leave"
    String senderId,
    String senderName,
    String targetId,    // null for room-wide broadcast, or target peer ID
    Object payload      // SDP object, ICE candidate object, or null
) {}
