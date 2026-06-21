package com.todly.task;

import com.todly.common.BaseEntity;
import com.todly.group.Group;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "tasks")
public class Task extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private Group group;

    @Column(name = "section_id")
    private UUID sectionId;

    @Column(name = "routine_id")
    private UUID routineId;

    @Column(name = "creator_id", nullable = false)
    private UUID creatorId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "note")
    private String note;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "task_status")
    private TaskStatus status = TaskStatus.todo;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, columnDefinition = "task_priority")
    private TaskPriority priority = TaskPriority.none;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "due_at")
    private OffsetDateTime dueAt;

    @Column(name = "position", nullable = false)
    private int position = 0;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "completed_by")
    private UUID completedBy;

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public UUID getSectionId() { return sectionId; }
    public void setSectionId(UUID sectionId) { this.sectionId = sectionId; }

    public UUID getRoutineId() { return routineId; }
    public void setRoutineId(UUID routineId) { this.routineId = routineId; }

    public UUID getCreatorId() { return creatorId; }
    public void setCreatorId(UUID creatorId) { this.creatorId = creatorId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }

    public TaskPriority getPriority() { return priority; }
    public void setPriority(TaskPriority priority) { this.priority = priority; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public OffsetDateTime getDueAt() { return dueAt; }
    public void setDueAt(OffsetDateTime dueAt) { this.dueAt = dueAt; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }

    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }

    public UUID getCompletedBy() { return completedBy; }
    public void setCompletedBy(UUID completedBy) { this.completedBy = completedBy; }

    public int getVersion() { return version; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
