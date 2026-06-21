package com.todly.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID> {

    /** Total non-soft-deleted tasks in a group. */
    @Query("select count(t) from Task t where t.group.id = :groupId and t.deletedAt is null")
    long countTotal(@Param("groupId") UUID groupId);

    /** Completed (done) non-soft-deleted tasks in a group. */
    @Query("""
            select count(t) from Task t
            where t.group.id = :groupId and t.deletedAt is null and t.status = :status
            """)
    long countByStatus(@Param("groupId") UUID groupId, @Param("status") TaskStatus status);

    /** All non-soft-deleted tasks in a group, ordered by position then createdAt. */
    @Query("""
            select t from Task t
            where t.group.id = :groupId and t.deletedAt is null
            order by t.position asc, t.createdAt asc
            """)
    List<Task> findGroupTasks(@Param("groupId") UUID groupId);

    /** A non-soft-deleted task by id (with group eagerly loaded for authz). */
    @Query("""
            select t from Task t left join fetch t.group g
            where t.id = :id and t.deletedAt is null
            """)
    Optional<Task> findActiveById(@Param("id") UUID id);

    /**
     * Tasks assigned to the user that need attention: across the user's
     * non-deleted groups, status != done, with a dueDate on or before today.
     * Ordered overdue-first then by dueDate ascending.
     */
    @Query("""
            select t from Task t
            join t.group g
            where t.deletedAt is null
              and g.deletedAt is null
              and t.status <> :done
              and t.dueDate is not null
              and t.dueDate <= :today
              and exists (
                  select 1 from TaskAssignee a
                  where a.id.taskId = t.id and a.id.userId = :userId
              )
              and exists (
                  select 1 from GroupMember m
                  where m.group.id = g.id and m.user.id = :userId
              )
            order by t.dueDate asc, t.createdAt asc
            """)
    List<Task> findNeedsAttention(@Param("userId") UUID userId,
                                  @Param("today") LocalDate today,
                                  @Param("done") TaskStatus done);

    /** (id, title) pairs for the given task ids — used to hydrate activity feed targets. */
    @Query("select t.id, t.title from Task t where t.id in :ids")
    List<Object[]> findTitles(@Param("ids") List<UUID> ids);

    // --- gamification (PHASE 9) -------------------------------------------

    /** Non-deleted tasks this user has completed (completedBy = user) — drives lifeScore. */
    @Query("""
            select count(t) from Task t
            where t.completedBy = :userId and t.deletedAt is null and t.status = :done
            """)
    long countCompletedByUser(@Param("userId") UUID userId, @Param("done") TaskStatus done);

    /** Total non-deleted tasks assigned to the user (across all groups) — completionRate denominator. */
    @Query("""
            select count(t) from Task t
            where t.deletedAt is null
              and exists (
                  select 1 from TaskAssignee a
                  where a.id.taskId = t.id and a.id.userId = :userId
              )
            """)
    long countAssignedToUser(@Param("userId") UUID userId);

    /** Done non-deleted tasks assigned to the user — completionRate numerator. */
    @Query("""
            select count(t) from Task t
            where t.deletedAt is null and t.status = :done
              and exists (
                  select 1 from TaskAssignee a
                  where a.id.taskId = t.id and a.id.userId = :userId
              )
            """)
    long countAssignedDoneToUser(@Param("userId") UUID userId, @Param("done") TaskStatus done);

    /**
     * Tasks assigned to anyone, not done, with a due date in [from, to]. Used by
     * the due/overdue scanner. Group is eagerly loaded for the notification link.
     */
    @Query("""
            select t from Task t
            join fetch t.group g
            where t.deletedAt is null
              and g.deletedAt is null
              and t.status <> :done
              and t.dueDate is not null
              and t.dueDate >= :from and t.dueDate <= :to
            """)
    List<Task> findDueBetween(@Param("from") LocalDate from,
                              @Param("to") LocalDate to,
                              @Param("done") TaskStatus done);

    /**
     * Tasks created by a routine instance for a given routine on a given due date
     * (dedupe guard for the materializer). Soft-deleted rows excluded.
     */
    @Query("""
            select count(t) from Task t
            where t.routineId = :routineId and t.dueDate = :dueDate and t.deletedAt is null
            """)
    long countRoutineInstances(@Param("routineId") UUID routineId,
                               @Param("dueDate") LocalDate dueDate);

    /** The task id of a routine's instance for a given due date, if any. */
    @Query("""
            select t.id from Task t
            where t.routineId = :routineId and t.dueDate = :dueDate and t.deletedAt is null
            order by t.createdAt asc
            """)
    java.util.Optional<UUID> findRoutineInstanceId(@Param("routineId") UUID routineId,
                                                   @Param("dueDate") LocalDate dueDate);
}
