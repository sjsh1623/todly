package com.todly.realtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.todly.config.RedisConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Serializes {@link RealtimeEvent}s to JSON and publishes them to the Redis
 * {@code todly:events} channel. This is the ONLY way domain code emits realtime
 * messages — services never touch {@code SimpMessagingTemplate}. The
 * {@link RealtimeEventSubscriber} (running on every instance) is the single
 * consumer that rebroadcasts to STOMP.
 *
 * <p>The {@link StringRedisTemplate} is resolved lazily via an
 * {@link ObjectProvider} so that contexts which exclude Redis autoconfiguration
 * (the legacy PHASE 0-4 tests) can still wire this bean — in that case publishes
 * become harmless no-ops, keeping non-realtime flows green.
 */
@Component
public class RealtimeEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(RealtimeEventPublisher.class);

    /** Random per-instance id; lets us tag the origin of each event. */
    private final String originId = UUID.randomUUID().toString();

    private final ObjectProvider<StringRedisTemplate> redisProvider;
    private final ObjectMapper objectMapper;

    public RealtimeEventPublisher(ObjectProvider<StringRedisTemplate> redisProvider,
                                  ObjectMapper objectMapper) {
        this.redisProvider = redisProvider;
        this.objectMapper = objectMapper;
    }

    public String originId() {
        return originId;
    }

    /** Build and publish a group-scoped event (→ {@code /topic/groups/{groupId}}). */
    public void publish(String type, UUID groupId, Object payload) {
        if (groupId == null) {
            // Personal tasks have no group topic; nothing to fan out.
            return;
        }
        publish(RealtimeEvent.of(type, groupId, payload, originId));
    }

    /** Build and publish a room-scoped event (→ {@code /topic/rooms/{roomId}}). */
    public void publishRoom(String type, UUID roomId, Object payload) {
        if (roomId == null) {
            return;
        }
        publish(RealtimeEvent.ofRoom(type, roomId, payload, originId));
    }

    /**
     * Build and publish a user-scoped event. Goes through the SAME Redis channel
     * as group/room events; the {@link RealtimeEventSubscriber} routes it to the
     * recipient's personal queue {@code /user/{userId}/queue/notifications} via
     * {@code convertAndSendToUser}. Keeps the single-path design (no service ever
     * touches {@code SimpMessagingTemplate} directly).
     */
    public void publishUser(UUID userId, String type, Object payload) {
        if (userId == null) {
            return;
        }
        publish(RealtimeEvent.ofUser(type, userId, payload, originId));
    }

    public void publish(RealtimeEvent event) {
        StringRedisTemplate redis = redisProvider.getIfAvailable();
        if (redis == null) {
            log.debug("Redis unavailable; dropping realtime event type={} group={}",
                event.type(), event.groupId());
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(event);
            redis.convertAndSend(RedisConfig.EVENTS_CHANNEL, json);
        } catch (JsonProcessingException ex) {
            log.warn("Failed to serialize realtime event type={}", event.type(), ex);
        }
    }
}
