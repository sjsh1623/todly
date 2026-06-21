package com.todly.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "activities")
public class Activity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "group_id")
    private UUID groupId;

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, columnDefinition = "activity_type")
    private ActivityType type;

    @Column(name = "target_task_id")
    private UUID targetTaskId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "meta", columnDefinition = "jsonb")
    private String meta;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private OffsetDateTime createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getGroupId() { return groupId; }
    public void setGroupId(UUID groupId) { this.groupId = groupId; }

    public UUID getActorId() { return actorId; }
    public void setActorId(UUID actorId) { this.actorId = actorId; }

    public ActivityType getType() { return type; }
    public void setType(ActivityType type) { this.type = type; }

    public UUID getTargetTaskId() { return targetTaskId; }
    public void setTargetTaskId(UUID targetTaskId) { this.targetTaskId = targetTaskId; }

    public String getMeta() { return meta; }
    public void setMeta(String meta) { this.meta = meta; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
}
