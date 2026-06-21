package com.todly.realtime;

import com.todly.realtime.RealtimePayloads.PresencePayload;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Group presence tracked in Redis so it is correct across instances.
 *
 * <p>A "presence entry" is one STOMP subscription, keyed by
 * {@code stompSessionId:subscriptionId}. Keys:
 * <ul>
 *   <li>{@code presence:entry:{entryId}} (hash) — userId + groupId, used to clean
 *       up when the entry/session goes away.</li>
 *   <li>{@code presence:stomp:{stompSessionId}} (set) — the entryIds owned by a
 *       STOMP session, so a single DISCONNECT can tear them all down.</li>
 *   <li>{@code presence:group:{groupId}:user:{userId}} (set) — the entryIds that
 *       user holds for the group (a user may open several tabs/subscriptions).</li>
 *   <li>{@code presence:group:{groupId}} (set) — userIds currently online in the
 *       group (a user appears once regardless of entry count).</li>
 * </ul>
 *
 * <p>A user is "online" in a group while they hold at least one entry. The
 * mutating methods report which groups changed online membership so the caller
 * can broadcast {@code presence.updated} only when needed.
 */
@Service
public class PresenceService {

    private final ObjectProvider<StringRedisTemplate> redisProvider;

    public PresenceService(ObjectProvider<StringRedisTemplate> redisProvider) {
        this.redisProvider = redisProvider;
    }

    private static String entryKey(String entryId) {
        return "presence:entry:" + entryId;
    }

    private static String stompKey(String stompSessionId) {
        return "presence:stomp:" + stompSessionId;
    }

    private static String userKey(UUID groupId, UUID userId) {
        return "presence:group:" + groupId + ":user:" + userId;
    }

    private static String groupKey(UUID groupId) {
        return "presence:group:" + groupId;
    }

    /**
     * Record a subscription. Returns true if this made the user newly online in
     * the group (their first entry there) and a broadcast is warranted.
     */
    public boolean onSubscribe(String stompSessionId, String subscriptionId,
                               UUID userId, UUID groupId) {
        StringRedisTemplate redis = redis();
        if (redis == null) {
            return false;
        }
        String entryId = stompSessionId + ":" + subscriptionId;
        redis.opsForHash().put(entryKey(entryId), "userId", userId.toString());
        redis.opsForHash().put(entryKey(entryId), "groupId", groupId.toString());
        redis.opsForSet().add(stompKey(stompSessionId), entryId);

        redis.opsForSet().add(userKey(groupId, userId), entryId);
        Long total = redis.opsForSet().size(userKey(groupId, userId));
        boolean firstEntry = total != null && total <= 1;
        if (firstEntry) {
            redis.opsForSet().add(groupKey(groupId), userId.toString());
        }
        return firstEntry;
    }

    /**
     * Tear down every entry owned by a disconnected STOMP session. Returns the
     * set of groupIds whose online membership shrank (a user went fully offline),
     * so callers broadcast a presence.updated for each.
     */
    public Set<UUID> onDisconnect(String stompSessionId) {
        StringRedisTemplate redis = redis();
        Set<UUID> changed = new HashSet<>();
        if (redis == null) {
            return changed;
        }
        Set<String> entryIds = redis.opsForSet().members(stompKey(stompSessionId));
        redis.delete(stompKey(stompSessionId));
        if (entryIds == null) {
            return changed;
        }
        for (String entryId : entryIds) {
            Object userVal = redis.opsForHash().get(entryKey(entryId), "userId");
            Object groupVal = redis.opsForHash().get(entryKey(entryId), "groupId");
            redis.delete(entryKey(entryId));
            if (userVal == null || groupVal == null) {
                continue;
            }
            UUID userId = UUID.fromString(userVal.toString());
            UUID groupId = UUID.fromString(groupVal.toString());
            redis.opsForSet().remove(userKey(groupId, userId), entryId);
            Long remaining = redis.opsForSet().size(userKey(groupId, userId));
            if (remaining == null || remaining == 0) {
                redis.delete(userKey(groupId, userId));
                redis.opsForSet().remove(groupKey(groupId), userId.toString());
                changed.add(groupId);
            }
        }
        return changed;
    }

    /** Current online snapshot for a group. */
    public PresencePayload snapshot(UUID groupId) {
        StringRedisTemplate redis = redis();
        List<UUID> online = new ArrayList<>();
        if (redis != null) {
            Set<String> members = redis.opsForSet().members(groupKey(groupId));
            if (members != null) {
                for (String m : members) {
                    online.add(UUID.fromString(m));
                }
            }
        }
        return new PresencePayload(groupId, online.size(), online);
    }

    public boolean isOnline(UUID groupId, UUID userId) {
        StringRedisTemplate redis = redis();
        if (redis == null) {
            return false;
        }
        return Boolean.TRUE.equals(redis.opsForSet().isMember(groupKey(groupId), userId.toString()));
    }

    public int onlineCount(UUID groupId) {
        StringRedisTemplate redis = redis();
        if (redis == null) {
            return 0;
        }
        Long size = redis.opsForSet().size(groupKey(groupId));
        return size == null ? 0 : size.intValue();
    }

    public boolean redisAvailable() {
        return redis() != null;
    }

    private StringRedisTemplate redis() {
        return redisProvider.getIfAvailable();
    }
}
