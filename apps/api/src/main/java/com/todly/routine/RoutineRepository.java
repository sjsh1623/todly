package com.todly.routine;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface RoutineRepository extends JpaRepository<Routine, UUID> {

    /**
     * My routines: created by me OR belonging to a group I'm a member of.
     * Newest first.
     */
    @Query("""
            select r from Routine r
            where r.creatorId = :userId
               or (r.groupId is not null and exists (
                       select 1 from GroupMember m
                       where m.group.id = r.groupId and m.user.id = :userId
                            and m.group.deletedAt is null))
            order by r.createdAt desc
            """)
    List<Routine> findMine(@Param("userId") UUID userId);

    /** Active routines whose next run is due (nextRunAt <= now). */
    @Query("""
            select r from Routine r
            where r.isActive = true and r.nextRunAt is not null and r.nextRunAt <= :now
            """)
    List<Routine> findDue(@Param("now") OffsetDateTime now);
}
