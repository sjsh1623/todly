package com.todly.routine;

import com.todly.common.CurrentUser;
import com.todly.routine.dto.RoutineDtos.CreateRoutineRequest;
import com.todly.routine.dto.RoutineDtos.RoutineActionDto;
import com.todly.routine.dto.RoutineDtos.RoutineDto;
import com.todly.routine.dto.RoutineDtos.UpdateRoutineRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Routine endpoints (PHASE 7, SCR-09 / FR-RTN). All require authentication;
 * group membership / role checks live in {@link RoutineService}.
 */
@RestController
@RequestMapping("/api/v1/routines")
public class RoutineController {

    private final RoutineService routineService;

    public RoutineController(RoutineService routineService) {
        this.routineService = routineService;
    }

    @GetMapping
    public List<RoutineDto> myRoutines() {
        return routineService.myRoutines(CurrentUser.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoutineDto create(@Valid @RequestBody CreateRoutineRequest req) {
        return routineService.create(CurrentUser.id(), req);
    }

    @PatchMapping("/{id}")
    public RoutineDto update(@PathVariable UUID id, @RequestBody UpdateRoutineRequest req) {
        return routineService.update(id, CurrentUser.id(), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        routineService.delete(id, CurrentUser.id());
    }

    @PostMapping("/{id}/toggle")
    public RoutineDto toggle(@PathVariable UUID id) {
        return routineService.toggle(id, CurrentUser.id());
    }

    @PostMapping("/{id}/complete")
    public RoutineActionDto complete(@PathVariable UUID id) {
        return routineService.complete(id, CurrentUser.id());
    }

    @PostMapping("/{id}/skip")
    public RoutineActionDto skip(@PathVariable UUID id) {
        return routineService.skip(id, CurrentUser.id());
    }
}
