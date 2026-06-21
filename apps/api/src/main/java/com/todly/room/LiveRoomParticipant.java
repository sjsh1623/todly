package com.todly.room;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "live_room_participants")
public class LiveRoomParticipant {

    @EmbeddedId
    private LiveRoomParticipantId id;

    @Column(name = "is_host", nullable = false)
    private boolean isHost = false;

    @CreationTimestamp
    @Column(name = "joined_at", updatable = false, nullable = false)
    private OffsetDateTime joinedAt;

    @Column(name = "left_at")
    private OffsetDateTime leftAt;

    public LiveRoomParticipantId getId() { return id; }
    public void setId(LiveRoomParticipantId id) { this.id = id; }

    public boolean isHost() { return isHost; }
    public void setHost(boolean host) { isHost = host; }

    public OffsetDateTime getJoinedAt() { return joinedAt; }

    public OffsetDateTime getLeftAt() { return leftAt; }
    public void setLeftAt(OffsetDateTime leftAt) { this.leftAt = leftAt; }
}
