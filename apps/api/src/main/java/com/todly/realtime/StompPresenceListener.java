package com.todly.realtime;

import com.todly.group.GroupMemberRepository;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

/**
 * Translates STOMP lifecycle events into presence state and broadcasts.
 *
 * <p>On SUBSCRIBE to {@code /topic/groups/{groupId}} by an authenticated, member
 * user we: refresh {@code group_members.last_seen_at}, register the subscription
 * in {@link PresenceService}, and (if the user just came online in the group)
 * publish a {@code presence.updated}. On DISCONNECT we tear the session's entries
 * down and publish {@code presence.updated} for any group the user left.
 *
 * <p>Broadcasts go exclusively through {@link RealtimeEventPublisher} (Redis) so
 * the single-path fanout invariant holds.
 */
@Component
public class StompPresenceListener {

    private static final String GROUP_PREFIX = "/topic/groups/";

    private final PresenceService presenceService;
    private final RealtimeEventPublisher publisher;
    private final GroupMemberRepository memberRepository;

    public StompPresenceListener(PresenceService presenceService,
                                 RealtimeEventPublisher publisher,
                                 GroupMemberRepository memberRepository) {
        this.presenceService = presenceService;
        this.publisher = publisher;
        this.memberRepository = memberRepository;
    }

    @EventListener
    @Transactional
    public void onSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = accessor.getDestination();
        UUID groupId = parseGroupId(destination);
        if (groupId == null) {
            return;
        }
        UUID userId = principalUserId(accessor);
        if (userId == null) {
            return;
        }
        // Only members may register presence in a group.
        if (!memberRepository.isMember(groupId, userId)) {
            return;
        }
        memberRepository.touchLastSeen(groupId, userId, OffsetDateTime.now());

        boolean nowOnline = presenceService.onSubscribe(
            accessor.getSessionId(), accessor.getSubscriptionId(), userId, groupId);
        if (nowOnline) {
            publisher.publish("presence.updated", groupId, presenceService.snapshot(groupId));
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        Set<UUID> changedGroups = presenceService.onDisconnect(event.getSessionId());
        for (UUID groupId : changedGroups) {
            publisher.publish("presence.updated", groupId, presenceService.snapshot(groupId));
        }
    }

    private UUID parseGroupId(String destination) {
        if (destination == null || !destination.startsWith(GROUP_PREFIX)) {
            return null;
        }
        String rest = destination.substring(GROUP_PREFIX.length());
        // Ignore any deeper path; the group id is the first segment.
        int slash = rest.indexOf('/');
        if (slash >= 0) {
            rest = rest.substring(0, slash);
        }
        try {
            return UUID.fromString(rest);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private UUID principalUserId(StompHeaderAccessor accessor) {
        if (accessor.getUser() == null) {
            return null;
        }
        try {
            return UUID.fromString(accessor.getUser().getName());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
