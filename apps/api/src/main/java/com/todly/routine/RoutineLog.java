package com.todly.routine;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "routine_logs",
        uniqueConstraints = @UniqueConstraint(columnNames = {"routine_id", "user_id", "done_on"}))
public class RoutineLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "routine_id", nullable = false)
    private UUID routineId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "done_on", nullable = false)
    private LocalDate doneOn;

    @Column(name = "skipped", nullable = false)
    private boolean skipped = false;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getRoutineId() { return routineId; }
    public void setRoutineId(UUID routineId) { this.routineId = routineId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public LocalDate getDoneOn() { return doneOn; }
    public void setDoneOn(LocalDate doneOn) { this.doneOn = doneOn; }

    public boolean isSkipped() { return skipped; }
    public void setSkipped(boolean skipped) { this.skipped = skipped; }
}
