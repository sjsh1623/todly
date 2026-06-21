package com.todly.config;

import com.todly.auth.JwtProvider;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

/**
 * STOMP-over-WebSocket configuration (PHASE 5).
 *
 * <p>Two handshake endpoints are exposed: {@code /ws} (SockJS, for browsers) and
 * {@code /ws-native} (raw WebSocket, for non-browser clients and integration
 * tests). The in-memory simple broker serves {@code /topic} and {@code /queue};
 * client-bound messages use the {@code /app} prefix and user-targeted messages
 * the {@code /user} prefix.
 *
 * <p>Authentication happens at STOMP CONNECT: a {@link ChannelInterceptor} reads
 * {@code Authorization: Bearer <token>}, validates it via {@link JwtProvider} and
 * sets the session {@link Principal} to the user id. Connects without a valid
 * token are rejected. The HTTP layer (see {@code SecurityConfig}) permits the
 * handshake itself so this is the sole auth gate for WebSocket traffic.
 */
@org.springframework.context.annotation.Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtProvider jwtProvider;

    public WebSocketConfig(JwtProvider jwtProvider) {
        this.jwtProvider = jwtProvider;
    }

    @Override
    public void registerStompEndpoints(@NonNull StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*").withSockJS();
        registry.addEndpoint("/ws-native").setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(@NonNull MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(@NonNull ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
                StompHeaderAccessor accessor =
                    MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    UUID userId = authenticate(accessor);
                    accessor.setUser(new StompPrincipal(userId));
                }
                return message;
            }
        });
    }

    private UUID authenticate(StompHeaderAccessor accessor) {
        List<String> auth = accessor.getNativeHeader("Authorization");
        if (auth == null || auth.isEmpty()) {
            throw new IllegalArgumentException("Missing Authorization header on CONNECT");
        }
        String header = auth.get(0);
        if (header == null || !header.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Authorization header must be a Bearer token");
        }
        String token = header.substring("Bearer ".length()).trim();
        // Throws ApiException (INVALID_TOKEN) on bad/expired tokens -> CONNECT rejected.
        return jwtProvider.getUserId(token);
    }

    /** Principal whose name is the user id UUID, enabling /user destinations. */
    public record StompPrincipal(UUID userId) implements Principal {
        @Override
        public String getName() {
            return userId.toString();
        }
    }
}
