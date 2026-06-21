package com.todly.gamification;

import com.todly.common.CurrentUser;
import com.todly.gamification.dto.StatsDtos.HeatmapDto;
import com.todly.gamification.dto.StatsDtos.RecentActivityItem;
import com.todly.gamification.dto.StatsDtos.RoutineConsistencyDto;
import com.todly.gamification.dto.StatsDtos.StatsDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Gamification / stats endpoints (PHASE 9, SCR-10/13, FR-GAM). All require auth;
 * everything is scoped to the current user.
 */
@RestController
@RequestMapping("/api/v1")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/me/stats")
    public StatsDto stats() {
        return statsService.stats(CurrentUser.id());
    }

    @GetMapping("/me/heatmap")
    public HeatmapDto heatmap(@RequestParam(value = "weeks", required = false) Integer weeks) {
        return statsService.heatmap(CurrentUser.id(), weeks);
    }

    @GetMapping("/me/recent-activity")
    public List<RecentActivityItem> recentActivity(
            @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return statsService.recentActivity(CurrentUser.id(), limit);
    }

    @GetMapping("/routines/consistency")
    public List<RoutineConsistencyDto> consistency(
            @RequestParam(value = "weeks", required = false) Integer weeks) {
        return statsService.consistency(CurrentUser.id(), weeks);
    }

    /** Single routine's done-day grass (SCR-13 alternative shape). */
    @GetMapping("/routines/{id}/heatmap")
    public RoutineConsistencyDto routineHeatmap(
            @PathVariable UUID id,
            @RequestParam(value = "weeks", required = false) Integer weeks) {
        return statsService.consistency(CurrentUser.id(), weeks).stream()
            .filter(c -> c.id().equals(id))
            .findFirst()
            .orElseThrow(() -> com.todly.common.ApiException.notFound("Routine not found"));
    }
}
