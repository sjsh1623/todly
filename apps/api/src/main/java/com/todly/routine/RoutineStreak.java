package com.todly.routine;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "routine_streaks")
public class RoutineStreak {

    @Id
    @Column(name = "routine_id", updatable = false, nullable = false)
    private UUID routineId;

    @Column(name = "current_streak", nullable = false)
    private int currentStreak = 0;

    @Column(name = "best_streak", nullable = false)
    private int bestStreak = 0;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getRoutineId() { return routineId; }
    public void setRoutineId(UUID routineId) { this.routineId = routineId; }

    public int getCurrentStreak() { return currentStreak; }
    public void setCurrentStreak(int currentStreak) { this.currentStreak = currentStreak; }

    public int getBestStreak() { return bestStreak; }
    public void setBestStreak(int bestStreak) { this.bestStreak = bestStreak; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
