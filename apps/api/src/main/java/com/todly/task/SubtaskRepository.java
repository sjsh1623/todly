package com.todly.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SubtaskRepository extends JpaRepository<Subtask, UUID> {

    /** Subtasks of a task ordered by position. */
    @Query("""
            select s from Subtask s
            where s.taskId = :taskId
            order by s.position asc
            """)
    List<Subtask> findByTaskId(@Param("taskId") UUID taskId);

    /** Subtasks of several tasks (for batch hydration). */
    @Query("""
            select s from Subtask s
            where s.taskId in :taskIds
            order by s.position asc
            """)
    List<Subtask> findByTaskIds(@Param("taskIds") List<UUID> taskIds);
}
