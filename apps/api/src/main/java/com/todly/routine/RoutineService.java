package com.todly.routine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.todly.activity.ActivityService;
import com.todly.activity.ActivityType;
import com.todly.common.ApiException;
import com.todly.group.Group;
import com.todly.group.GroupAccessService;
import com.todly.group.GroupMember;
import com.todly.group.GroupMemberRepository;
import com.todly.group.MemberRole;
import com.todly.routine.dto.RoutineDtos.CreateRoutineRequest;
import com.todly.routine.dto.RoutineDtos.RoutineActionDto;
import com.todly.routine.dto.RoutineDtos.RoutineDto;
import com.todly.routine.dto.RoutineDtos.StreakDto;
import com.todly.routine.dto.RoutineDtos.UpdateRoutineRequest;
import com.todly.task.Section;
import com.todly.task.SectionRepository;
import com.todly.task.Task;
import com.todly.task.TaskPriority;
import com.todly.task.TaskRepository;
import com.todly.task.TaskStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Routine business logic + materialization (PHASE 7, SCR-09 / FR-RTN).
 *
 * <p><b>recurRule / nextRunAt</b>: {@code timeOfDay} is folded into the stored
 * {@code recur_rule} JSON under the {@code "time"} key (there is no dedicated
 * column). {@link #computeNextRun} advances from a base date per frequency:
 * <ul>
 *   <li>daily → next day (or today if the time hasn't passed) at {@code time}</li>
 *   <li>weekly → next date matching {@code byweekday} (ISO 1=Mon..7=Sun); falls
 *       back to +7 days when no byweekday is given</li>
 *   <li>monthly → {@code bymonthday} (clamped to month length), else same
 *       day-of-month next month</li>
 *   <li>custom → treated like weekly when {@code byweekday} present, else daily</li>
 * </ul>
 * Times use UTC for determinism (server-side scheduling).
 *
 * <p><b>Streak rule</b>: {@code current} = the number of consecutive calendar
 * days, ending today, that have a non-skipped log. A {@code skip} writes a log
 * with {@code skipped=true} which does NOT count as done and therefore BREAKS
 * the streak (no done log that day). {@code best} is the max current ever seen.
 */
@Service
public class RoutineService {

    private static final Logger log = LoggerFactory.getLogger(RoutineService.class);
    private static final ZoneOffset ZONE = ZoneOffset.UTC;

    private final RoutineRepository routineRepository;
    private final RoutineLogRepository logRepository;
    private final RoutineStreakRepository streakRepository;
    private final TaskRepository taskRepository;
    private final SectionRepository sectionRepository;
    private final GroupMemberRepository memberRepository;
    private final GroupAccessService access;
    private final ActivityService activityService;
    private final ObjectMapper objectMapper;
    private final com.todly.gamification.ScoreService scoreService;

    public RoutineService(RoutineRepository routineRepository,
                          RoutineLogRepository logRepository,
                          RoutineStreakRepository streakRepository,
                          TaskRepository taskRepository,
                          SectionRepository sectionRepository,
                          GroupMemberRepository memberRepository,
                          GroupAccessService access,
                          ActivityService activityService,
                          ObjectMapper objectMapper,
                          com.todly.gamification.ScoreService scoreService) {
        this.routineRepository = routineRepository;
        this.logRepository = logRepository;
        this.streakRepository = streakRepository;
        this.taskRepository = taskRepository;
        this.sectionRepository = sectionRepository;
        this.memberRepository = memberRepository;
        this.access = access;
        this.activityService = activityService;
        this.objectMapper = objectMapper;
        this.scoreService = scoreService;
    }

    // --- queries ----------------------------------------------------------

    @Transactional(readOnly = true)
    public List<RoutineDto> myRoutines(UUID userId) {
        List<Routine> routines = routineRepository.findMine(userId);
        List<RoutineDto> out = new ArrayList<>(routines.size());
        LocalDate today = LocalDate.now(ZONE);
        for (Routine r : routines) {
            out.add(toDto(r, userId, today));
        }
        return out;
    }

    // --- create / update / delete ----------------------------------------

    @Transactional
    public RoutineDto create(UUID userId, CreateRoutineRequest req) {
        if (req.groupId() != null) {
            access.requireMember(req.groupId(), userId);
        }
        Routine r = new Routine();
        r.setGroupId(req.groupId());
        r.setCreatorId(userId);
        r.setTitle(req.title().trim());
        if (req.sectionId() != null) {
            Section s = sectionRepository.findById(req.sectionId())
                .orElseThrow(() -> ApiException.notFound("Section not found"));
            if (req.groupId() == null || !s.getGroupId().equals(req.groupId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                    "Section does not belong to the group");
            }
            r.setSectionId(s.getId());
        }
        r.setRecurFreq(req.recurFreq());
        r.setRecurRule(buildRule(req.recurRule(), req.timeOfDay()));
        r.setActive(true);
        r.setNextRunAt(computeNextRun(r, OffsetDateTime.now(ZONE)));
        routineRepository.save(r);
        return toDto(r, userId, LocalDate.now(ZONE));
    }

    @Transactional
    public RoutineDto update(UUID id, UUID userId, UpdateRoutineRequest req) {
        Routine r = requireRoutineForEdit(id, userId);
        if (req.title() != null) {
            r.setTitle(req.title().trim());
        }
        if (req.sectionId() != null) {
            Section s = sectionRepository.findById(req.sectionId())
                .orElseThrow(() -> ApiException.notFound("Section not found"));
            if (r.getGroupId() == null || !s.getGroupId().equals(r.getGroupId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                    "Section does not belong to the group");
            }
            r.setSectionId(s.getId());
        }
        boolean scheduleChanged = false;
        if (req.recurFreq() != null) {
            r.setRecurFreq(req.recurFreq());
            scheduleChanged = true;
        }
        if (req.recurRule() != null || req.timeOfDay() != null) {
            JsonNode baseRule = req.recurRule() != null ? req.recurRule() : parse(r.getRecurRule());
            LocalTime time = req.timeOfDay() != null ? req.timeOfDay() : existingTime(r);
            r.setRecurRule(buildRule(baseRule, time));
            scheduleChanged = true;
        }
        if (scheduleChanged) {
            r.setNextRunAt(computeNextRun(r, OffsetDateTime.now(ZONE)));
        }
        routineRepository.save(r);
        return toDto(r, userId, LocalDate.now(ZONE));
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        Routine r = requireRoutineForEdit(id, userId);
        routineRepository.delete(r);
    }

    @Transactional
    public RoutineDto toggle(UUID id, UUID userId) {
        Routine r = requireRoutineForEdit(id, userId);
        r.setActive(!r.isActive());
        if (r.isActive() && r.getNextRunAt() == null) {
            r.setNextRunAt(computeNextRun(r, OffsetDateTime.now(ZONE)));
        }
        routineRepository.save(r);
        return toDto(r, userId, LocalDate.now(ZONE));
    }

    // --- complete / skip --------------------------------------------------

    @Transactional
    public RoutineActionDto complete(UUID id, UUID userId) {
        Routine r = requireRoutineMember(id, userId);
        LocalDate today = LocalDate.now(ZONE);
        // newlyDone == this is the first non-skipped completion for today, so we
        // only bump the heatmap/score once per routine per day (idempotent complete).
        boolean newlyDone = upsertLog(r.getId(), userId, today, false);
        StreakDto streak = recomputeStreak(r.getId());
        if (r.getGroupId() != null) {
            activityService.record(r.getGroupId(), userId, ActivityType.routine_done, null,
                "{\"routineId\":\"" + r.getId() + "\",\"streak\":" + streak.current() + "}");
        }
        if (newlyDone) {
            scoreService.onRoutineCompleted(userId);
        } else {
            // Streak may still have changed (back-filled days); refresh score totals.
            scoreService.recompute(userId);
        }
        return new RoutineActionDto(streak, true);
    }

    @Transactional
    public RoutineActionDto skip(UUID id, UUID userId) {
        Routine r = requireRoutineMember(id, userId);
        LocalDate today = LocalDate.now(ZONE);
        upsertLog(r.getId(), userId, today, true);
        // A skip is not a done day → it breaks the streak.
        StreakDto streak = recomputeStreak(r.getId());
        return new RoutineActionDto(streak, false);
    }

    // --- materialization (scheduler-driven, TESTABLE) ---------------------

    /**
     * Create today's Task instance for every active routine whose nextRunAt is due,
     * then advance nextRunAt to the next occurrence. Idempotent per (routine, day):
     * skips if a non-deleted task already exists for that routine on that due date.
     * Returns the number of task instances created.
     */
    @Transactional
    public int materializeDue(Instant now) {
        OffsetDateTime nowOdt = now.atOffset(ZONE);
        List<Routine> due = routineRepository.findDue(nowOdt);
        int created = 0;
        for (Routine r : due) {
            LocalDate dueDate = nowOdt.toLocalDate();
            if (taskRepository.countRoutineInstances(r.getId(), dueDate) == 0) {
                Task t = new Task();
                if (r.getGroupId() != null) {
                    Group g = access.requireGroup(r.getGroupId());
                    t.setGroup(g);
                    if (r.getSectionId() != null) {
                        t.setSectionId(r.getSectionId());
                    }
                }
                t.setRoutineId(r.getId());
                t.setCreatorId(r.getCreatorId());
                t.setTitle(r.getTitle());
                t.setStatus(TaskStatus.todo);
                t.setPriority(TaskPriority.none);
                t.setDueDate(dueDate);
                taskRepository.save(t);
                created++;
            }
            // Advance to the next occurrence strictly after now.
            r.setNextRunAt(computeNextRun(r, nowOdt));
            routineRepository.save(r);
        }
        return created;
    }

    // --- recurrence -------------------------------------------------------

    /** Compute the next run instant strictly after {@code from} per the routine's rule. */
    OffsetDateTime computeNextRun(Routine r, OffsetDateTime from) {
        LocalTime time = timeOf(r);
        LocalDate base = from.toLocalDate();
        JsonNode rule = parse(r.getRecurRule());

        return switch (r.getRecurFreq()) {
            case daily -> at(nextDailyDate(base, from, time), time);
            case weekly -> at(nextWeekdayDate(base, from, time, byweekday(rule), 7), time);
            case monthly -> at(nextMonthlyDate(base, from, time, rule), time);
            case custom -> {
                Set<Integer> wd = byweekday(rule);
                if (!wd.isEmpty()) {
                    yield at(nextWeekdayDate(base, from, time, wd, 7), time);
                }
                yield at(nextDailyDate(base, from, time), time);
            }
        };
    }

    private LocalDate nextDailyDate(LocalDate base, OffsetDateTime from, LocalTime time) {
        // Today if its time is still in the future, else tomorrow.
        if (at(base, time).isAfter(from)) {
            return base;
        }
        return base.plusDays(1);
    }

    private LocalDate nextWeekdayDate(LocalDate base, OffsetDateTime from, LocalTime time,
                                      Set<Integer> byweekday, int fallbackDays) {
        if (byweekday.isEmpty()) {
            // No weekday set → repeat weekly from base.
            return at(base, time).isAfter(from) ? base : base.plusDays(fallbackDays);
        }
        for (int i = 0; i <= 7; i++) {
            LocalDate candidate = base.plusDays(i);
            int dow = candidate.getDayOfWeek().getValue(); // 1=Mon..7=Sun
            if (byweekday.contains(dow) && at(candidate, time).isAfter(from)) {
                return candidate;
            }
        }
        return base.plusDays(7);
    }

    private LocalDate nextMonthlyDate(LocalDate base, OffsetDateTime from, LocalTime time,
                                      JsonNode rule) {
        Integer monthday = null;
        if (rule != null && rule.has("bymonthday") && rule.get("bymonthday").isInt()) {
            monthday = rule.get("bymonthday").asInt();
        }
        int targetDay = monthday != null ? monthday : base.getDayOfMonth();
        LocalDate thisMonth = clampDay(base.getYear(), base.getMonthValue(), targetDay);
        if (at(thisMonth, time).isAfter(from)) {
            return thisMonth;
        }
        LocalDate nextMonth = base.plusMonths(1);
        return clampDay(nextMonth.getYear(), nextMonth.getMonthValue(), targetDay);
    }

    private LocalDate clampDay(int year, int month, int day) {
        LocalDate first = LocalDate.of(year, month, 1);
        int len = first.lengthOfMonth();
        return LocalDate.of(year, month, Math.min(day, len));
    }

    private OffsetDateTime at(LocalDate date, LocalTime time) {
        return OffsetDateTime.of(date, time, ZONE);
    }

    private Set<Integer> byweekday(JsonNode rule) {
        Set<Integer> out = new HashSet<>();
        if (rule != null && rule.has("byweekday") && rule.get("byweekday").isArray()) {
            for (JsonNode n : rule.get("byweekday")) {
                if (n.isInt()) {
                    out.add(n.asInt());
                }
            }
        }
        return out;
    }

    // --- streak -----------------------------------------------------------

    /**
     * Recompute current + best streak from the routine's non-skipped done dates.
     * current = consecutive days ending today (or yesterday if today not yet done);
     * best = max(stored best, current, longest historical run).
     */
    private StreakDto recomputeStreak(UUID routineId) {
        List<LocalDate> doneDates = logRepository.findDoneDatesDesc(routineId);
        Set<LocalDate> done = new HashSet<>(doneDates);
        LocalDate today = LocalDate.now(ZONE);

        int current = 0;
        // Anchor the current run at today if done today, else at yesterday so a
        // streak isn't "broken" merely because today's instance isn't done yet.
        LocalDate anchor = done.contains(today) ? today : today.minusDays(1);
        LocalDate cursor = anchor;
        while (done.contains(cursor)) {
            current++;
            cursor = cursor.minusDays(1);
        }

        // Longest historical run across all done dates.
        int longest = 0;
        int run = 0;
        LocalDate prev = null;
        // doneDates is desc; iterate ascending for run counting.
        List<LocalDate> asc = new ArrayList<>(doneDates);
        java.util.Collections.sort(asc);
        for (LocalDate d : asc) {
            if (prev != null && d.equals(prev.plusDays(1))) {
                run++;
            } else {
                run = 1;
            }
            longest = Math.max(longest, run);
            prev = d;
        }

        RoutineStreak streak = streakRepository.findById(routineId).orElseGet(() -> {
            RoutineStreak s = new RoutineStreak();
            s.setRoutineId(routineId);
            return s;
        });
        int best = Math.max(Math.max(streak.getBestStreak(), current), longest);
        streak.setCurrentStreak(current);
        streak.setBestStreak(best);
        streakRepository.save(streak);
        return new StreakDto(current, best);
    }

    // --- helpers ----------------------------------------------------------

    /**
     * Upsert today's routine log. Returns true when this results in a NEW
     * non-skipped completion (fresh row, or a skipped row flipped to done) — used
     * so the heatmap/score is bumped exactly once per routine per day.
     */
    private boolean upsertLog(UUID routineId, UUID userId, LocalDate day, boolean skipped) {
        RoutineLog existing = logRepository
            .findByRoutineIdAndUserIdAndDoneOn(routineId, userId, day).orElse(null);
        if (existing != null) {
            boolean newlyDone = !skipped && existing.isSkipped();
            existing.setSkipped(skipped);
            logRepository.save(existing);
            return newlyDone;
        }
        RoutineLog logRow = new RoutineLog();
        logRow.setRoutineId(routineId);
        logRow.setUserId(userId);
        logRow.setDoneOn(day);
        logRow.setSkipped(skipped);
        logRepository.save(logRow);
        return !skipped;
    }

    private Routine requireRoutine(UUID id) {
        return routineRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Routine not found"));
    }

    /** Member of the routine's group (or the creator for personal routines). */
    private Routine requireRoutineMember(UUID id, UUID userId) {
        Routine r = requireRoutine(id);
        if (r.getGroupId() != null) {
            access.requireMember(r.getGroupId(), userId);
        } else if (!r.getCreatorId().equals(userId)) {
            throw GroupAccessService.forbidden("Not your routine");
        }
        return r;
    }

    /** Creator, or a group owner/admin, may edit/delete. */
    private Routine requireRoutineForEdit(UUID id, UUID userId) {
        Routine r = requireRoutine(id);
        if (r.getCreatorId().equals(userId)) {
            return r;
        }
        if (r.getGroupId() != null) {
            GroupMember m = access.requireMember(r.getGroupId(), userId);
            if (m.getRole() != MemberRole.member) {
                return r; // owner/admin
            }
        }
        throw GroupAccessService.forbidden(
            "Only the routine creator or a group owner/admin may modify it");
    }

    private RoutineDto toDto(Routine r, UUID userId, LocalDate today) {
        StreakDto streak = streakRepository.findById(r.getId())
            .map(s -> new StreakDto(s.getCurrentStreak(), s.getBestStreak()))
            .orElse(new StreakDto(0, 0));
        RoutineLog todayLog = logRepository
            .findByRoutineIdAndUserIdAndDoneOn(r.getId(), userId, today).orElse(null);
        boolean todayDone = todayLog != null && !todayLog.isSkipped();
        return new RoutineDto(
            r.getId(), r.getGroupId(), r.getSectionId(), r.getTitle(),
            r.getRecurFreq(), userRule(r), timeOf(r), r.getNextRunAt(), r.isActive(),
            streak, todayDone, todayInstanceId(r, today));
    }

    private UUID todayInstanceId(Routine r, LocalDate today) {
        return taskRepository.findRoutineInstanceId(r.getId(), today).orElse(null);
    }

    // --- recur_rule JSON marshalling --------------------------------------

    /** Merge the caller's rule with the {@code time} key (timeOfDay). */
    private String buildRule(JsonNode rule, LocalTime time) {
        ObjectNode node = (rule != null && rule.isObject())
            ? ((ObjectNode) rule).deepCopy()
            : objectMapper.createObjectNode();
        if (time != null) {
            node.put("time", time.toString());
        }
        return node.toString();
    }

    /** The stored rule WITHOUT injecting time (returned to clients as-is). */
    private JsonNode userRule(Routine r) {
        return parse(r.getRecurRule());
    }

    private LocalTime timeOf(Routine r) {
        LocalTime t = existingTime(r);
        return t != null ? t : LocalTime.of(9, 0); // default 09:00
    }

    private LocalTime existingTime(Routine r) {
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
