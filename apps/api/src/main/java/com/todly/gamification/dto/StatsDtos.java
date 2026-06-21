package com.todly.gamification.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * DTO records for the stats / gamification API (PHASE 9, SCR-10/13, FR-GAM).
 */
public final class StatsDtos {

    private StatsDtos() {}

    /** The "점수 규칙" transparency block (IMP-23). */
    public record ScoreRules(String lifeScore, String routineScore) {}

    /** GET /api/v1/me/stats response. */
    public record StatsDto(
            int completionRate,
            int currentStreak,
            int bestStreak,
            int lifeScore,
            int routineScore,
            int yearlyCount,
            long groupCount,
            ScoreRules rules) {}

    /** One heatmap cell. {@code level} is a 0–4 bucket derived from {@code count}. */
    public record HeatmapDay(LocalDate day, int count, int level) {}

    /** GET /api/v1/me/heatmap response. */
    public record HeatmapDto(LocalDate from, LocalDate to, List<HeatmapDay> days) {}

    /** One "최근 활동" line (SCR-10). */
    public record RecentActivityItem(String type, String title, OffsetDateTime at) {}

    /** One done-day for a routine's grass. */
    public record ConsistencyDay(LocalDate day, boolean done) {}

    public record StreakBlock(int current, int best) {}

    /** GET /api/v1/routines/consistency item (SCR-13 "루틴별 잔디"). */
    public record RoutineConsistencyDto(
            UUID id,
            String title,
            java.time.LocalTime timeOfDay,
            String recurFreq,
            JsonNode recurRule,
            StreakBlock streak,
            List<ConsistencyDay> heatmap) {}
}
