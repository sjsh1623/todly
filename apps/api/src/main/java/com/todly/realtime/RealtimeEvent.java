package com.todly.realtime;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * The on-the-wire envelope broadcast over STOMP.
 *
 * <p>Shape: {@code {type, scope, id, payload, at}} where {@code at} is an ISO-8601
 * timestamp. The {@code scope} ("group" or "room") plus {@code id} tell the
 * {@link RealtimeEventSubscriber} which destination prefix to fan out to:
 * <ul>
 *   <li>{@code scope="group"} → {@code /topic/groups/{id}}</li>
 *   <li>{@code scope="room"}  → {@code /topic/rooms/{id}}</li>
 * </ul>
 *
 * <p>For backwards compatibility the legacy {@code groupId} field is still
 * serialized (mirroring {@code id} when {@code scope="group"}) so existing
 * PHASE 4/5 clients/tests reading {@code groupId} keep working unchanged.
 *
 * <p>It also carries an {@code originId} (the publishing instance id) used purely
 * for diagnostics — the subscriber does NOT skip its own messages (see the
 * single-path design in {@link RealtimeEventSubscriber}).
 */
public record RealtimeEvent(
        String type,
        String scope,
        UUID id,
        UUID groupId,
        Object payload,
        OffsetDateTime at,
        String originId) {

    public static final String SCOPE_GROUP = "group";
    public static final String SCOPE_ROOM = "room";
    public static final String SCOPE_USER = "user";

    /** Build a group-scoped event (legacy {@code groupId} mirrors {@code id}). */
    public static RealtimeEvent of(String type, UUID groupId, Object payload, String originId) {
        return new RealtimeEvent(type, SCOPE_GROUP, groupId, groupId, payload,
            OffsetDateTime.now(), originId);
    }

    /** Build a room-scoped event fanned out to {@code /topic/rooms/{roomId}}. */
    public static RealtimeEvent ofRoom(String type, UUID roomId, Object payload, String originId) {
        return new RealtimeEvent(type, SCOPE_ROOM, roomId, null, payload,
            OffsetDateTime.now(), originId);
    }

    /**
     * Build a user-scoped event delivered to that user's personal STOMP queue
     * ({@code /user/{userId}/queue/notifications}). Routed through Redis exactly
     * like group/room events so the single-path design is preserved.
     */
    public static RealtimeEvent ofUser(String type, UUID userId, Object payload, String originId) {
        return new RealtimeEvent(type, SCOPE_USER, userId, null, payload,
            OffsetDateTime.now(), originId);
    }
}
