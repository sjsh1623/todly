package com.todly.gamification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.todly.activity.dto.ActivityDtos.ActivityItemDto;
import com.todly.activity.dto.ActivityDtos.ActivityPageDto;
import com.todly.gamification.dto.StatsDtos.ConsistencyDay;
import com.todly.gamification.dto.StatsDtos.HeatmapDay;
import com.todly.gamification.dto.StatsDtos.HeatmapDto;
import com.todly.gamification.dto.StatsDtos.RecentActivityItem;
import com.todly.gamification.dto.StatsDtos.RoutineConsistencyDto;
import com.todly.gamification.dto.StatsDtos.ScoreRules;
import com.todly.gamification.dto.StatsDtos.StatsDto;
import com.todly.gamification.dto.StatsDtos.StreakBlock;
import com.todly.group.GroupMemberRepository;
import com.todly.routine.Routine;
import com.todly.routine.RoutineLogRepository;
import com.todly.routine.RoutineRepository;
import com.todly.routine.RoutineStreakRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Read side for stats / heatmap / recent-activity / per-routine consistency
 * (PHASE 9, SCR-10/13). Numbers are always recomputed via {@link ScoreService}
 * so the client never sees a stale {@link UserStats} row.
 *
 * <p><b>Heatmap level buckets</b> (GitHub-grass style, documented):
 * <pre>
 *   count == 0        → level 0
 *   count == 1        → level 1
 *   count == 2        → level 2
 *   count in [3, 4]   → level 3
 *   count >= 5        → level 4
 * </pre>
 */
@Service
public class StatsService {

    private static final ZoneOffset ZONE = ZoneOffset.UTC;
    private static final int DEFAULT_WEEKS = 16;
    private static final int MAX_WEEKS = 53;

    private final ScoreService scoreService;
    private final DailyActivityRepository dailyActivityRepository;
    private final GroupMemberRepository memberRepository;
    private final RoutineRepository routineRepository;
    private final RoutineLogRepository routineLogRepository;
    private final RoutineStreakRepository routineStreakRepository;
    private final com.todly.activity.ActivityService activityService;
    private final ObjectMapper objectMapper;

    public StatsService(ScoreService scoreService,
                        DailyActivityRepository dailyActivityRepository,
                        GroupMemberRepository memberRepository,
                        RoutineRepository routineRepository,
                        RoutineLogRepository routineLogRepository,
                        RoutineStreakRepository routineStreakRepository,
                        com.todly.activity.ActivityService activityService,
                        ObjectMapper objectMapper) {
        this.scoreService = scoreService;
        this.dailyActivityRepository = dailyActivityRepository;
        this.memberRepository = memberRepository;
        this.routineRepository = routineRepository;
        this.routineLogRepository = routineLogRepository;
        this.routineStreakRepository = routineStreakRepository;
        this.activityService = activityService;
        this.objectMapper = objectMapper;
    }

    // --- /me/stats --------------------------------------------------------

    @Transactional
    public StatsDto stats(UUID userId) {
        UserStats s = scoreService.recompute(userId);
        long groupCount = memberRepository.findActiveGroupIds(userId).size();
        return new StatsDto(
            s.getCompletionRate().intValue(),
            s.getCurrentStreak(),
            s.getBestStreak(),
            s.getLifeScore(),
            s.getRoutineScore(),
            s.getYearlyCount(),
            groupCount,
            new ScoreRules(ScoreService.LIFE_SCORE_RULE, ScoreService.ROUTINE_SCORE_RULE));
    }

    // --- /me/heatmap ------------------------------------------------------

    @Transactional(readOnly = true)
    public HeatmapDto heatmap(UUID userId, Integer weeks) {
        int w = clampWeeks(weeks);
        LocalDate to = LocalDate.now(ZONE);
        // Align so the window covers exactly w weeks ending today.
        LocalDate from = to.minusWeeks(w).plusDays(1);

        Map<LocalDate, Integer> byDay = new HashMap<>();
        for (DailyActivity d : dailyActivityRepository.findRange(userId, from, to)) {
            byDay.put(d.getId().getDay(), d.getCount());
        }

        List<HeatmapDay> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            int count = byDay.getOrDefault(d, 0);
            days.add(new HeatmapDay(d, count, level(count)));
        }
        return new HeatmapDto(from, to, days);
    }

    /** Documented 0–4 grass buckets. */
    static int level(int count) {
        if (count <= 0) return 0;
        if (count == 1) return 1;
        if (count == 2) return 2;
        if (count <= 4) return 3;
        return 4;
    }

    // --- /me/recent-activity ----------------------------------------------

    @Transactional(readOnly = true)
    public List<RecentActivityItem> recentActivity(UUID userId, int limit) {
        int lim = limit <= 0 ? 10 : Math.min(limit, 50);
        // Reuse the merged feed across my groups, then keep only my own actions.
        ActivityPageDto page = activityService.mergedFeed(userId, null, Math.min(100, lim * 4));
        List<RecentActivityItem> out = new ArrayList<>();
        for (ActivityItemDto item : page.items()) {
            if (item.actor() == null || !userId.equals(item.actor().userId())) {
                continue;
            }
            out.add(new RecentActivityItem(item.type(), describe(item), item.createdAt()));
            if (out.size() >= lim) {
                break;
            }
        }
        return out;
    }

    /** Build a short SCR-10 line like "아침 러닝 완료" / "여행에 투두 추가". */
    private String describe(ActivityItemDto item) {
        String title = item.targetTitle();
        String group = item.groupName();
        return switch (item.type()) {
            case "task_completed" -> (title != null ? title : "할 일") + " 완료";
            case "task_created" -> (group != null ? group + "에 " : "") + "투두 추가";
            case "task_reopened" -> (title != null ? title : "할 일") + " 다시 열기";
            case "routine_done" -> "루틴 완료";
            case "live_started" -> "라이브 시작";
            case "live_ended" -> "라이브 종료";
            case "photo_shared" -> "사진 공유";
            case "comment_added" -> (title != null ? title : "할 일") + "에 댓글";
            case "milestone_reached" -> (group != null ? group : "그룹") + " 목표 달성";
            case "friend_joined_room" -> "라이브 참여";
            default -> item.type();
        };
    }

    // --- /routines/consistency (SCR-13) -----------------------------------

    @Transactional(readOnly = true)
    public List<RoutineConsistencyDto> consistency(UUID userId, Integer weeks) {
        int w = clampWeeks(weeks);
        LocalDate to = LocalDate.now(ZONE);
        LocalDate from = to.minusWeeks(w).plusDays(1);

        List<RoutineConsistencyDto> out = new ArrayList<>();
        for (Routine r : routineRepository.findMine(userId)) {
            Set<LocalDate> done = new HashSet<>(
                routineLogRepository.findDoneDatesAscForUser(r.getId(), userId));
            List<ConsistencyDay> heatmap = new ArrayList<>();
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                heatmap.add(new ConsistencyDay(d, done.contains(d)));
            }
            StreakBlock streak = routineStreakRepository.findById(r.getId())
                .map(s -> new StreakBlock(s.getCurrentStreak(), s.getBestStreak()))
                .orElse(new StreakBlock(0, 0));
            out.add(new RoutineConsistencyDto(
                r.getId(), r.getTitle(), timeOf(r), r.getRecurFreq().name(),
                userRule(r), streak, heatmap));
        }
        return out;
    }

    // --- per-task / per-routine consistency weeks -------------------------

    /**
     * Number of consecutive ISO weeks (ending the current ISO week) in which a
     * routine has at least one non-skipped done log — the SCR-12 "이 투두의
     * 꾸준함 N주째" badge. 0 when there is no current run.
     */
    @Transactional(readOnly = true)
    public int routineWeeksStreak(UUID routineId) {
        List<LocalDate> doneAsc = routineLogRepository.findDoneDatesAsc(routineId);
        if (doneAsc.isEmpty()) {
            return 0;
        }
        // Collect the set of (year, isoWeek) keys that have at least one done day.
        Set<Long> weeks = new HashSet<>();
        java.time.temporal.WeekFields wf = java.time.temporal.WeekFields.ISO;
        for (LocalDate d : doneAsc) {
            weeks.add(weekKey(d, wf));
        }
        LocalDate today = LocalDate.now(ZONE);
        // Walk back week by week from the current ISO week while each week is present.
        int streak = 0;
        LocalDate cursor = today;
        while (weeks.contains(weekKey(cursor, wf))) {
            streak++;
            cursor = cursor.minusWeeks(1);
        }
        return streak;
    }

    private long weekKey(LocalDate d, java.time.temporal.WeekFields wf) {
        int week = d.get(wf.weekOfWeekBasedYear());
        int year = d.get(wf.weekBasedYear());
        return (long) year * 100 + week;
    }

    // --- helpers ----------------------------------------------------------

    private int clampWeeks(Integer weeks) {
        if (weeks == null || weeks <= 0) {
            return DEFAULT_WEEKS;
        }
        return Math.min(weeks, MAX_WEEKS);
    }

    private LocalTime timeOf(Routine r) {
        JsonNode rule = parse(r.getRecurRule());
        if (rule != null && rule.has("time") && rule.get("time").isTextual()) {
            try {
                return LocalTime.parse(rule.get("time").asText());
            } catch (RuntimeException ignored) {
                return null;
            }
        }
        return null;
    }

    private JsonNode userRule(Routine r) {
        return parse(r.getRecurRule());
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }
}
