package com.todly.gamification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_stats")
public class UserStats {

    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Column(name = "life_score", nullable = false)
    private int lifeScore = 0;

    @Column(name = "routine_score", nullable = false)
    private int routineScore = 0;

    @Column(name = "completion_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal completionRate = BigDecimal.ZERO;

    @Column(name = "current_streak", nullable = false)
    private int currentStreak = 0;

    @Column(name = "best_streak", nullable = false)
    private int bestStreak = 0;

    @Column(name = "yearly_count", nullable = false)
    private int yearlyCount = 0;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public int getLifeScore() { return lifeScore; }
    public void setLifeScore(int lifeScore) { this.lifeScore = lifeScore; }

    public int getRoutineScore() { return routineScore; }
    public void setRoutineScore(int routineScore) { this.routineScore = routineScore; }

    public BigDecimal getCompletionRate() { return completionRate; }
    public void setCompletionRate(BigDecimal completionRate) { this.completionRate = completionRate; }

    public int getCurrentStreak() { return currentStreak; }
    public void setCurrentStreak(int currentStreak) { this.currentStreak = currentStreak; }

    public int getBestStreak() { return bestStreak; }
    public void setBestStreak(int bestStreak) { this.bestStreak = bestStreak; }

    public int getYearlyCount() { return yearlyCount; }
    public void setYearlyCount(int yearlyCount) { this.yearlyCount = yearlyCount; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
