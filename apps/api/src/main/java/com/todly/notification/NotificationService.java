package com.todly.notification;

import com.todly.common.ApiException;
import com.todly.notification.dto.NotificationDtos.NotificationItemDto;
import com.todly.notification.dto.NotificationDtos.NotificationPageDto;
import com.todly.notification.dto.NotificationDtos.PushSubscriptionRequest;
import com.todly.notification.dto.NotificationDtos.SettingsDto;
import com.todly.notification.dto.NotificationDtos.UpdateSettingsRequest;
import com.todly.realtime.RealtimeEventPublisher;
import com.todly.task.Task;
import com.todly.task.TaskAssigneeRepository;
import com.todly.task.TaskRepository;
import com.todly.task.TaskStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Notification persistence + realtime delivery + settings + push (PHASE 7, IMP-06).
 *
 * <p>{@link #notify} is the single entry point used by every trigger (assigned,
 * live_started, due/overdue, milestone, …). It first checks the user's
 * {@link NotificationSettings} (mapping each notification type to its push flag),
 * persists a {@link Notification}, then delivers it in realtime to the user's
 * personal STOMP queue via {@link RealtimeEventPublisher#publishUser} (single
 * Redis path) and best-effort web push via {@link PushSender}.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final NotificationSettingsRepository settingsRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository assigneeRepository;
    private final RealtimeEventPublisher realtime;
    private final PushSender pushSender;

    public NotificationService(NotificationRepository notificationRepository,
                               NotificationSettingsRepository settingsRepository,
                               DeviceTokenRepository deviceTokenRepository,
                               TaskRepository taskRepository,
                               TaskAssigneeRepository assigneeRepository,
                               RealtimeEventPublisher realtime,
                               PushSender pushSender) {
        this.notificationRepository = notificationRepository;
        this.settingsRepository = settingsRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.taskRepository = taskRepository;
        this.assigneeRepository = assigneeRepository;
        this.realtime = realtime;
        this.pushSender = pushSender;
    }

    // --- core notify ------------------------------------------------------

    /**
     * Create + deliver a notification for {@code userId}, honoring the user's
     * settings. Returns the persisted row, or null when suppressed by settings.
     */
    @Transactional
    public Notification notify(UUID userId, NotificationType type,
                               String title, String body, String link) {
        NotificationSettings settings = settingsRepository.findById(userId).orElse(null);
        if (!allowedBySettings(settings, type)) {
            return null;
        }

        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        n.setLink(link);
        n.setRead(false);
        notificationRepository.save(n);

        // Realtime push to the user's personal queue (single Redis path).
        try {
            realtime.publishUser(userId, "notification.created", toItem(n));
        } catch (RuntimeException ex) {
            log.warn("notification.created realtime delivery failed user={}", userId, ex);
        }
        // Best-effort web push (no-op without VAPID keys).
        try {
            pushSender.send(deviceTokenRepository.findByUserId(userId), title, body, link);
        } catch (RuntimeException ex) {
            log.warn("web push failed user={}", userId, ex);
        }
        return n;
    }

    /**
     * Map a notification type to its settings flag. Quiet hours suppress delivery
     * for all types. Types without a dedicated flag default to allowed.
     */
    private boolean allowedBySettings(NotificationSettings s, NotificationType type) {
        if (s == null) {
            return true; // no settings row → default allow
        }
        if (inQuietHours(s, OffsetDateTime.now().toLocalTime())) {
            return false;
        }
        return switch (type) {
            case due_soon, overdue -> s.isPushDue();
            case assigned -> s.isPushAssigned();
            case live_started -> s.isPushLive();
            case comment, mention -> s.isPushComment();
            // milestone/invite/friend_*/room_cheer have no toggle → always allowed
            default -> true;
        };
    }

    /** Quiet-hours window; supports wrap-around (e.g. 22:00–07:00). */
    private boolean inQuietHours(NotificationSettings s, LocalTime now) {
        LocalTime from = s.getQuietFrom();
        LocalTime to = s.getQuietTo();
        if (from == null || to == null) {
            return false;
        }
        if (from.equals(to)) {
            return false;
        }
        if (from.isBefore(to)) {
            return !now.isBefore(from) && now.isBefore(to);
        }
        // wrap-around past midnight
        return !now.isBefore(from) || now.isBefore(to);
    }

    // --- due / overdue scanner -------------------------------------------

    /**
     * TESTABLE scan (called hourly by {@link NotificationScheduler}). For every
     * assignee of a not-done task: dueDate == today → due_soon; dueDate < today →
     * overdue. Deduped to one notification per task+type per day (existing-check
     * on the link created since midnight). Returns the count created.
     */
    @Transactional
    public int scanDue(LocalDate today) {
        // Look back far enough to catch genuinely overdue items.
        LocalDate from = today.minusYears(1);
        List<Task> tasks = taskRepository.findDueBetween(from, today, TaskStatus.done);
        // Dedupe window: anything created in the last day counts as "already notified
        // today" — robust to server timezone vs. UTC midnight boundary.
        OffsetDateTime sinceMidnight = OffsetDateTime.now().minusHours(24);
        int created = 0;
        for (Task t : tasks) {
            boolean overdue = t.getDueDate().isBefore(today);
            NotificationType type = overdue ? NotificationType.overdue : NotificationType.due_soon;
            String link = "/tasks/" + t.getId();
            String title = overdue ? "기한이 지났어요" : "오늘 마감이에요";
            for (UUID assigneeId : assigneeRepository.findAssigneeIds(t.getId())) {
                if (notificationRepository.existsSince(assigneeId, type, link, sinceMidnight)) {
                    continue; // already notified today for this task+type
                }
                Notification n = notify(assigneeId, type, title, t.getTitle(), link);
                if (n != null) {
                    created++;
                }
            }
        }
        return created;
    }

    // --- feed / read ------------------------------------------------------

    @Transactional(readOnly = true)
    public NotificationPageDto feed(UUID userId, String cursor, int limit) {
        int pageSize = clampLimit(limit);
        PageRequest page = PageRequest.of(0, pageSize + 1);
        List<Notification> rows;
        if (cursor == null || cursor.isBlank()) {
            rows = notificationRepository.findFeed(userId, page);
        } else {
            Cursor c = Cursor.parse(cursor);
            rows = notificationRepository.findFeedAfter(userId, c.at(), c.id(), page);
        }
        boolean hasMore = rows.size() > pageSize;
        List<Notification> pageRows = hasMore ? rows.subList(0, pageSize) : rows;
        List<NotificationItemDto> items = new ArrayList<>(pageRows.size());
        for (Notification n : pageRows) {
            items.add(toItem(n));
        }
        String nextCursor = hasMore && !pageRows.isEmpty()
            ? Cursor.of(pageRows.get(pageRows.size() - 1)).encode()
            : null;
        long unread = notificationRepository.countUnread(userId);
        return new NotificationPageDto(items, nextCursor, unread);
    }

    @Transactional
    public void markRead(UUID userId, UUID id) {
        Notification n = notificationRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Notification not found"));
        if (!n.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Not your notification");
        }
        if (!n.isRead()) {
            n.setRead(true);
            notificationRepository.save(n);
        }
    }

    @Transactional
    public void markAllRead(UUID userId) {
        notificationRepository.markAllRead(userId);
    }

    // --- settings ---------------------------------------------------------

    @Transactional
    public SettingsDto getSettings(UUID userId) {
        return toSettingsDto(loadOrCreateSettings(userId));
    }

    @Transactional
    public SettingsDto updateSettings(UUID userId, UpdateSettingsRequest req) {
        NotificationSettings s = loadOrCreateSettings(userId);
        if (req.pushDue() != null) {
            s.setPushDue(req.pushDue());
        }
        if (req.pushAssigned() != null) {
            s.setPushAssigned(req.pushAssigned());
        }
        if (req.pushLive() != null) {
            s.setPushLive(req.pushLive());
        }
        if (req.pushComment() != null) {
            s.setPushComment(req.pushComment());
        }
        if (req.quietFrom() != null) {
            s.setQuietFrom(req.quietFrom());
        }
        if (req.quietTo() != null) {
            s.setQuietTo(req.quietTo());
        }
        settingsRepository.save(s);
        return toSettingsDto(s);
    }

    private NotificationSettings loadOrCreateSettings(UUID userId) {
        return settingsRepository.findById(userId).orElseGet(() -> {
            NotificationSettings s = new NotificationSettings();
            s.setUserId(userId);
            return settingsRepository.save(s);
        });
    }

    // --- push subscription ------------------------------------------------

    @Transactional
    public void registerPushSubscription(UUID userId, PushSubscriptionRequest req) {
        DevicePlatform platform = parsePlatform(req.platform());
        DeviceToken existing = deviceTokenRepository.findByToken(req.token()).orElse(null);
        if (existing != null) {
            existing.setUserId(userId);
            existing.setPlatform(platform);
            deviceTokenRepository.save(existing);
            return;
        }
        DeviceToken token = new DeviceToken();
        token.setUserId(userId);
        token.setToken(req.token());
        token.setPlatform(platform);
        deviceTokenRepository.save(token);
    }

    private DevicePlatform parsePlatform(String raw) {
        if (raw == null || raw.isBlank()) {
            return DevicePlatform.web;
        }
        try {
            return DevicePlatform.valueOf(raw.trim().toLowerCase());
        } catch (IllegalArgumentException e) {
            return DevicePlatform.web;
        }
    }

    // --- mapping ----------------------------------------------------------

    private NotificationItemDto toItem(Notification n) {
        return new NotificationItemDto(n.getId(), n.getType().name(), n.getTitle(),
            n.getBody(), n.getLink(), n.isRead(), n.getCreatedAt());
    }

    private SettingsDto toSettingsDto(NotificationSettings s) {
        return new SettingsDto(s.isPushDue(), s.isPushAssigned(), s.isPushLive(),
            s.isPushComment(), s.getQuietFrom(), s.getQuietTo());
    }

    private int clampLimit(int limit) {
        if (limit <= 0) {
            return 20;
        }
        return Math.min(limit, 100);
    }

    private record Cursor(OffsetDateTime at, UUID id) {
        static Cursor of(Notification n) {
            return new Cursor(n.getCreatedAt(), n.getId());
        }

        String encode() {
            return at.toInstant().toEpochMilli() + "_" + id;
        }

        static Cursor parse(String raw) {
            int sep = raw.lastIndexOf('_');
            if (sep <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Malformed cursor");
            }
            try {
                long millis = Long.parseLong(raw.substring(0, sep));
                UUID id = UUID.fromString(raw.substring(sep + 1));
                return new Cursor(
                    java.time.Instant.ofEpochMilli(millis).atOffset(ZoneOffset.UTC), id);
            } catch (RuntimeException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Malformed cursor");
            }
        }
    }
}
