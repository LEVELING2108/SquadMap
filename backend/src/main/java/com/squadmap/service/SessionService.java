package com.squadmap.service;

import com.squadmap.dto.*;
import com.squadmap.model.Participant;
import com.squadmap.model.Session;
import com.squadmap.repository.ParticipantRepository;
import com.squadmap.repository.SessionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class SessionService {

    private final SessionRepository sessionRepository;
    private final ParticipantRepository participantRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${squadmap.session.expiry-hours:12}")
    private int sessionExpiryHours;

    @Value("${squadmap.session.code-length:6}")
    private int codeLength;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars (I, O, 0, 1)
    private static final SecureRandom RANDOM = new SecureRandom();

    public SessionService(SessionRepository sessionRepository,
                          ParticipantRepository participantRepository,
                          SimpMessagingTemplate messagingTemplate) {
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public Map<String, Object> createSession(CreateSessionRequest request) {
        String code = generateUniqueCode();
        String sessionId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(sessionExpiryHours, ChronoUnit.HOURS);

        Session session = new Session(
                sessionId,
                code,
                request.name(),
                request.destinationName(),
                request.destinationLat(),
                request.destinationLng(),
                now,
                expiresAt
        );
        sessionRepository.save(session);

        // Create Host participant
        String hostId = UUID.randomUUID().toString();
        String colorHex = (request.hostColorHex() != null && !request.hostColorHex().isBlank())
                ? request.hostColorHex()
                : generateRandomColor();

        Participant host = new Participant(hostId, sessionId, request.hostDisplayName(), colorHex);
        participantRepository.save(host);

        SessionResponse sessionResponse = toSessionResponse(session, List.of(host));

        Map<String, Object> result = new HashMap<>();
        result.put("session", sessionResponse);
        result.put("hostParticipantId", hostId);
        return result;
    }

    @Transactional(readOnly = true)
    public SessionResponse getSessionByCode(String code) {
        Session session = sessionRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with code: " + code));

        if ("EXPIRED".equalsIgnoreCase(session.getStatus()) || Instant.now().isAfter(session.getExpiresAt())) {
            session.setStatus("EXPIRED");
            throw new IllegalStateException("Session has expired");
        }

        List<Participant> participants = participantRepository.findBySessionId(session.getId());
        return toSessionResponse(session, participants);
    }

    @Transactional
    public Map<String, Object> joinSession(String code, JoinSessionRequest request) {
        Session session = sessionRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with code: " + code));

        if ("EXPIRED".equalsIgnoreCase(session.getStatus()) || Instant.now().isAfter(session.getExpiresAt())) {
            throw new IllegalStateException("Session has expired");
        }

        String participantId = UUID.randomUUID().toString();
        String color = (request.colorHex() != null && !request.colorHex().isBlank())
                ? request.colorHex()
                : generateRandomColor();

        Participant participant = new Participant(participantId, session.getId(), request.displayName(), color);
        participantRepository.save(participant);

        // Notify room via WebSocket presence topic
        PresenceDto presence = new PresenceDto(participantId, participant.getDisplayName(), color, "JOIN", Instant.now());
        messagingTemplate.convertAndSend("/topic/session/" + code.toUpperCase() + "/presence", presence);

        Map<String, Object> result = new HashMap<>();
        result.put("participantId", participantId);
        result.put("displayName", participant.getDisplayName());
        result.put("colorHex", color);
        result.put("session", getSessionByCode(code));
        return result;
    }

    @Transactional
    public SessionResponse updateDestination(String code, DestinationUpdateRequest request) {
        Session session = sessionRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with code: " + code));

        session.setDestinationName(request.destinationName());
        session.setDestinationLat(request.destinationLat());
        session.setDestinationLng(request.destinationLng());
        sessionRepository.save(session);

        // Broadcast destination change
        messagingTemplate.convertAndSend("/topic/session/" + code.toUpperCase() + "/destination", request);

        List<Participant> participants = participantRepository.findBySessionId(session.getId());
        return toSessionResponse(session, participants);
    }

    @Transactional
    public void endSession(String code) {
        Session session = sessionRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with code: " + code));

        session.setStatus("ENDED");
        sessionRepository.save(session);

        SystemEventDto event = new SystemEventDto("SESSION_ENDED", "Trip has ended by host", Instant.now(), null);
        messagingTemplate.convertAndSend("/topic/session/" + code.toUpperCase() + "/system", event);
    }

    @Scheduled(fixedRate = 600000) // Every 10 mins
    @Transactional
    public void checkExpiredSessions() {
        Instant now = Instant.now();
        List<Session> all = sessionRepository.findAll();
        for (Session session : all) {
            if ("ACTIVE".equalsIgnoreCase(session.getStatus()) && now.isAfter(session.getExpiresAt())) {
                session.setStatus("EXPIRED");
                sessionRepository.save(session);
                SystemEventDto event = new SystemEventDto("SESSION_EXPIRED", "Session expired after 12h", now, null);
                messagingTemplate.convertAndSend("/topic/session/" + session.getCode().toUpperCase() + "/system", event);
            }
        }
    }

    private String generateUniqueCode() {
        for (int i = 0; i < 20; i++) {
            StringBuilder sb = new StringBuilder(codeLength);
            for (int j = 0; j < codeLength; j++) {
                sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
            }
            String code = sb.toString();
            if (sessionRepository.findByCodeIgnoreCase(code).isEmpty()) {
                return code;
            }
        }
        return UUID.randomUUID().toString().substring(0, codeLength).toUpperCase();
    }

    private String generateRandomColor() {
        String[] colors = {
                "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
                "#EC4899", "#06B6D4", "#F97316", "#14B8A6", "#6366F1"
        };
        return colors[RANDOM.nextInt(colors.length)];
    }

    public SessionResponse toSessionResponse(Session session, List<Participant> participants) {
        List<ParticipantDto> participantDtos = participants.stream()
                .map(p -> new ParticipantDto(
                        p.getId(),
                        p.getDisplayName(),
                        p.getColorHex(),
                        p.getLat(),
                        p.getLng(),
                        p.getSpeed(),
                        p.getHeading(),
                        p.getIsPaused(),
                        p.getHasArrived(),
                        p.getLastPing(),
                        p.getJoinedAt()
                )).toList();

        return new SessionResponse(
                session.getId(),
                session.getCode(),
                session.getName(),
                session.getDestinationName(),
                session.getDestinationLat(),
                session.getDestinationLng(),
                session.getCreatedAt(),
                session.getExpiresAt(),
                session.getStatus(),
                participantDtos
        );
    }
}
