package com.todly.routine;

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
@Table(name = "routines")
public class Routine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "group_id")
    private UUID groupId;

    @Column(name = "creator_id", nullable = false)
    private UUID creatorId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "section_id")
    private UUID sectionId;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    @Column(name = "recur_freq", nullable = false, columnDefinition = "recur_freq")
    private RecurFreq recurFreq;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recur_rule", columnDefinition = "jsonb")
    private String recurRule;

    @Column(name = "next_run_at")
    private OffsetDateTime nextRunAt;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private OffsetDateTime createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getGroupId() { return groupId; }
    public void setGroupId(UUID groupId) { this.groupId = groupId; }

    public UUID getCreatorId() { return creatorId; }
    public void setCreatorId(UUID creatorId) { this.creatorId = creatorId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public UUID getSectionId() { return sectionId; }
    public void setSectionId(UUID sectionId) { this.sectionId = sectionId; }

    public RecurFreq getRecurFreq() { return recurFreq; }
    public void setRecurFreq(RecurFreq recurFreq) { this.recurFreq = recurFreq; }

    public String getRecurRule() { return recurRule; }
    public void setRecurRule(String recurRule) { this.recurRule = recurRule; }

    public OffsetDateTime getNextRunAt() { return nextRunAt; }
    public void setNextRunAt(OffsetDateTime nextRunAt) { this.nextRunAt = nextRunAt; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
}
