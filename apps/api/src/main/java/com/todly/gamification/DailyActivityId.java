package com.todly.gamification;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class DailyActivityId implements Serializable {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "day", nullable = false)
    private LocalDate day;

    public DailyActivityId() {
    }

    public DailyActivityId(UUID userId, LocalDate day) {
        this.userId = userId;
        this.day = day;
    }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public LocalDate getDay() { return day; }
    public void setDay(LocalDate day) { this.day = day; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof DailyActivityId that)) return false;
        return Objects.equals(userId, that.userId) && Objects.equals(day, that.day);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, day);
    }
}
