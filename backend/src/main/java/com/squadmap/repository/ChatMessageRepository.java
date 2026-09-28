package com.squadmap.repository;

import com.squadmap.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, String> {
    List<ChatMessage> findTop50BySessionIdOrderByTimestampAsc(String sessionId);
}
