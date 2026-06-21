package com.todly.routine;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoutineLogRepository extends JpaRepository<RoutineLog, UUID> {

    Optional<RoutineLog> findByRoutineIdAndUserIdAndDoneOn(UUID routineId, UUID userId, LocalDate doneOn);

    /** Distinct done-on dates (not skipped) for a routine, newest first — for streak calc. */
    @Query("""
            select distinct l.doneOn from RoutineLog l
            where l.routineId = :routineId and l.skipped = false
            order by l.doneOn desc
            """)
    List<LocalDate> findDoneDatesDesc(@Param("routineId") UUID routineId);

    // --- gamification (PHASE 9) -------------------------------------------

    /** Total non-skipped routine completions by a user — drives routineScore. */
    @Query("""
            select count(l) from RoutineLog l
            where l.userId = :userId and l.skipped = false
            """)
    long countDoneByUser(@Param("userId") UUID userId);

    /**
     * Distinct done-on dates (not skipped) by a user for a routine, oldest first
     * — for a single routine's grass/heatmap (SCR-13 / per-task consistency).
     */
    @Query("""
            select distinct l.doneOn from RoutineLog l
            where l.routineId = :routineId and l.userId = :userId and l.skipped = false
            order by l.doneOn asc
            """)
    List<LocalDate> findDoneDatesAscForUser(@Param("routineId") UUID routineId,
                                            @Param("userId") UUID userId);

    /** Distinct done-on dates (not skipped) for a routine (any user), oldest first. */
    @Query("""
            select distinct l.doneOn from RoutineLog l
            where l.routineId = :routineId and l.skipped = false
            order by l.doneOn asc
            """)
    List<LocalDate> findDoneDatesAsc(@Param("routineId") UUID routineId);
}
