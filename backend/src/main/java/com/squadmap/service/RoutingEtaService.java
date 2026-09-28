package com.squadmap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.squadmap.dto.EtaParticipantDto;
import com.squadmap.model.Participant;
import com.squadmap.model.Session;
import com.squadmap.repository.ParticipantRepository;
import com.squadmap.repository.SessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.*;

@Service
public class RoutingEtaService {

    private static final Logger log = LoggerFactory.getLogger(RoutingEtaService.class);

    private final SessionRepository sessionRepository;
    private final ParticipantRepository participantRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${squadmap.routing.osrm-url:https://router.project-osrm.org}")
    private String osrmBaseUrl;

    public RoutingEtaService(SessionRepository sessionRepository,
                             ParticipantRepository participantRepository,
                             SimpMessagingTemplate messagingTemplate,
                             RestTemplateBuilder restTemplateBuilder) {
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
        this.messagingTemplate = messagingTemplate;
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofMillis(2500))
                .setReadTimeout(Duration.ofMillis(2500))
                .build();
    }

    public List<EtaParticipantDto> calculateEtasForSession(String code) {
        Session session = sessionRepository.findByCodeIgnoreCase(code).orElse(null);
        if (session == null || session.getDestinationLat() == null || session.getDestinationLng() == null) {
            return Collections.emptyList();
        }

        List<Participant> participants = participantRepository.findBySessionId(session.getId());
        List<EtaParticipantDto> result = new ArrayList<>();

        for (Participant p : participants) {
            if (p.getLat() == null || p.getLng() == null) {
                continue;
            }

            if (Boolean.TRUE.equals(p.getHasArrived())) {
                result.add(new EtaParticipantDto(
                        p.getId(),
                        p.getDisplayName(),
                        p.getColorHex(),
                        0.0,
                        0L,
                        "Arrived 🎉",
                        "0 m",
                        true,
                        p.getSpeed() != null ? p.getSpeed() : 0.0,
                        null
                ));
                continue;
            }

            // Fetch OSRM route or fallback
            RouteResult route = calculateRoute(p.getLat(), p.getLng(), session.getDestinationLat(), session.getDestinationLng(), p.getSpeed());

            String etaFormatted = formatDuration(route.durationSeconds());
            String distanceFormatted = formatDistance(route.distanceMeters());

            result.add(new EtaParticipantDto(
                    p.getId(),
                    p.getDisplayName(),
                    p.getColorHex(),
                    route.distanceMeters(),
                    route.durationSeconds(),
                    etaFormatted,
                    distanceFormatted,
                    false,
                    p.getSpeed() != null ? p.getSpeed() : 0.0,
                    route.geometryJson()
            ));
        }

        result.sort(Comparator.comparing(EtaParticipantDto::durationSeconds));
        return result;
    }

    @Scheduled(fixedRate = 30000)
    public void broadcastPeriodicEtas() {
        List<Session> activeSessions = sessionRepository.findAll().stream()
                .filter(s -> "ACTIVE".equalsIgnoreCase(s.getStatus()) && s.getDestinationLat() != null)
                .toList();

        for (Session session : activeSessions) {
            try {
                List<EtaParticipantDto> etas = calculateEtasForSession(session.getCode());
                if (!etas.isEmpty()) {
                    messagingTemplate.convertAndSend("/topic/session/" + session.getCode().toUpperCase() + "/eta", etas);
                }
            } catch (Exception e) {
                log.debug("Failed periodic ETA broadcast for session: {}", session.getCode());
            }
        }
    }

    private RouteResult calculateRoute(double lat1, double lng1, double lat2, double lng2, Double currentSpeed) {
        String url = String.format(Locale.US, "%s/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=full&geometries=geojson",
                osrmBaseUrl, lng1, lat1, lng2, lat2);

        try {
            String json = restTemplate.getForObject(url, String.class);
            if (json != null) {
                JsonNode root = objectMapper.readTree(json);
                if ("Ok".equalsIgnoreCase(root.path("code").asText())) {
                    JsonNode route = root.path("routes").get(0);
                    double distance = route.path("distance").asDouble();
                    long duration = (long) Math.ceil(route.path("duration").asDouble());
                    String geometry = route.path("geometry").toString();
                    return new RouteResult(distance, duration, geometry);
                }
            }
        } catch (Exception ex) {
            log.debug("OSRM route calculation error, falling back to estimation: {}", ex.getMessage());
        }

        // Fallback: Haversine distance with road winding detour factor 1.35
        double directMeters = LocationService.calculateHaversineDistanceMeters(lat1, lng1, lat2, lng2);
        double roadDistanceMeters = directMeters * 1.35;

        // Estimated speed in km/h (minimum 30 km/h, average 45 km/h, or current user speed if faster)
        double speedKmh = 45.0;
        if (currentSpeed != null && currentSpeed > 30.0) {
            speedKmh = Math.min(currentSpeed, 110.0);
        }
        double speedMetersPerSec = (speedKmh * 1000.0) / 3600.0;
        long estimatedDurationSeconds = (long) Math.ceil(roadDistanceMeters / speedMetersPerSec);

        return new RouteResult(roadDistanceMeters, estimatedDurationSeconds, null);
    }

    private String formatDuration(long seconds) {
        if (seconds <= 30) {
            return "Arriving now";
        }
        long minutes = seconds / 60;
        if (minutes < 60) {
            return minutes + " min" + (minutes == 1 ? "" : "s");
        }
        long hours = minutes / 60;
        long remainingMins = minutes % 60;
        if (remainingMins == 0) {
            return hours + " hr" + (hours == 1 ? "" : "s");
        }
        return hours + "h " + remainingMins + "m";
    }

    private String formatDistance(double meters) {
        if (meters < 1000) {
            return String.format(Locale.US, "%d m", Math.round(meters));
        }
        double km = meters / 1000.0;
        return String.format(Locale.US, "%.1f km", km);
    }

    private record RouteResult(double distanceMeters, long durationSeconds, String geometryJson) {}
}
