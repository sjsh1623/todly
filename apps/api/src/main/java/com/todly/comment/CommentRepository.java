package com.todly.comment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    /** Non-deleted comments for a task, oldest first (for task detail). */
    @Query("""
            select c from Comment c
            where c.taskId = :taskId and c.deletedAt is null
            order by c.createdAt asc, c.id asc
            """)
    List<Comment> findActiveByTask(@Param("taskId") UUID taskId);
}
