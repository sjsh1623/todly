package com.todly.task.dto;

import com.todly.task.TaskPriority;
import com.todly.task.TaskStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Request/response payloads for the section, task, subtask and home API (PHASE 4).
 */
public final class TaskDtos {

    private TaskDtos() {}

    // --- section requests -------------------------------------------------

    public record CreateSectionRequest(
            @NotBlank @Size(min = 1, max = 60) String title,
            Integer position) {}

    public record UpdateSectionRequest(
            @Size(min = 1, max = 60) String title,
            Integer position) {}

    // --- task requests ----------------------------------------------------

    public record CreateTaskRequest(
            UUID groupId,
            UUID sectionId,
            @NotBlank @Size(min = 1, max = 200) String title,
            @Size(max = 5000) String note,
            TaskPriority priority,
            LocalDate dueDate,
            List<UUID> assigneeIds) {}

    public record UpdateTaskRequest(
            @NotNull Integer version,
            @Size(min = 1, max = 200) String title,
            @Size(max = 5000) String note,
            UUID sectionId,
            TaskPriority priority,
            LocalDate dueDate) {}

    public record AddAssigneeRequest(
            @NotNull UUID userId) {}

    // --- subtask requests -------------------------------------------------

    public record CreateSubtaskRequest(
            @NotBlank @Size(min = 1, max = 200) String title) {}

    public record UpdateSubtaskRequest(
            @Size(min = 1, max = 200) String title,
            Boolean isDone) {}

    // --- responses --------------------------------------------------------

    public record SectionDto(
            UUID id,
            UUID groupId,
            String title,
            int position) {}

    public record AssigneeDto(
            UUID userId,
            String username,
            String nickname,
            String profileColor) {}

    public record SubtaskDto(
            UUID id,
            String title,
            boolean isDone,
            int position) {}

    // --- comment / photo / consistency (PHASE 9, SCR-12) ------------------

    public record CommentAuthorDto(
            UUID userId,
            String nickname,
            String profileColor) {}

    public record CommentDto(
            UUID id,
            CommentAuthorDto author,
            String body,
            OffsetDateTime createdAt) {}

    public record CreateCommentRequest(
            @NotBlank @Size(min = 1, max = 2000) String body) {}

    public record TaskPhotoDto(
            UUID id,
            String url,
            String thumbUrl,
            UUID uploaderId,
            OffsetDateTime createdAt) {}

    /** The "이 투두의 꾸준함 N주째" badge for routine-linked tasks. */
    public record ConsistencyDto(int weeks) {}

    public record TaskDto(
            UUID id,
            UUID groupId,
            UUID sectionId,
            String title,
            String note,
            TaskStatus status,
            TaskPriority priority,
            LocalDate dueDate,
            OffsetDateTime dueAt,
            int position,
            int version,
            UUID creatorId,
            OffsetDateTime completedAt,
            UUID completedBy,
            List<AssigneeDto> assignees,
            List<SubtaskDto> subtasks,
            List<CommentDto> comments,
            List<TaskPhotoDto> photos,
            ConsistencyDto consistency) {}

    public record ProgressDto(int percent, long done, long total) {}

    public record SectionProgressDto(long done, long total) {}

    public record SectionGroupDto(
            UUID id,
            String title,
            int position,
            SectionProgressDto progress,
            List<TaskDto> tasks) {}

    public record GroupTasksDto(
            ProgressDto progress,
            List<SectionGroupDto> sections,
            List<TaskDto> unsectioned) {}
}
