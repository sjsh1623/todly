package com.todly.routine.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.todly.routine.RecurFreq;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * DTO records for routines (PHASE 7, SCR-09 / FR-RTN).
 */
public final class RoutineDtos {

    private RoutineDtos() {}

    public record StreakDto(int current, int best) {}

    public record RoutineDto(
            UUID id,
            UUID groupId,
            UUID sectionId,
            String title,
            RecurFreq recurFreq,
            JsonNode recurRule,
            LocalTime timeOfDay,
            OffsetDateTime nextRunAt,
            boolean isActive,
            StreakDto streak,
            boolean todayDone,
            UUID todayTaskId) {}

    public record CreateRoutineRequest(
            UUID groupId,
            UUID sectionId,
            @NotBlank String title,
            @NotNull RecurFreq recurFreq,
            JsonNode recurRule,
            LocalTime timeOfDay) {}

    public record UpdateRoutineRequest(
            String title,
            RecurFreq recurFreq,
            JsonNode recurRule,
            LocalTime timeOfDay,
            UUID sectionId) {}

    /** Returned by complete/skip. */
    public record RoutineActionDto(StreakDto streak, boolean todayDone) {}
}
