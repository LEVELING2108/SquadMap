package com.squadmap.service;

import com.squadmap.dto.WebRtcSignalDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class WebRtcSignalingService {

    private static final Logger log = LoggerFactory.getLogger(WebRtcSignalingService.class);

    private final SimpMessagingTemplate messagingTemplate;

    public WebRtcSignalingService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void processSignal(WebRtcSignalDto signal) {
        if (signal == null || signal.sessionCode() == null) {
            return;
        }

        String code = signal.sessionCode().toUpperCase();
        log.debug("Routing WebRTC signal type '{}' from user '{}' in session '{}'",
                signal.type(), signal.senderId(), code);

        // Fan out signal to all participants listening on the session voice signaling topic
        messagingTemplate.convertAndSend("/topic/session/" + code + "/webrtc", signal);
    }
}
