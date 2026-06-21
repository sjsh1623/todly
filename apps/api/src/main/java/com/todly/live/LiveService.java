package com.todly.live;

import com.todly.activity.ActivityService;
import com.todly.activity.ActivityType;
import com.todly.common.ApiException;
import com.todly.group.GroupAccessService;
import com.todly.group.GroupMember;
import com.todly.group.GroupMemberRepository;
import com.todly.live.dto.LiveDtos.SessionDto;
import com.todly.notification.NotificationService;
import com.todly.notification.NotificationType;
import com.todly.realtime.RealtimeEventPublisher;
import com.todly.realtime.RealtimePayloads.LiveEndedPayload;
import com.todly.realtime.RealtimePayloads.LiveSessionDto;
import com.todly.realtime.RealtimePayloads.LiveSessionPayload;
import com.todly.task.Task;
import com.todly.task.TaskRepository;
import com.todly.task.TaskService;
import com.todly.task.TaskStatus;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Live (focus) session lifecycle for PHASE 5.
 *
 * <p>At most one session may be active per user (enforced by the partial unique
 * index {@code uq_live_active_user}); {@link #start} gracefully ends any existing
 * one first. Elapsed time is computed client-side from {@code startedAt} and
 * {@code pausedSeconds}; the server only records timestamps and the accumulated
 * paused seconds.
 *
 * <p>Realtime: every state change is broadcast via {@link RealtimeEventPublisher}
 * (Redis single-path fanout). Task status side effects (in_progress on start,
 * back to todo on stop unless already done) are persisted here and surfaced as a
 * {@code task.updated} through {@link TaskService#publishTaskUpdated}.
 */
@Service
public class LiveService {

    private final LiveSessionRepository sessionRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final GroupAccessService access;
    private final RealtimeEventPublisher realtime;
    private final TaskService taskService;
    private final GroupMemberRepository memberRepository;
    private final ActivityService activityService;
    private final NotificationService notificationService;

    public LiveService(LiveSessionRepository sessionRepository,
                       TaskRepository taskRepository,
                       UserRepository userRepository,
                       GroupAccessService access,
                       RealtimeEventPublisher realtime,
                       TaskService taskService,
                       GroupMemberRepository memberRepository,
                       ActivityService activityService,
                       NotificationService notificationService) {
        this.sessionRepository = sessionRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.access = access;
        this.realtime = realtime;
        this.taskService = taskService;
        this.memberRepository = memberRepository;
        this.activityService = activityService;
        this.notificationService = notificationService;
    }

    @Transactional
    public SessionDto start(UUID taskId, UUID userId) {
        Task task = requireGroupTaskMember(taskId, userId);
        UUID groupId = task.getGroup().getId();

        // Enforce one-active-per-user: end any current session gracefully first.
        sessionRepository.findActiveByUser(userId).ifPresent(existing -> {
            endSession(existing);
            sessionRepository.saveAndFlush(existing);
            UUID prevTaskId = existing.getTaskId();
            // Revert the previously-live task so it doesn't linger as in_progress
            // with no active session (skip if it's the same task we're (re)starting,
            // or if it has since been completed).
            if (!prevTaskId.equals(taskId)) {
                taskRepository.findActiveById(prevTaskId).ifPresent(prev -> {
                    if (prev.getStatus() != TaskStatus.done) {
                        prev.setStatus(TaskStatus.todo);
                        taskRepository.save(prev);
                    }
                });
            }
            realtime.publish("live.ended", groupIdOfTask(prevTaskId),
                new LiveEndedPayload(existing.getId(), prevTaskId, existing.getUserId()));
            if (!prevTaskId.equals(taskId)) {
                taskService.publishTaskUpdated(prevTaskId);
            }
        });

        LiveSession session = new LiveSession();
        session.setTaskId(taskId);
        session.setUserId(userId);
        session.setStatus(LiveStatus.running);
        session.setStartedAt(OffsetDateTime.now());
        sessionRepository.saveAndFlush(session);

        task.setStatus(TaskStatus.in_progress);
        taskRepository.save(task);

        User user = requireUser(userId);
        realtime.publish("live.started", groupId, new LiveSessionPayload(broadcastDto(session, task, user)));
        taskService.publishTaskUpdated(taskId);

        // Feed + notify other members that a live session started.
        activityService.record(groupId, userId, ActivityType.live_started, taskId, null);
        for (GroupMember m : memberRepository.findMembersWithUser(groupId)) {
            UUID memberId = m.getUser().getId();
            if (memberId.equals(userId)) {
                continue;
            }
            notificationService.notify(memberId, NotificationType.live_started,
                user.getNickname() + "님이 라이브를 시작했어요", task.getTitle(),
                "/groups/" + groupId);
        }
        return toDto(session, task, user);
    }

    @Transactional
    public SessionDto pause(UUID taskId, UUID userId, boolean paused) {
        Task task = requireGroupTaskMember(taskId, userId);
        LiveSession session = sessionRepository.findActiveByUserAndTask(userId, taskId)
            .orElseThrow(() -> ApiException.notFound("No active live session for this task"));

        if (paused) {
            if (session.getStatus() == LiveStatus.running) {
                session.setPausedSeconds(session.getPausedSeconds() + elapsedSeconds(session));
                session.setStatus(LiveStatus.paused);
            }
        } else if (session.getStatus() == LiveStatus.paused) {
            // Resume: restart the running clock from now; client recomputes display.
            session.setStartedAt(OffsetDateTime.now());
            session.setStatus(LiveStatus.running);
        }
        sessionRepository.saveAndFlush(session);

        User user = requireUser(userId);
        realtime.publish("live.paused", task.getGroup().getId(),
            new LiveSessionPayload(broadcastDto(session, task, user)));
        return toDto(session, task, user);
    }

    @Transactional
    public void stop(UUID taskId, UUID userId) {
        Task task = requireGroupTaskMember(taskId, userId);
        LiveSession session = sessionRepository.findActiveByUserAndTask(userId, taskId)
            .orElseThrow(() -> ApiException.notFound("No active live session for this task"));

        endSession(session);
        sessionRepository.saveAndFlush(session);

        if (task.getStatus() != TaskStatus.done) {
            task.setStatus(TaskStatus.todo);
            taskRepository.save(task);
        }

        realtime.publish("live.ended", task.getGroup().getId(),
            new LiveEndedPayload(session.getId(), taskId, userId));
        taskService.publishTaskUpdated(taskId);
        activityService.record(task.getGroup().getId(), userId,
            ActivityType.live_ended, taskId, null);
    }

    /**
     * End a user's active session for a task if one exists (no-op otherwise).
     * Used when a live room closes so the underlying task doesn't linger as
     * {@code in_progress} with no active session. Mirrors {@link #stop} but
     * tolerant of there being no session.
     */
    @Transactional
    public void endActiveSessionForTask(UUID taskId, UUID userId) {
        sessionRepository.findActiveByUserAndTask(userId, taskId).ifPresent(session -> {
            endSession(session);
            sessionRepository.saveAndFlush(session);
            taskRepository.findActiveById(taskId).ifPresent(task -> {
                if (task.getStatus() != TaskStatus.done) {
                    task.setStatus(TaskStatus.todo);
                    taskRepository.save(task);
                }
            });
            realtime.publish("live.ended", groupIdOfTask(taskId),
                new LiveEndedPayload(session.getId(), taskId, userId));
            taskService.publishTaskUpdated(taskId);
        });
    }

    // --- helpers ----------------------------------------------------------

    private void endSession(LiveSession session) {
        if (session.getStatus() == LiveStatus.running) {
            session.setPausedSeconds(session.getPausedSeconds() + elapsedSeconds(session));
        }
        session.setStatus(LiveStatus.done);
        session.setEndedAt(OffsetDateTime.now());
    }

    private int elapsedSeconds(LiveSession session) {
        return (int) Math.max(0,
            Duration.between(session.getStartedAt(), OffsetDateTime.now()).getSeconds());
    }

    private Task requireGroupTaskMember(UUID taskId, UUID userId) {
        Task t = taskRepository.findActiveById(taskId)
            .orElseThrow(() -> ApiException.notFound("Task not found"));
        if (t.getGroup() == null) {
            throw GroupAccessService.forbidden("Live sessions require a group task");
        }
        access.requireMember(t.getGroup().getId(), userId);
        return t;
    }

    private User requireUser(UUID userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private UUID groupIdOfTask(UUID taskId) {
        return taskRepository.findActiveById(taskId)
            .map(t -> t.getGroup() != null ? t.getGroup().getId() : null)
            .orElse(null);
    }

    private LiveSessionDto broadcastDto(LiveSession s, Task task, User user) {
        return new LiveSessionDto(
            s.getId(), s.getTaskId(), task.getTitle(), s.getUserId(),
            user.getNickname(), user.getProfileColor().name(),
            s.getStartedAt(), s.getStatus().name());
    }

    private SessionDto toDto(LiveSession s, Task task, User user) {
        return new SessionDto(
            s.getId(), s.getTaskId(), task.getTitle(), s.getUserId(),
            user.getNickname(), user.getProfileColor().name(),
            s.getStartedAt(), s.getPausedSeconds(), s.getStatus(), s.getEndedAt());
    }
}
