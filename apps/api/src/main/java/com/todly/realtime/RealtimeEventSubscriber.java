package com.todly.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * The SINGLE component that pushes messages to STOMP clients. It receives every
 * realtime envelope from the Redis {@code todly:events} channel (via the
 * {@code RedisMessageListenerContainer}) and rebroadcasts it to the destination
 * implied by the envelope's {@code scope}/{@code id}:
 * {@code /topic/groups/{id}} for {@code scope="group"} or {@code /topic/rooms/{id}}
 * for {@code scope="room"}. Legacy envelopes carrying only {@code groupId} are
 * still handled (treated as group scope).
 *
 * <p>Crucially it does NOT skip events that originated on this instance: because
 * publishing is the only path and this subscriber is the only sink, each event
 * is delivered exactly once per instance regardless of where it was published.
 * That gives identical behaviour on a single node or a cluster.
 */
@Component
public class RealtimeEventSubscriber {

    private static final Logger log = LoggerFactory.getLogger(RealtimeEventSubscriber.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    public RealtimeEventSubscriber(SimpMessagingTemplate messagingTemplate,
                                   ObjectMapper objectMapper) {
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
    }

    /** The personal-queue suffix for user-scoped events ({@code /user/{id}/queue/notifications}). */
    public static final String USER_QUEUE = "/queue/notifications";

    /** Invoked by the MessageListenerAdapter for each Redis message body. */
    public void onMessage(String body) {
        try {
            JsonNode node = objectMapper.readTree(body);
            // Forward the already-serialized envelope verbatim as a Map so the
            // STOMP message converter re-emits the same {type,scope,id,payload,at}.
            Object envelope = objectMapper.treeToValue(node, Object.class);

            // User-scoped events go to the recipient's personal queue via
            // convertAndSendToUser — the single-path equivalent of group/room fanout.
            JsonNode scope = node.get("scope");
            if (scope != null && !scope.isNull()
                    && RealtimeEvent.SCOPE_USER.equals(scope.asText())) {
                JsonNode id = node.get("id");
                if (id == null || id.isNull()) {
                    return;
                }
                messagingTemplate.convertAndSendToUser(id.asText(), USER_QUEUE, envelope);
                return;
            }

            String destination = destinationFor(node);
            if (destination == null) {
                return;
            }
            messagingTemplate.convertAndSend(destination, envelope);
        } catch (Exception ex) {
            log.warn("Failed to rebroadcast realtime event", ex);
        }
    }

    /**
     * Resolve the STOMP destination from the envelope's scope/id. Falls back to
     * the legacy {@code groupId} field when {@code scope} is absent so old-shaped
     * envelopes keep routing to the group topic.
     */
    private String destinationFor(JsonNode node) {
        JsonNode scope = node.get("scope");
        if (scope != null && !scope.isNull()) {
            JsonNode id = node.get("id");
            if (id == null || id.isNull()) {
                return null;
            }
            return switch (scope.asText()) {
                case RealtimeEvent.SCOPE_ROOM -> "/topic/rooms/" + id.asText();
                case RealtimeEvent.SCOPE_GROUP -> "/topic/groups/" + id.asText();
                default -> null;
            };
        }
        JsonNode groupId = node.get("groupId");
        if (groupId == null || groupId.isNull()) {
            return null;
        }
        return "/topic/groups/" + groupId.asText();
    }
}
