package com.squadmap.chat.repo;

import com.squadmap.chat.domain.ChatMessage;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    /** Newest first. Ids are time-ordered, so "older than this id" pages without repeats. */
    @Query("SELECT m FROM ChatMessage m WHERE m.tripId = :tripId ORDER BY m.id DESC")
    List<ChatMessage> findNewest(@Param("tripId") UUID tripId, Limit limit);

    @Query("SELECT m FROM ChatMessage m WHERE m.tripId = :tripId AND m.id < :before ORDER BY m.id DESC")
    List<ChatMessage> findOlder(@Param("tripId") UUID tripId, @Param("before") UUID before, Limit limit);

    Optional<ChatMessage> findByMemberIdAndClientId(UUID memberId, UUID clientId);

    /** Messages from other people that the member hasn't seen yet. */
    @Query(nativeQuery = true, value = """
            SELECT count(*) FROM chat_messages c
            JOIN trip_members m ON m.id = :memberId
            WHERE c.trip_id = m.trip_id
              AND c.member_id <> m.id
              AND c.id > COALESCE(m.chat_read_upto, '00000000-0000-0000-0000-000000000000'::uuid)
            """)
    long countUnread(@Param("memberId") UUID memberId);

    /**
     * Records that the member has seen everything up to this message of their trip. It only ever moves
     * forward, so a late request from an older screen can't make seen messages unread again.
     */
    @Modifying
    @Query(nativeQuery = true, value = """
            UPDATE trip_members SET chat_read_upto = :messageId
            WHERE id = :memberId
              AND (chat_read_upto IS NULL OR chat_read_upto < :messageId)
              AND EXISTS (SELECT 1 FROM chat_messages c WHERE c.id = :messageId AND c.trip_id = trip_members.trip_id)
            """)
    int markReadUpTo(@Param("memberId") UUID memberId, @Param("messageId") UUID messageId);

    /** Deletes the chat of trips that ended (by the host or out of time) before the cutoff. */
    @Modifying
    @Query(nativeQuery = true, value = """
            DELETE FROM chat_messages c USING trips t
            WHERE c.trip_id = t.id AND COALESCE(t.ended_at, t.expires_at) < :cutoff
            """)
    int deleteForTripsEndedBefore(@Param("cutoff") Instant cutoff);
}
