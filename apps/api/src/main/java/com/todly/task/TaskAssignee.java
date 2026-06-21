package com.todly.task;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "task_assignees")
public class TaskAssignee {

    @EmbeddedId
    private TaskAssigneeId id;

    @CreationTimestamp
    @Column(name = "assigned_at", updatable = false, nullable = false)
    private OffsetDateTime assignedAt;

    public TaskAssigneeId getId() { return id; }
    public void setId(TaskAssigneeId id) { this.id = id; }

    public OffsetDateTime getAssignedAt() { return assignedAt; }
}
