package com.todly.task;

import com.todly.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TaskAssigneeRepository extends JpaRepository<TaskAssignee, TaskAssigneeId> {

    /** Assignee users for a single task. */
    @Query("""
            select u from TaskAssignee a, User u
            where a.id.taskId = :taskId and a.id.userId = u.id
            order by a.assignedAt asc
            """)
    List<User> findAssigneeUsers(@Param("taskId") UUID taskId);

    /** (taskId, user) pairs for several tasks (for batch hydration). */
    @Query("""
            select a.id.taskId, u from TaskAssignee a, User u
            where a.id.taskId in :taskIds and a.id.userId = u.id
            order by a.assignedAt asc
            """)
    List<Object[]> findAssigneeUsersForTasks(@Param("taskIds") List<UUID> taskIds);

    /** Just the assignee user ids for a task (for notification fan-out). */
    @Query("select a.id.userId from TaskAssignee a where a.id.taskId = :taskId")
    List<UUID> findAssigneeIds(@Param("taskId") UUID taskId);
}
