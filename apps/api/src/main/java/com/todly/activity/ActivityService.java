package com.todly.activity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.todly.activity.dto.ActivityDtos.ActivityItemDto;
import com.todly.activity.dto.ActivityDtos.ActivityPageDto;
import com.todly.activity.dto.ActivityDtos.ActorDto;
import com.todly.common.ApiException;
import com.todly.group.Group;
import com.todly.group.GroupAccessService;
import com.todly.group.GroupMember;
import com.todly.group.GroupMemberRepository;
import com.todly.group.GroupRepository;
import com.todly.realtime.RealtimeEventPublisher;
import com.todly.task.TaskRepository;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The single entry point for writing + reading the activity feed (PHASE 7).
 *
 * <p>{@link #record} persists an {@link Activity} row AND broadcasts an
 * {@code activity.created} envelope on the group's STOMP topic. Every domain
 * event that should appear in the feed (task lifecycle, live start/end, member
 * joins, photo shares, routine completions, milestones) funnels through here so
 * the write + broadcast are consistent in one place.
 */
@Service
public class ActivityService {

    private static final Logger log = LoggerFactory.getLogger(ActivityService.class);

    private final ActivityRepository activityRepository;
    private final GroupMemberRepository memberRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final GroupAccessService access;
    private final RealtimeEventPublisher realtime;
    private final ObjectMapper objectMapper;

    public ActivityService(ActivityRepository activityRepository,
                           GroupMemberRepository memberRepository,
                           GroupRepository groupRepository,
                           UserRepository userRepository,
                           TaskRepository taskRepository,
                           GroupAccessService access,
                           RealtimeEventPublisher realtime,
                           ObjectMapper objectMapper) {
        this.activityRepository = activityRepository;
        this.memberRepository = memberRepository;
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
        this.access = access;
        this.realtime = realtime;
        this.objectMapper = objectMapper;
    }

    // --- write ------------------------------------------------------------

    /**
     * Persist an activity row and broadcast {@code activity.created} to the group.
     * Best-effort: activities require a group, so personal-task events are skipped.
     * {@code meta} is a pre-serialized JSON string (or null).
     */
    @Transactional
    public Activity record(UUID groupId, UUID actorId, ActivityType type,
                           UUID targetTaskId, String meta) {
        if (groupId == null) {
            return null;
        }
        Activity a = new Activity();
        a.setGroupId(groupId);
        a.setActorId(actorId);
        a.setType(type);
        a.setTargetTaskId(targetTaskId);
        a.setMeta(meta);
        activityRepository.save(a);

        // Broadcast a hydrated item so subscribers can render without a refetch.
        try {
            ActivityItemDto item = hydrateOne(a, false, null);
            realtime.publish("activity.created", groupId, item);
        } catch (RuntimeException ex) {
            log.warn("activity.created broadcast failed for group={}", groupId, ex);
        }
        return a;
    }

    // --- read: per-group feed --------------------------------------------

    @Transactional(readOnly = true)
    public ActivityPageDto groupFeed(UUID groupId, UUID userId, String cursor, int limit) {
        access.requireMember(groupId, userId);
        int pageSize = clampLimit(limit);
        PageRequest page = PageRequest.of(0, pageSize + 1);

        List<Activity> rows;
        if (cursor == null || cursor.isBlank()) {
            rows = activityRepository.findGroupFeed(groupId, page);
        } else {
            Cursor c = Cursor.parse(cursor);
            rows = activityRepository.findGroupFeedAfter(groupId, c.at(), c.id(), page);
        }
        return toPage(rows, pageSize, false);
    }

    // --- read: merged feed across my groups ------------------------------

    @Transactional(readOnly = true)
    public ActivityPageDto mergedFeed(UUID userId, String cursor, int limit) {
        List<GroupMember> memberships = memberRepository.findMyMemberships(userId);
        List<UUID> groupIds = new ArrayList<>(memberships.size());
        for (GroupMember m : memberships) {
            groupIds.add(m.getGroup().getId());
        }
        if (groupIds.isEmpty()) {
            return new ActivityPageDto(List.of(), null);
        }
        int pageSize = clampLimit(limit);
        PageRequest page = PageRequest.of(0, pageSize + 1);

        List<Activity> rows;
        if (cursor == null || cursor.isBlank()) {
            rows = activityRepository.findMergedFeed(groupIds, page);
        } else {
            Cursor c = Cursor.parse(cursor);
            rows = activityRepository.findMergedFeedAfter(groupIds, c.at(), c.id(), page);
        }
        return toPage(rows, pageSize, true);
    }

    // --- hydration --------------------------------------------------------

    private ActivityPageDto toPage(List<Activity> rows, int pageSize, boolean includeGroup) {
        boolean hasMore = rows.size() > pageSize;
        List<Activity> pageRows = hasMore ? rows.subList(0, pageSize) : rows;

        // Batch-hydrate actors, target titles and (for merged) group names.
        List<UUID> actorIds = new ArrayList<>();
        List<UUID> taskIds = new ArrayList<>();
        for (Activity a : pageRows) {
            actorIds.add(a.getActorId());
            if (a.getTargetTaskId() != null) {
                taskIds.add(a.getTargetTaskId());
            }
        }
        Map<UUID, User> users = new HashMap<>();
        for (User u : userRepository.findAllById(actorIds)) {
            users.put(u.getId(), u);
        }
        Map<UUID, String> titles = new HashMap<>();
        if (!taskIds.isEmpty()) {
            for (Object[] row : taskRepository.findTitles(taskIds)) {
                titles.put((UUID) row[0], (String) row[1]);
            }
        }
        Map<UUID, String> groupNames = new HashMap<>();
        if (includeGroup) {
            List<UUID> gids = pageRows.stream().map(Activity::getGroupId).distinct().toList();
            for (Group g : groupRepository.findAllById(gids)) {
                groupNames.put(g.getId(), g.getName());
            }
        }

        List<ActivityItemDto> items = new ArrayList<>(pageRows.size());
        for (Activity a : pageRows) {
            items.add(buildItem(a, users.get(a.getActorId()),
                titles.get(a.getTargetTaskId()), includeGroup,
                includeGroup ? groupNames.get(a.getGroupId()) : null));
        }
        String nextCursor = hasMore && !pageRows.isEmpty()
            ? Cursor.of(pageRows.get(pageRows.size() - 1)).encode()
            : null;
        return new ActivityPageDto(items, nextCursor);
    }

    /** Hydrate a single freshly-written activity for the realtime broadcast. */
    private ActivityItemDto hydrateOne(Activity a, boolean includeGroup, String groupName) {
        User actor = userRepository.findById(a.getActorId()).orElse(null);
        String title = null;
        if (a.getTargetTaskId() != null) {
            List<Object[]> rows = taskRepository.findTitles(List.of(a.getTargetTaskId()));
            if (!rows.isEmpty()) {
                title = (String) rows.get(0)[1];
            }
        }
        return buildItem(a, actor, title, includeGroup, groupName);
    }

    private ActivityItemDto buildItem(Activity a, User actor, String targetTitle,
                                      boolean includeGroup, String groupName) {
        ActorDto actorDto = actor == null
            ? new ActorDto(a.getActorId(), null, null)
            : new ActorDto(actor.getId(), actor.getNickname(), actor.getProfileColor().name());
        JsonNode meta = parseMeta(a.getMeta());
        UUID groupId = includeGroup ? a.getGroupId() : null;
        return new ActivityItemDto(a.getId(), groupId, includeGroup ? groupName : null,
            a.getType().name(), actorDto, a.getTargetTaskId(), targetTitle, meta, a.getCreatedAt());
    }

    private JsonNode parseMeta(String meta) {
        if (meta == null || meta.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(meta);
        } catch (Exception e) {
            return null;
        }
    }

    private int clampLimit(int limit) {
        if (limit <= 0) {
            return 20;
        }
        return Math.min(limit, 100);
    }

    /** Opaque cursor "createdAtMillis:uuid" → page after this row. */
    private record Cursor(OffsetDateTime at, UUID id) {
        static Cursor of(Activity a) {
            return new Cursor(a.getCreatedAt(), a.getId());
        }

        String encode() {
            return at.toInstant().toEpochMilli() + "_" + id;
        }

        static Cursor parse(String raw) {
            int sep = raw.lastIndexOf('_');
            if (sep <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                    "Malformed cursor");
            }
            try {
                long millis = Long.parseLong(raw.substring(0, sep));
                UUID id = UUID.fromString(raw.substring(sep + 1));
                return new Cursor(
                    java.time.Instant.ofEpochMilli(millis).atOffset(java.time.ZoneOffset.UTC), id);
            } catch (RuntimeException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                    "Malformed cursor");
            }
        }
    }
}
