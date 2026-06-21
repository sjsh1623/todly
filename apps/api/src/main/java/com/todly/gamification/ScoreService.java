package com.todly.gamification;

import com.todly.live.LiveSessionRepository;
import com.todly.routine.RoutineLogRepository;
import com.todly.task.TaskRepository;
import com.todly.task.TaskStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Transparent gamification scoring (PHASE 9, FR-GAM, IMP-23 "score transparency").
 *
 * <p><b>Source of truth.</b> The {@code daily_activity} table is the per-day
 * "grass" counter: it is bumped by +1 every time a user completes a task or a
 * routine, and decremented (floored at 0) when a task is reopened. The heatmap,
 * {@code yearlyCount} and the streaks are all derived from this single table so
 * the visible heatmap and the numbers can never disagree.
 *
 * <p><b>Documented formula</b> (also returned to clients under {@code stats.rules}):
 * <ul>
 *   <li><b>lifeScore</b> = (completed tasks) × 10 + (completed live sessions) × 5.
 *       "Completed tasks" = tasks whose {@code completedBy} is the user and that
 *       are still {@code done} and not deleted. "Completed live sessions" = the
 *       user's ended {@code live_sessions} rows.</li>
 *   <li><b>routineScore</b> = (routine completions) × 15 + (current routine
 *       streak total) × 2. "Routine completions" = the user's non-skipped
 *       {@code routine_logs} rows. The streak bonus rewards keeping habits alive.</li>
 *   <li><b>completionRate</b> = round( assigned-and-done ÷ assigned × 100 ), over
 *       all non-deleted tasks the user is an assignee of. 0 when nothing assigned.</li>
 *   <li><b>currentStreak</b> = consecutive calendar days (UTC) ending today — or
 *       yesterday if today has no activity yet — that have {@code daily_activity.count > 0}.
 *       <b>bestStreak</b> = the longest such run ever (also never less than the
 *       previously stored best).</li>
 *   <li><b>yearlyCount</b> = sum of {@code daily_activity.count} within the current
 *       calendar year (Jan 1 .. today, UTC).</li>
 * </ul>
 *
 * <p>{@code onTaskCompleted}/{@code onTaskReopened}/{@code onRoutineCompleted} bump
 * the day counter then recompute the user's {@link UserStats} row. The read side
 * ({@link #recompute}) is also called by {@code /me/stats} so a client always sees
 * fresh numbers even if a write path was missed.
 */
@Service
public class ScoreService {

    /** Documented scoring constants (kept here so the rules text stays in sync). */
    public static final int POINTS_PER_TASK = 10;
    public static final int POINTS_PER_LIVE_SESSION = 5;
    public static final int POINTS_PER_ROUTINE = 15;
    public static final int ROUTINE_STREAK_BONUS = 2;

    public static final String LIFE_SCORE_RULE =
        "완료 1건당 10점, 라이브 세션 1건당 5점 (lifeScore = 완료 태스크 × 10 + 라이브 세션 × 5)";
    public static final String ROUTINE_SCORE_RULE =
        "루틴 완료 1건당 15점 + 현재 루틴 연속일 1일당 2점 보너스 (routineScore = 루틴 완료 × 15 + 연속일 × 2)";

    private static final ZoneOffset ZONE = ZoneOffset.UTC;

    private final DailyActivityRepository dailyActivityRepository;
    private final UserStatsRepository userStatsRepository;
    private final TaskRepository taskRepository;
    private final RoutineLogRepository routineLogRepository;
    private final LiveSessionRepository liveSessionRepository;
    private final com.todly.routine.RoutineStreakRepository routineStreakRepository;
    private final com.todly.routine.RoutineRepository routineRepository;

    public ScoreService(DailyActivityRepository dailyActivityRepository,
                        UserStatsRepository userStatsRepository,
                        TaskRepository taskRepository,
                        RoutineLogRepository routineLogRepository,
                        LiveSessionRepository liveSessionRepository,
                        com.todly.routine.RoutineStreakRepository routineStreakRepository,
                        com.todly.routine.RoutineRepository routineRepository) {
        this.dailyActivityRepository = dailyActivityRepository;
        this.userStatsRepository = userStatsRepository;
        this.taskRepository = taskRepository;
        this.routineLogRepository = routineLogRepository;
        this.liveSessionRepository = liveSessionRepository;
        this.routineStreakRepository = routineStreakRepository;
        this.routineRepository = routineRepository;
    }

    // --- write hooks ------------------------------------------------------

    /** A task was completed by the user: +1 to today's grass and recompute stats. */
    @Transactional
    public void onTaskCompleted(UUID userId) {
        bumpToday(userId, +1);
        recompute(userId);
    }

    /** A task the user had completed was reopened: -1 from today's grass (floor 0). */
    @Transactional
    public void onTaskReopened(UUID userId) {
        bumpToday(userId, -1);
        recompute(userId);
    }

    /** A routine was completed by the user: +1 to today's grass and recompute stats. */
    @Transactional
    public void onRoutineCompleted(UUID userId) {
        bumpToday(userId, +1);
        recompute(userId);
    }

    // --- recompute --------------------------------------------------------

    /**
     * Recompute and persist the user's {@link UserStats} from the current data.
     * Returns the (saved) stats so callers can serve fresh numbers.
     */
    @Transactional
    public UserStats recompute(UUID userId) {
        LocalDate today = LocalDate.now(ZONE);

        long completedTasks = taskRepository.countCompletedByUser(userId, TaskStatus.done);
        long liveSessions = liveSessionRepository.countEndedByUser(userId);
        int lifeScore = (int) (completedTasks * POINTS_PER_TASK
            + liveSessions * POINTS_PER_LIVE_SESSION);

        long routineCompletions = routineLogRepository.countDoneByUser(userId);
        int routineStreakTotal = currentRoutineStreakTotal(userId);
        int routineScore = (int) (routineCompletions * POINTS_PER_ROUTINE)
            + routineStreakTotal * ROUTINE_STREAK_BONUS;

        long assigned = taskRepository.countAssignedToUser(userId);
        long assignedDone = taskRepository.countAssignedDoneToUser(userId, TaskStatus.done);
        BigDecimal completionRate = assigned == 0
            ? BigDecimal.ZERO
            : BigDecimal.valueOf(assignedDone * 100.0 / assigned).setScale(0, RoundingMode.HALF_UP);

        long yearlyCount = dailyActivityRepository.sumCountBetween(
            userId, LocalDate.of(today.getYear(), 1, 1), today);

        int[] streaks = computeStreaks(userId, today);

        UserStats stats = userStatsRepository.findById(userId).orElseGet(() -> {
            UserStats s = new UserStats();
            s.setUserId(userId);
            return s;
        });
        stats.setLifeScore(lifeScore);
        stats.setRoutineScore(routineScore);
        stats.setCompletionRate(completionRate);
        stats.setCurrentStreak(streaks[0]);
        stats.setBestStreak(Math.max(stats.getBestStreak(), streaks[1]));
        stats.setYearlyCount((int) yearlyCount);
        return userStatsRepository.save(stats);
    }

    // --- helpers ----------------------------------------------------------

    private void bumpToday(UUID userId, int delta) {
        LocalDate today = LocalDate.now(ZONE);
        DailyActivityId id = new DailyActivityId(userId, today);
        DailyActivity row = dailyActivityRepository.findById(id).orElseGet(() -> {
            DailyActivity d = new DailyActivity();
            d.setId(id);
            d.setCount(0);
            return d;
        });
        row.setCount(Math.max(0, row.getCount() + delta));
        dailyActivityRepository.save(row);
    }

    /** [current, best] consecutive-day streaks from daily_activity (count > 0). */
    int[] computeStreaks(UUID userId, LocalDate today) {
        List<LocalDate> activeDesc = dailyActivityRepository.findActiveDaysDesc(userId);
        Set<LocalDate> active = new HashSet<>(activeDesc);

        // Current: anchor at today if active, else yesterday (today may not be done yet).
        int current = 0;
        LocalDate cursor = active.contains(today) ? today : today.minusDays(1);
        while (active.contains(cursor)) {
            current++;
            cursor = cursor.minusDays(1);
        }

        // Best: longest run across all active days (activeDesc is newest-first;
        // walk it and count descending consecutive runs).
        int best = 0;
        int run = 0;
        LocalDate prev = null;
        for (LocalDate d : activeDesc) {
            if (prev != null && d.equals(prev.minusDays(1))) {
                run++;
            } else {
                run = 1;
            }
            best = Math.max(best, run);
            prev = d;
        }
        return new int[] {current, Math.max(best, current)};
    }

    /** Sum of current streaks across the user's routines (for the routineScore bonus). */
    private int currentRoutineStreakTotal(UUID userId) {
        int total = 0;
        for (com.todly.routine.Routine r : routineRepository.findMine(userId)) {
            var streak = routineStreakRepository.findById(r.getId());
            if (streak.isPresent()) {
                total += streak.get().getCurrentStreak();
            }
        }
        return total;
    }
}
