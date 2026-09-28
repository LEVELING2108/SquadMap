package com.squadmap.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "chat_messages", indexes = {
    @Index(name = "idx_chat_session", columnList = "sessionId")
})
public class ChatMessage {

    @Id
    private String id;

    @Column(nullable = false)
    private String sessionId;

    @Column(nullable = false)
    private String senderId;

    @Column(nullable = false)
    private String senderName;

    @Column(nullable = false, length = 1000)
    private String text;

    @Column(nullable = false)
    private Instant timestamp;

    private Boolean isQuickReply = false;

    public ChatMessage() {}

    public ChatMessage(String id, String sessionId, String senderId, String senderName, String text, Instant timestamp, Boolean isQuickReply) {
        this.id = id;
        this.sessionId = sessionId;
        this.senderId = senderId;
        this.senderName = senderName;
        this.text = text;
        this.timestamp = timestamp;
        this.isQuickReply = isQuickReply;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public Boolean getIsQuickReply() { return isQuickReply; }
    public void setIsQuickReply(Boolean isQuickReply) { this.isQuickReply = isQuickReply; }
}
