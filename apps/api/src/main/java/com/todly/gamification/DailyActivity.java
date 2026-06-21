package com.todly.gamification;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "daily_activity")
public class DailyActivity {

    @EmbeddedId
    private DailyActivityId id;

    @Column(name = "count", nullable = false)
    private int count = 0;

    public DailyActivityId getId() { return id; }
    public void setId(DailyActivityId id) { this.id = id; }

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }
}
