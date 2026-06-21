package com.todly.task;

import com.todly.activity.ActivityService;
import com.todly.activity.ActivityType;
import com.todly.comment.Comment;
import com.todly.common.ApiException;
import com.todly.group.Group;
import com.todly.group.GroupAccessService;
import com.todly.group.GroupMember;
import com.todly.group.GroupMemberRepository;
import com.todly.group.MemberRole;
import com.todly.realtime.RealtimeEventPublisher;
import com.todly.realtime.RealtimePayloads.TaskEventPayload;
import com.todly.task.dto.TaskDtos.AssigneeDto;
import com.todly.task.dto.TaskDtos.CommentAuthorDto;
import com.todly.task.dto.TaskDtos.CommentDto;
import com.todly.task.dto.TaskDtos.ConsistencyDto;
import com.todly.task.dto.TaskDtos.CreateCommentRequest;
import com.todly.task.dto.TaskDtos.CreateSectionRequest;
import com.todly.task.dto.TaskDtos.TaskPhotoDto;
import com.todly.task.dto.TaskDtos.CreateSubtaskRequest;
import com.todly.task.dto.TaskDtos.CreateTaskRequest;
import com.todly.task.dto.TaskDtos.GroupTasksDto;
import com.todly.task.dto.TaskDtos.ProgressDto;
import com.todly.task.dto.TaskDtos.SectionDto;
import com.todly.task.dto.TaskDtos.SectionGroupDto;
import com.todly.task.dto.TaskDtos.SectionProgressDto;
import com.todly.task.dto.TaskDtos.SubtaskDto;
import com.todly.task.dto.TaskDtos.TaskDto;
import com.todly.task.dto.TaskDtos.UpdateSectionRequest;
import com.todly.task.dto.TaskDtos.UpdateSubtaskRequest;
import com.todly.task.dto.TaskDtos.UpdateTaskRequest;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Section, task and subtask business logic for PHASE 4.
 *
 * <p>Authorization is delegated to {@link GroupAccessService}; every group-scoped
 * operation runs the caller through {@code requireMember}. Two policies worth
 * calling out:
 *
 * <ul>
 *   <li><b>Optimistic locking</b>: PATCH /tasks/{id} requires the version the
 *       caller last read. We compare it eagerly and throw 409 VERSION_CONFLICT,
 *       and the {@code @Version} column also guards concurrent writers (mapped to
 *       409 in {@code GlobalExceptionHandler}).</li>
 *   <li><b>Task delete</b>: a task may be soft-deleted by its creator OR by a
 *       group owner/admin. Plain members who did not create the task get 403.</li>
 * </ul>
 */
@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final SectionRepository sectionRepository;
    private final SubtaskRepository subtaskRepository;
    private final TaskAssigneeRepository assigneeRepository;
    private final GroupMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final ActivityService activityService;
    private final com.todly.notification.NotificationService notificationService;
    private final GroupAccessService access;
    private final RealtimeEventPublisher realtime;
    private final com.todly.gamification.ScoreService scoreService;
    private final com.todly.comment.CommentRepository commentRepository;
    private final com.todly.photo.PhotoRepository photoRepository;
    private final com.todly.storage.StorageService storage;
    private final com.todly.storage.ImageThumbnailer thumbnailer;
    private final com.todly.gamification.StatsService statsService;

    public TaskService(TaskRepository taskRepository,
                       SectionRepository sectionRepository,
                       SubtaskRepository subtaskRepository,
                       TaskAssigneeRepository assigneeRepository,
                       GroupMemberRepository memberRepository,
                       UserRepository userRepository,
                       ActivityService activityService,
                       com.todly.notification.NotificationService notificationService,
                       GroupAccessService access,
                       RealtimeEventPublisher realtime,
                       com.todly.gamification.ScoreService scoreService,
                       com.todly.comment.CommentRepository commentRepository,
                       com.todly.photo.PhotoRepository photoRepository,
                       com.todly.storage.StorageService storage,
                       com.todly.storage.ImageThumbnailer thumbnailer,
                       com.todly.gamification.StatsService statsService) {
        this.taskRepository = taskRepository;
        this.sectionRepository = sectionRepository;
        this.subtaskRepository = subtaskRepository;
        this.assigneeRepository = assigneeRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.activityService = activityService;
        this.notificationService = notificationService;
        this.access = access;
        this.realtime = realtime;
        this.scoreService = scoreService;
        this.commentRepository = commentRepository;
        this.photoRepository = photoRepository;
        this.storage = storage;
        this.thumbnailer = thumbnailer;
        this.statsService = statsService;
    }

    // --- sections ---------------------------------------------------------

    @Transactional
    public SectionDto createSection(UUID groupId, UUID userId, CreateSectionRequest req) {
        access.requireMember(groupId, userId);
        Section s = new Section();
        s.setGroupId(groupId);
        s.setTitle(req.title().trim());
        s.setPosition(req.position() != null ? req.position() : 0);
        sectionRepository.save(s);
        return toSectionDto(s);
    }

    @Transactional
    public SectionDto updateSection(UUID sectionId, UUID userId, UpdateSectionRequest req) {
        Section s = sectionRepository.findById(sectionId)
            .orElseThrow(() -> ApiException.notFound("Section not found"));
        access.requireMember(s.getGroupId(), userId);
        if (req.title() != null) {
            s.setTitle(req.title().trim());
        }
        if (req.position() != null) {
            s.setPosition(req.position());
        }
        sectionRepository.save(s);
        return toSectionDto(s);
    }

    @Transactional
    public void deleteSection(UUID sectionId, UUID userId) {
        Section s = sectionRepository.findById(sectionId)
            .orElseThrow(() -> ApiException.notFound("Section not found"));
        access.requireMember(s.getGroupId(), userId);
        // FK on tasks.section_id is ON DELETE SET NULL, so member tasks become unsectioned.
        sectionRepository.delete(s);
    }

    // --- task queries -----------------------------------------------------

    @Transactional(readOnly = true)
    public GroupTasksDto listGroupTasks(UUID groupId, UUID userId) {
        access.requireMember(groupId, userId);

        List<Task> tasks = taskRepository.findGroupTasks(groupId);
        List<Section> sections = sectionRepository.findGroupSections(groupId);

        // Batch-hydrate assignees + subtasks for all tasks.
        List<UUID> taskIds = tasks.stream().map(Task::getId).toList();
        Map<UUID, List<AssigneeDto>> assigneesByTask = loadAssignees(taskIds);
        Map<UUID, List<SubtaskDto>> subtasksByTask = loadSubtasks(taskIds);

        long total = 0;
        long done = 0;
        Map<UUID, List<TaskDto>> bySection = new LinkedHashMap<>();
        List<TaskDto> unsectioned = new ArrayList<>();
        for (Task t : tasks) {
            total++;
            if (t.getStatus() == TaskStatus.done) {
                done++;
            }
            TaskDto dto = toTaskDto(t, assigneesByTask.get(t.getId()), subtasksByTask.get(t.getId()),
                List.of(), List.of(), new ConsistencyDto(0));
            if (t.getSectionId() != null) {
                bySection.computeIfAbsent(t.getSectionId(), k -> new ArrayList<>()).add(dto);
            } else {
                unsectioned.add(dto);
            }
        }

        List<SectionGroupDto> sectionDtos = new ArrayList<>(sections.size());
        for (Section s : sections) {
            List<TaskDto> sectionTasks = bySection.getOrDefault(s.getId(), List.of());
            long sDone = sectionTasks.stream().filter(t -> t.status() == TaskStatus.done).count();
            sectionDtos.add(new SectionGroupDto(
                s.getId(), s.getTitle(), s.getPosition(),
                new SectionProgressDto(sDone, sectionTasks.size()),
                sectionTasks));
        }

        int percent = total == 0 ? 0 : (int) Math.round(done * 100.0 / total);
        return new GroupTasksDto(new ProgressDto(percent, done, total), sectionDtos, unsectioned);
    }

    @Transactional(readOnly = true)
    public TaskDto getTask(UUID taskId, UUID userId) {
        Task t = requireTask(taskId);
        requireTaskGroupMember(t, userId);
        return hydrateDetail(t);
    }

    // --- task mutations ---------------------------------------------------

    @Transactional
    public TaskDto createTask(UUID userId, CreateTaskRequest req) {
        Task t = new Task();
        if (req.groupId() != null) {
            Group g = access.requireMember(req.groupId(), userId).getGroup();
            t.setGroup(g);
            if (req.sectionId() != null) {
                Section s = sectionRepository.findById(req.sectionId())
                    .orElseThrow(() -> ApiException.notFound("Section not found"));
                if (!s.getGroupId().equals(req.groupId())) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                        "Section does not belong to the group");
                }
                t.setSectionId(s.getId());
            }
        }
        // Personal tasks (groupId == null) are allowed without a membership check.
        t.setCreatorId(userId);
        t.setTitle(req.title().trim());
        t.setNote(req.note());
        t.setStatus(TaskStatus.todo);
        t.setPriority(req.priority() != null ? req.priority() : TaskPriority.none);
        t.setDueDate(req.dueDate());
        taskRepository.save(t);

        if (req.groupId() != null && req.assigneeIds() != null) {
            for (UUID assigneeId : req.assigneeIds()) {
                requireGroupMember(req.groupId(), assigneeId, "Assignee must be a group member");
                addAssigneeRow(t.getId(), assigneeId);
            }
        }

        writeActivity(t, userId, ActivityType.task_created);
        TaskDto dto = hydrate(t);
        publishTaskEvent("task.created", t, dto);
        return dto;
    }

    @Transactional
    public TaskDto updateTask(UUID taskId, UUID userId, UpdateTaskRequest req) {
        Task t = requireTask(taskId);
        requireTaskGroupMember(t, userId);

        // Eager optimistic-lock check: caller must send the version they read.
        if (req.version() == null || req.version() != t.getVersion()) {
            throw versionConflict();
        }

        if (req.title() != null) {
            t.setTitle(req.title().trim());
        }
        if (req.note() != null) {
            t.setNote(req.note());
        }
        if (req.priority() != null) {
            t.setPriority(req.priority());
        }
        if (req.dueDate() != null) {
            t.setDueDate(req.dueDate());
        }
        if (req.sectionId() != null) {
            Section s = sectionRepository.findById(req.sectionId())
                .orElseThrow(() -> ApiException.notFound("Section not found"));
            if (t.getGroup() == null || !s.getGroupId().equals(t.getGroup().getId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                    "Section does not belong to the task's group");
            }
            t.setSectionId(s.getId());
        }
        taskRepository.saveAndFlush(t);
        TaskDto dto = hydrate(t);
        publishTaskEvent("task.updated", t, dto);
        return dto;
    }

    @Transactional
    public TaskDto completeTask(UUID taskId, UUID userId) {
        Task t = requireTask(taskId);
        requireTaskGroupMember(t, userId);
        // Idempotent: only score + record the activity on a real todo->done transition,
        // so completing an already-done task never double counts.
        boolean wasAlreadyDone = t.getStatus() == TaskStatus.done;
        t.setStatus(TaskStatus.done);
        t.setCompletedAt(OffsetDateTime.now());
        t.setCompletedBy(userId);
        taskRepository.save(t);
        if (!wasAlreadyDone) {
            writeActivity(t, userId, ActivityType.task_completed);
            scoreService.onTaskCompleted(userId);
        }
        TaskDto dto = hydrate(t);
        publishTaskEvent("task.completed", t, dto);
        maybeMilestone(t, userId);
        return dto;
    }

    /**
     * If completing this task brought the group to 100% (all tasks done, >0 tasks),
     * record a {@code milestone_reached} activity and notify every group member.
     * Must be flushed first so the count reflects the just-saved completion.
     */
    private void maybeMilestone(Task t, UUID actorId) {
        if (t.getGroup() == null) {
            return;
        }
        UUID groupId = t.getGroup().getId();
        taskRepository.flush();
        long total = taskRepository.countTotal(groupId);
        long done = taskRepository.countByStatus(groupId, TaskStatus.done);
        if (total == 0 || done < total) {
            return;
        }
        activityService.record(groupId, actorId, ActivityType.milestone_reached, t.getId(),
            "{\"percent\":100}");
        // Notify every member that the group hit 100%.
        for (GroupMember m : memberRepository.findMembersWithUser(groupId)) {
            UUID memberId = m.getUser().getId();
            notificationService.notify(memberId,
                com.todly.notification.NotificationType.milestone,
                "목표 달성! 🎉", "그룹의 모든 할 일을 완료했어요.",
                "/groups/" + groupId);
        }
    }

    @Transactional
    public TaskDto reopenTask(UUID taskId, UUID userId) {
        Task t = requireTask(taskId);
        requireTaskGroupMember(t, userId);
        // Only undo the score when we actually transition done->todo. Decrement the
        // grass of whoever earned the completion (completedBy), then clear it.
        boolean wasDone = t.getStatus() == TaskStatus.done;
        UUID completer = t.getCompletedBy();
        t.setStatus(TaskStatus.todo);
        t.setCompletedAt(null);
        t.setCompletedBy(null);
        taskRepository.save(t);
        if (wasDone) {
            writeActivity(t, userId, ActivityType.task_reopened);
            scoreService.onTaskReopened(completer != null ? completer : userId);
        }
        TaskDto dto = hydrate(t);
        publishTaskEvent("task.reopened", t, dto);
        return dto;
    }

    @Transactional
    public void deleteTask(UUID taskId, UUID userId) {
        Task t = requireTask(taskId);
        boolean isCreator = t.getCreatorId().equals(userId);
        if (t.getGroup() != null) {
            GroupMember me = access.requireMember(t.getGroup().getId(), userId);
            boolean isOwnerOrAdmin = me.getRole() != MemberRole.member;
            if (!isCreator && !isOwnerOrAdmin) {
                throw GroupAccessService.forbidden(
                    "Only the task creator or a group owner/admin may delete this task");
            }
        } else if (!isCreator) {
            throw GroupAccessService.forbidden("Only the task creator may delete this task");
        }
        TaskDto dto = hydrate(t);
        t.setDeletedAt(OffsetDateTime.now());
        taskRepository.save(t);
        publishTaskEvent("task.deleted", t, dto);
    }

    // --- assignees --------------------------------------------------------

    @Transactional
    public TaskDto addAssignee(UUID taskId, UUID userId, UUID assigneeId) {
        Task t = requireTask(taskId);
        UUID groupId = requireTaskGroupMember(t, userId);
        requireGroupMember(groupId, assigneeId, "Assignee must be a group member");
        boolean added = addAssigneeRow(taskId, assigneeId);
        // Notify the new assignee (but not when self-assigning).
        if (added && !assigneeId.equals(userId)) {
            notificationService.notify(assigneeId,
                com.todly.notification.NotificationType.assigned,
                "새 할 일이 배정되었어요", t.getTitle(),
                "/tasks/" + taskId);
        }
        return hydrate(t);
    }

    @Transactional
    public TaskDto removeAssignee(UUID taskId, UUID userId, UUID assigneeId) {
        Task t = requireTask(taskId);
        requireTaskGroupMember(t, userId);
        TaskAssigneeId id = new TaskAssigneeId(taskId, assigneeId);
        if (assigneeRepository.existsById(id)) {
            assigneeRepository.deleteById(id);
        }
        return hydrate(t);
    }

    // --- subtasks ---------------------------------------------------------

    @Transactional
    public SubtaskDto createSubtask(UUID taskId, UUID userId, CreateSubtaskRequest req) {
        Task t = requireTask(taskId);
        requireTaskGroupMember(t, userId);
        int nextPos = subtaskRepository.findByTaskId(taskId).size();
        Subtask s = new Subtask();
        s.setTaskId(taskId);
        s.setTitle(req.title().trim());
        s.setDone(false);
        s.setPosition(nextPos);
        subtaskRepository.save(s);
        return toSubtaskDto(s);
    }

    @Transactional
    public SubtaskDto updateSubtask(UUID subtaskId, UUID userId, UpdateSubtaskRequest req) {
        Subtask s = subtaskRepository.findById(subtaskId)
            .orElseThrow(() -> ApiException.notFound("Subtask not found"));
        Task t = requireTask(s.getTaskId());
        requireTaskGroupMember(t, userId);
        if (req.title() != null) {
            s.setTitle(req.title().trim());
        }
        if (req.isDone() != null) {
            s.setDone(req.isDone());
        }
        subtaskRepository.save(s);
        return toSubtaskDto(s);
    }

    @Transactional
    public void deleteSubtask(UUID subtaskId, UUID userId) {
        Subtask s = subtaskRepository.findById(subtaskId)
            .orElseThrow(() -> ApiException.notFound("Subtask not found"));
        Task t = requireTask(s.getTaskId());
        requireTaskGroupMember(t, userId);
        subtaskRepository.delete(s);
    }

    // --- comments (PHASE 9, SCR-12) --------------------------------------

    @Transactional
    public CommentDto addComment(UUID taskId, UUID userId, CreateCommentRequest req) {
        Task t = requireTask(taskId);
        requireTaskGroupMember(t, userId);

        Comment c = new Comment();
        c.setTaskId(taskId);
        c.setAuthorId(userId);
        c.setBody(req.body().trim());
        commentRepository.save(c);

        // Feed: a comment was added (group tasks only).
        if (t.getGroup() != null) {
            activityService.record(t.getGroup().getId(), userId, ActivityType.comment_added,
                taskId, null);
        }

        // Notify the task's assignees + creator, except the commenter, respecting pushComment.
        java.util.Set<UUID> recipients = new java.util.HashSet<>(
            assigneeRepository.findAssigneeIds(taskId));
        if (t.getCreatorId() != null) {
            recipients.add(t.getCreatorId());
        }
        recipients.remove(userId);
        User author = userRepository.findById(userId).orElse(null);
        String authorName = author != null ? author.getNickname() : "누군가";
        for (UUID recipient : recipients) {
            notificationService.notify(recipient,
                com.todly.notification.NotificationType.comment,
                authorName + "님의 댓글", t.getTitle(),
                "/tasks/" + taskId);
        }

        User a = userRepository.findById(userId).orElse(null);
        CommentAuthorDto authorDto = a == null
            ? new CommentAuthorDto(userId, null, null)
            : new CommentAuthorDto(a.getId(), a.getNickname(), a.getProfileColor().name());
        return new CommentDto(c.getId(), authorDto, c.getBody(), c.getCreatedAt());
    }

    @Transactional
    public void deleteComment(UUID commentId, UUID userId) {
        Comment c = commentRepository.findById(commentId)
            .orElseThrow(() -> ApiException.notFound("Comment not found"));
        if (c.getDeletedAt() != null) {
            return; // already deleted (idempotent)
        }
        if (!c.getAuthorId().equals(userId)) {
            throw GroupAccessService.forbidden("Only the comment author may delete it");
        }
        c.setDeletedAt(OffsetDateTime.now());
        commentRepository.save(c);
    }

    // --- task photos (PHASE 9, SCR-12 / IMP-25) --------------------------

    @Transactional
    public TaskPhotoDto addPhoto(UUID taskId, UUID userId, byte[] bytes, String contentType) {
        Task t = requireTask(taskId);
        requireTaskGroupMember(t, userId);

        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTENT_TYPE",
                "Only image/* uploads are accepted");
        }
        if (bytes == null || bytes.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Empty upload");
        }
        if (bytes.length > com.todly.room.LiveRoomService.MAX_PHOTO_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "PHOTO_TOO_LARGE",
                "Image exceeds the "
                    + (com.todly.room.LiveRoomService.MAX_PHOTO_BYTES / (1024 * 1024)) + "MB limit");
        }
        java.awt.image.BufferedImage image = thumbnailer.decode(bytes);

        // Persist first so Hibernate assigns the UUID, then key storage by it.
        com.todly.photo.Photo photo = new com.todly.photo.Photo();
        photo.setUploaderId(userId);
        photo.setTaskId(taskId);
        photo.setUrl("pending"); // url column is NOT NULL; replaced below
        photo.setWidth(image.getWidth());
        photo.setHeight(image.getHeight());
        photo.setBytes(bytes.length);
        photoRepository.saveAndFlush(photo);

        UUID photoId = photo.getId();
        String key = photoId.toString();
        String thumbKey = photoId + "-thumb";
        byte[] thumbBytes = thumbnailer.thumbnail(image);
        try {
            storage.put(key, bytes, contentType);
            storage.put(thumbKey, thumbBytes, "image/png");
        } catch (java.io.IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR",
                "Failed to store the image");
        }

        photo.setUrl("/api/v1/photos/" + photoId);
        photo.setThumbUrl("/api/v1/photos/" + photoId + "/thumb");
        photoRepository.saveAndFlush(photo);

        // Feed: a photo was shared on this task (group tasks only).
        if (t.getGroup() != null) {
            activityService.record(t.getGroup().getId(), userId,
                ActivityType.photo_shared, taskId,
                "{\"photoId\":\"" + photoId + "\"}");
        }
        return toTaskPhotoDto(photo);
    }

    // --- helpers ----------------------------------------------------------

    private Task requireTask(UUID taskId) {
        return taskRepository.findActiveById(taskId)
            .orElseThrow(() -> ApiException.notFound("Task not found"));
    }

    /** Ensure the caller is a member of the task's group; returns the group id. */
    private UUID requireTaskGroupMember(Task t, UUID userId) {
        if (t.getGroup() == null) {
            // Personal task: only the creator may touch it.
            if (!t.getCreatorId().equals(userId)) {
                throw GroupAccessService.forbidden("Not your task");
            }
            return null;
        }
        UUID groupId = t.getGroup().getId();
        access.requireMember(groupId, userId);
        return groupId;
    }

    private void requireGroupMember(UUID groupId, UUID userId, String message) {
        if (!memberRepository.isMember(groupId, userId)) {
            throw GroupAccessService.forbidden(message);
        }
    }

    private boolean addAssigneeRow(UUID taskId, UUID assigneeId) {
        TaskAssigneeId id = new TaskAssigneeId(taskId, assigneeId);
        if (!assigneeRepository.existsById(id)) {
            TaskAssignee a = new TaskAssignee();
            a.setId(id);
            assigneeRepository.save(a);
            return true;
        }
        return false;
    }

    private void writeActivity(Task t, UUID actorId, ActivityType type) {
        // Best-effort: activity rows require a group; skip for personal tasks.
        // Delegated to ActivityService so it also broadcasts activity.created.
        if (t.getGroup() == null) {
            return;
        }
        activityService.record(t.getGroup().getId(), actorId, type, t.getId(), null);
    }

    private TaskDto hydrate(Task t) {
        List<AssigneeDto> assignees = assigneeRepository.findAssigneeUsers(t.getId()).stream()
            .map(this::toAssigneeDto).toList();
        List<SubtaskDto> subtasks = subtaskRepository.findByTaskId(t.getId()).stream()
            .map(TaskService::toSubtaskDto).toList();
        return toTaskDto(t, assignees, subtasks, List.of(), List.of(), new ConsistencyDto(0));
    }

    /** Full task detail (SCR-12): assignees + subtasks + comments + photos + consistency. */
    private TaskDto hydrateDetail(Task t) {
        List<AssigneeDto> assignees = assigneeRepository.findAssigneeUsers(t.getId()).stream()
            .map(this::toAssigneeDto).toList();
        List<SubtaskDto> subtasks = subtaskRepository.findByTaskId(t.getId()).stream()
            .map(TaskService::toSubtaskDto).toList();
        List<CommentDto> comments = loadComments(t.getId());
        List<TaskPhotoDto> photos = photoRepository.findByTask(t.getId()).stream()
            .map(TaskService::toTaskPhotoDto).toList();
        int weeks = t.getRoutineId() != null ? statsService.routineWeeksStreak(t.getRoutineId()) : 0;
        return toTaskDto(t, assignees, subtasks, comments, photos, new ConsistencyDto(weeks));
    }

    private List<CommentDto> loadComments(UUID taskId) {
        List<Comment> rows = commentRepository.findActiveByTask(taskId);
        if (rows.isEmpty()) {
            return List.of();
        }
        List<UUID> authorIds = rows.stream().map(Comment::getAuthorId).distinct().toList();
        Map<UUID, User> authors = new LinkedHashMap<>();
        for (User u : userRepository.findAllById(authorIds)) {
            authors.put(u.getId(), u);
        }
        List<CommentDto> out = new ArrayList<>(rows.size());
        for (Comment c : rows) {
            User a = authors.get(c.getAuthorId());
            CommentAuthorDto author = a == null
                ? new CommentAuthorDto(c.getAuthorId(), null, null)
                : new CommentAuthorDto(a.getId(), a.getNickname(), a.getProfileColor().name());
            out.add(new CommentDto(c.getId(), author, c.getBody(), c.getCreatedAt()));
        }
        return out;
    }

    private Map<UUID, List<AssigneeDto>> loadAssignees(List<UUID> taskIds) {
        Map<UUID, List<AssigneeDto>> out = new LinkedHashMap<>();
        if (taskIds.isEmpty()) {
            return out;
        }
        for (Object[] row : assigneeRepository.findAssigneeUsersForTasks(taskIds)) {
            UUID taskId = (UUID) row[0];
            User u = (User) row[1];
            out.computeIfAbsent(taskId, k -> new ArrayList<>()).add(toAssigneeDto(u));
        }
        return out;
    }

    private Map<UUID, List<SubtaskDto>> loadSubtasks(List<UUID> taskIds) {
        Map<UUID, List<SubtaskDto>> out = new LinkedHashMap<>();
        if (taskIds.isEmpty()) {
            return out;
        }
        for (Subtask s : subtaskRepository.findByTaskIds(taskIds)) {
            out.computeIfAbsent(s.getTaskId(), k -> new ArrayList<>()).add(toSubtaskDto(s));
        }
        return out;
    }

    private SectionDto toSectionDto(Section s) {
        return new SectionDto(s.getId(), s.getGroupId(), s.getTitle(), s.getPosition());
    }

    private AssigneeDto toAssigneeDto(User u) {
        return new AssigneeDto(u.getId(), u.getUsername(), u.getNickname(),
            u.getProfileColor().name());
    }

    private static SubtaskDto toSubtaskDto(Subtask s) {
        return new SubtaskDto(s.getId(), s.getTitle(), s.isDone(), s.getPosition());
    }

    private static TaskPhotoDto toTaskPhotoDto(com.todly.photo.Photo p) {
        return new TaskPhotoDto(p.getId(), p.getUrl(), p.getThumbUrl(),
            p.getUploaderId(), p.getCreatedAt());
    }

    private TaskDto toTaskDto(Task t, List<AssigneeDto> assignees, List<SubtaskDto> subtasks,
                             List<CommentDto> comments, List<TaskPhotoDto> photos,
                             ConsistencyDto consistency) {
        return new TaskDto(
            t.getId(),
            t.getGroup() != null ? t.getGroup().getId() : null,
            t.getSectionId(),
            t.getTitle(),
            t.getNote(),
            t.getStatus(),
            t.getPriority(),
            t.getDueDate(),
            t.getDueAt(),
            t.getPosition(),
            t.getVersion(),
            t.getCreatorId(),
            t.getCompletedAt(),
            t.getCompletedBy(),
            assignees != null ? assignees : List.of(),
            subtasks != null ? subtasks : List.of(),
            comments != null ? comments : List.of(),
            photos != null ? photos : List.of(),
            consistency != null ? consistency : new ConsistencyDto(0));
    }

    // --- realtime ---------------------------------------------------------

    /**
     * Publish a task event to the group's STOMP topic via Redis.
     *
     * <p>Publish choice: we publish synchronously at the END of the surrounding
     * {@code @Transactional} method (just before return), NOT in an after-commit
     * hook. The payload's TaskDto and the progress counts are read inside the same
     * transaction, so they reflect the just-applied change. The (small) risk is
     * that a publish fires for a transaction that later rolls back; we accept that
     * because the publish is the very last statement and any rollback would be due
     * to a flush already triggered by the progress query above. This keeps the
     * code simple and the realtime latency minimal. Personal tasks (no group) are
     * skipped by {@link RealtimeEventPublisher#publish}.
     */
    private void publishTaskEvent(String type, Task t, TaskDto dto) {
        if (t.getGroup() == null) {
            return;
        }
        UUID groupId = t.getGroup().getId();
        ProgressDto progress = groupProgress(groupId);
        realtime.publish(type, groupId, new TaskEventPayload(dto, progress));
    }

    /** Re-broadcast the current state of a task as {@code task.updated} (used by live). */
    @Transactional(readOnly = true)
    public void publishTaskUpdated(UUID taskId) {
        Task t = taskRepository.findActiveById(taskId).orElse(null);
        if (t == null || t.getGroup() == null) {
            return;
        }
        publishTaskEvent("task.updated", t, hydrate(t));
    }

    private ProgressDto groupProgress(UUID groupId) {
        long total = taskRepository.countTotal(groupId);
        long done = taskRepository.countByStatus(groupId, TaskStatus.done);
        int percent = total == 0 ? 0 : (int) Math.round(done * 100.0 / total);
        return new ProgressDto(percent, done, total);
    }

    private static ApiException versionConflict() {
        return new ApiException(HttpStatus.CONFLICT, "VERSION_CONFLICT",
            "This task was modified by someone else. Reload and try again.");
    }
}
