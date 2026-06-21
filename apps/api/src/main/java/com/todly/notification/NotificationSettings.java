package com.todly.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "notification_settings")
public class NotificationSettings {

    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Column(name = "push_due", nullable = false)
    private boolean pushDue = true;

    @Column(name = "push_assigned", nullable = false)
    private boolean pushAssigned = true;

    @Column(name = "push_live", nullable = false)
    private boolean pushLive = true;

    @Column(name = "push_comment", nullable = false)
    private boolean pushComment = true;

    @Column(name = "quiet_from")
    private LocalTime quietFrom;

    @Column(name = "quiet_to")
    private LocalTime quietTo;

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public boolean isPushDue() { return pushDue; }
    public void setPushDue(boolean pushDue) { this.pushDue = pushDue; }

    public boolean isPushAssigned() { return pushAssigned; }
    public void setPushAssigned(boolean pushAssigned) { this.pushAssigned = pushAssigned; }

    public boolean isPushLive() { return pushLive; }
    public void setPushLive(boolean pushLive) { this.pushLive = pushLive; }

    public boolean isPushComment() { return pushComment; }
    public void setPushComment(boolean pushComment) { this.pushComment = pushComment; }

    public LocalTime getQuietFrom() { return quietFrom; }
    public void setQuietFrom(LocalTime quietFrom) { this.quietFrom = quietFrom; }

    public LocalTime getQuietTo() { return quietTo; }
    public void setQuietTo(LocalTime quietTo) { this.quietTo = quietTo; }
}
