package com.squadmap;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.squadmap.dto.CreateSessionRequest;
import com.squadmap.dto.JoinSessionRequest;
import com.squadmap.dto.LocationUpdateRequest;
import com.squadmap.service.LocationService;
import com.squadmap.service.SessionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SquadMapApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionService sessionService;

    @Autowired
    private LocationService locationService;

    @Test
    void contextLoads() {
    }

    @Test
    void testCreateSessionAndJoin() throws Exception {
        CreateSessionRequest createReq = new CreateSessionRequest(
                "Weekend Roadtrip to Goa",
                "Alex",
                "#3B82F6",
                "Baga Beach, Goa",
                15.5553,
                73.7516
        );

        String createJson = mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.session.code").exists())
                .andExpect(jsonPath("$.hostParticipantId").exists())
                .andReturn().getResponse().getContentAsString();

        Map<?, ?> map = objectMapper.readValue(createJson, Map.class);
        Map<?, ?> sessionMap = (Map<?, ?>) map.get("session");
        String code = (String) sessionMap.get("code");
        String hostId = (String) map.get("hostParticipantId");

        assertThat(code).isNotBlank();

        // Test GET session
        mockMvc.perform(get("/api/sessions/" + code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Weekend Roadtrip to Goa"))
                .andExpect(jsonPath("$.destinationName").value("Baga Beach, Goa"));

        // Test Join session
        JoinSessionRequest joinReq = new JoinSessionRequest("Sarah", "#10B981");
        mockMvc.perform(post("/api/sessions/" + code + "/join")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(joinReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participantId").exists())
                .andExpect(jsonPath("$.displayName").value("Sarah"));

        // Test Location update and arrival threshold
        // Host coordinates right at Baga Beach (< 100m)
        LocationUpdateRequest locReq = new LocationUpdateRequest(
                code,
                hostId,
                15.5553,
                73.7516,
                40.0,
                180.0,
                false
        );
        var broadcast = locationService.updateLocation(locReq);
        assertThat(broadcast).isNotNull();
        assertThat(broadcast.hasArrived()).isTrue();
    }
}
