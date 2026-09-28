package com.squadmap.service;

import com.squadmap.dto.ArrivedEventDto;
import com.squadmap.dto.LocationBroadcastDto;
import com.squadmap.dto.LocationUpdateRequest;
import com.squadmap.model.Participant;
import com.squadmap.model.Session;
import com.squadmap.repository.ParticipantRepository;
import com.squadmap.repository.SessionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
public class LocationService {

    private final SessionRepository sessionRepository;
    private final ParticipantRepository participantRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${squadmap.routing.arrival-threshold-meters:100}")
    private double arrivalThresholdMeters;

    public LocationService(SessionRepository sessionRepository,
                           ParticipantRepository participantRepository,
                           SimpMessagingTemplate messagingTemplate) {
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public LocationBroadcastDto updateLocation(LocationUpdateRequest request) {
        if (request.sessionCode() == null || request.userId() == null) {
            return null;
        }

        String code = request.sessionCode().toUpperCase();
        Optional<Session> sessionOpt = sessionRepository.findByCodeIgnoreCase(code);
        if (sessionOpt.isEmpty()) {
            return null;
        }
        Session session = sessionOpt.get();

        Optional<Participant> participantOpt = participantRepository.findByIdAndSessionId(request.userId(), session.getId());
        if (participantOpt.isEmpty()) {
            return null;
        }
        Participant participant = participantOpt.get();

        if (Boolean.TRUE.equals(request.isPaused())) {
            participant.setIsPaused(true);
            participant.setLastPing(Instant.now());
            participantRepository.save(participant);

            LocationBroadcastDto broadcast = new LocationBroadcastDto(
                    participant.getId(),
                    participant.getLat(),
                    participant.getLng(),
                    0.0,
                    participant.getHeading(),
                    true,
                    participant.getHasArrived(),
                    Instant.now()
            );
            messagingTemplate.convertAndSend("/topic/session/" + code + "/location", broadcast);
            return broadcast;
        }

        participant.setIsPaused(false);
        if (request.lat() != null && request.lng() != null) {
            participant.setLat(request.lat());
            participant.setLng(request.lng());
        }
        if (request.speed() != null) {
            participant.setSpeed(request.speed());
        }
        if (request.heading() != null) {
            participant.setHeading(request.heading());
        }
        participant.setLastPing(Instant.now());

        // Check 100m geofence arrival detection
        if (session.getDestinationLat() != null && session.getDestinationLng() != null
                && participant.getLat() != null && participant.getLng() != null) {
            double distanceMeters = calculateHaversineDistanceMeters(
                    participant.getLat(), participant.getLng(),
                    session.getDestinationLat(), session.getDestinationLng()
            );

            if (distanceMeters <= arrivalThresholdMeters && !Boolean.TRUE.equals(participant.getHasArrived())) {
                participant.setHasArrived(true);

                ArrivedEventDto arrivedEvent = new ArrivedEventDto(
                        participant.getId(),
                        participant.getDisplayName(),
                        Instant.now(),
                        participant.getDisplayName() + " has arrived at the destination! 🎉"
                );
                messagingTemplate.convertAndSend("/topic/session/" + code + "/arrived", arrivedEvent);
            }
        }

        participantRepository.save(participant);

        LocationBroadcastDto broadcast = new LocationBroadcastDto(
                participant.getId(),
                participant.getLat(),
                participant.getLng(),
                participant.getSpeed(),
                participant.getHeading(),
                participant.getIsPaused(),
                participant.getHasArrived(),
                Instant.now()
        );
        messagingTemplate.convertAndSend("/topic/session/" + code + "/location", broadcast);
        return broadcast;
    }

    public static double calculateHaversineDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000; // Earth radius in meters
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
