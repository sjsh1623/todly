package com.todly.task;

import com.todly.common.CurrentUser;
import com.todly.task.dto.TaskDtos.CreateSectionRequest;
import com.todly.task.dto.TaskDtos.SectionDto;
import com.todly.task.dto.TaskDtos.UpdateSectionRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Section endpoints. Creating a section is nested under a group; update/delete
 * operate on the section id directly. Membership is enforced in
 * {@link TaskService} via {@code GroupAccessService}.
 */
@RestController
@RequestMapping("/api/v1")
public class SectionController {

    private final TaskService taskService;

    public SectionController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping("/groups/{groupId}/sections")
    @ResponseStatus(HttpStatus.CREATED)
    public SectionDto create(@PathVariable UUID groupId,
                             @Valid @RequestBody CreateSectionRequest req) {
        return taskService.createSection(groupId, CurrentUser.id(), req);
    }

    @PatchMapping("/sections/{id}")
    public SectionDto update(@PathVariable UUID id,
                             @Valid @RequestBody UpdateSectionRequest req) {
        return taskService.updateSection(id, CurrentUser.id(), req);
    }

    @DeleteMapping("/sections/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        taskService.deleteSection(id, CurrentUser.id());
    }
}
