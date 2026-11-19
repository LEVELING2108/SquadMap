package com.squadmap.location.config;

import com.squadmap.common.security.CorsProperties;
import com.squadmap.location.service.LiveChannel;
import com.squadmap.location.web.StompAuthInterceptor;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

/**
 * The live connection: STOMP at {@code /ws} (a plain WebSocket at {@code /ws/websocket}, SockJS for clients
 * that can't use one), app destinations under {@code /app}, trip topics under {@code /topic}.
 * {@link StompAuthInterceptor} checks every frame a client sends.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer, DisposableBean {

    /** Both sides send a heartbeat this often, so a dead connection is noticed within about 20 seconds. */
    private static final long HEARTBEAT_MS = 10_000;

    private final CorsProperties cors;
    private final StompAuthInterceptor auth;
    // Kept out of the application context, so it never becomes the scheduler for @Scheduled jobs.
    private final ThreadPoolTaskScheduler heartbeats = new ThreadPoolTaskScheduler();

    public WebSocketConfig(CorsProperties cors, StompAuthInterceptor auth) {
        this.cors = cors;
        this.auth = auth;
        heartbeats.setPoolSize(1);
        heartbeats.setThreadNamePrefix("ws-heartbeat-");
        heartbeats.initialize();
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Same origin always works; other origins only when listed, as for the REST API.
        String[] origins = cors.allowedOrigins().toArray(String[]::new);
        registry.addEndpoint("/ws").setAllowedOrigins(origins).withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[] {HEARTBEAT_MS, HEARTBEAT_MS})
                .setTaskScheduler(heartbeats);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(auth);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        // A location update is about 150 bytes; nothing a client sends needs more than this.
        registration.setMessageSizeLimit(8 * 1024)
                .setSendBufferSizeLimit(512 * 1024)
                .setSendTimeLimit(10_000);
    }

    /** Every instance listens to the shared live channel and passes its messages to its own clients. */
    @Bean
    RedisMessageListenerContainer liveChannelListener(RedisConnectionFactory redis, LiveChannel channel) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(redis);
        container.addMessageListener(channel, new ChannelTopic(LiveChannel.REDIS_CHANNEL));
        return container;
    }

    @Override
    public void destroy() {
        heartbeats.shutdown();
    }
}
