package com.todly.task;

import com.todly.common.CurrentUser;
import com.todly.task.dto.TaskDtos.AddAssigneeRequest;
import com.todly.task.dto.TaskDtos.CommentDto;
import com.todly.task.dto.TaskDtos.CreateCommentRequest;
import com.todly.task.dto.TaskDtos.CreateSubtaskRequest;
import com.todly.task.dto.TaskDtos.CreateTaskRequest;
import com.todly.task.dto.TaskDtos.GroupTasksDto;
import com.todly.task.dto.TaskDtos.SubtaskDto;
import com.todly.task.dto.TaskDtos.TaskDto;
import com.todly.task.dto.TaskDtos.TaskPhotoDto;
import com.todly.task.dto.TaskDtos.UpdateSubtaskRequest;
import com.todly.task.dto.TaskDtos.UpdateTaskRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/**
 * Task, assignee and subtask endpoints. All require authentication; group
 * membership/role checks are enforced in {@link TaskService}.
 */
@RestController
@RequestMapping("/api/v1")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    // --- task collection / item ------------------------------------------

    @GetMapping("/groups/{groupId}/tasks")
    public GroupTasksDto listGroupTasks(@PathVariable UUID groupId) {
        return taskService.listGroupTasks(groupId, CurrentUser.id());
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskDto create(@Valid @RequestBody CreateTaskRequest req) {
        return taskService.createTask(CurrentUser.id(), req);
    }

    @GetMapping("/tasks/{id}")
    public TaskDto get(@PathVariable UUID id) {
        return taskService.getTask(id, CurrentUser.id());
    }

    @PatchMapping("/tasks/{id}")
    public TaskDto update(@PathVariable UUID id,
                          @Valid @RequestBody UpdateTaskRequest req) {
        return taskService.updateTask(id, CurrentUser.id(), req);
    }

    @PostMapping("/tasks/{id}/complete")
    public TaskDto complete(@PathVariable UUID id) {
        return taskService.completeTask(id, CurrentUser.id());
    }

    @PostMapping("/tasks/{id}/reopen")
    public TaskDto reopen(@PathVariable UUID id) {
        return taskService.reopenTask(id, CurrentUser.id());
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        taskService.deleteTask(id, CurrentUser.id());
    }

    // --- assignees --------------------------------------------------------

    @PostMapping("/tasks/{id}/assignees")
    public TaskDto addAssignee(@PathVariable UUID id,
                               @Valid @RequestBody AddAssigneeRequest req) {
        return taskService.addAssignee(id, CurrentUser.id(), req.userId());
    }

    @DeleteMapping("/tasks/{id}/assignees/{userId}")
    public TaskDto removeAssignee(@PathVariable UUID id, @PathVariable UUID userId) {
        return taskService.removeAssignee(id, CurrentUser.id(), userId);
    }

    // --- subtasks ---------------------------------------------------------

    @PostMapping("/tasks/{id}/subtasks")
    @ResponseStatus(HttpStatus.CREATED)
    public SubtaskDto createSubtask(@PathVariable UUID id,
                                    @Valid @RequestBody CreateSubtaskRequest req) {
        return taskService.createSubtask(id, CurrentUser.id(), req);
    }

    @PatchMapping("/subtasks/{id}")
    public SubtaskDto updateSubtask(@PathVariable UUID id,
                                    @Valid @RequestBody UpdateSubtaskRequest req) {
        return taskService.updateSubtask(id, CurrentUser.id(), req);
    }

    @DeleteMapping("/subtasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSubtask(@PathVariable UUID id) {
        taskService.deleteSubtask(id, CurrentUser.id());
    }

    // --- comments (PHASE 9, SCR-12) --------------------------------------

    @PostMapping("/tasks/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentDto addComment(@PathVariable UUID id,
                                 @Valid @RequestBody CreateCommentRequest req) {
        return taskService.addComment(id, CurrentUser.id(), req);
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable UUID id) {
        taskService.deleteComment(id, CurrentUser.id());
    }

    // --- task photos (PHASE 9, SCR-12) -----------------------------------

    @PostMapping("/tasks/{id}/photos")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskPhotoDto addPhoto(@PathVariable UUID id,
                                 @RequestParam("file") MultipartFile file) throws IOException {
        return taskService.addPhoto(id, CurrentUser.id(), file.getBytes(), file.getContentType());
    }
}
