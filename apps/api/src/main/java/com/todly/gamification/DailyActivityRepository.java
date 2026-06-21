package com.todly.gamification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface DailyActivityRepository extends JpaRepository<DailyActivity, DailyActivityId> {

    /** Sum of activity counts for a user within [from, to] (inclusive) — e.g. a calendar year. */
    @Query("""
            select coalesce(sum(d.count), 0) from DailyActivity d
            where d.id.userId = :userId and d.id.day >= :from and d.id.day <= :to
            """)
    long sumCountBetween(@Param("userId") UUID userId,
                         @Param("from") LocalDate from,
                         @Param("to") LocalDate to);

    /** Rows (day, count) for a user within [from, to], oldest first — for the heatmap. */
    @Query("""
            select d from DailyActivity d
            where d.id.userId = :userId and d.id.day >= :from and d.id.day <= :to
            order by d.id.day asc
            """)
    List<DailyActivity> findRange(@Param("userId") UUID userId,
                                  @Param("from") LocalDate from,
                                  @Param("to") LocalDate to);

    /** Distinct days with count > 0 for a user, newest first — for streak computation. */
    @Query("""
            select d.id.day from DailyActivity d
            where d.id.userId = :userId and d.count > 0
            order by d.id.day desc
            """)
    List<LocalDate> findActiveDaysDesc(@Param("userId") UUID userId);
}
