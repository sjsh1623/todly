package com.todly.photo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "photos")
public class Photo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "uploader_id", nullable = false)
    private UUID uploaderId;

    @Column(name = "task_id")
    private UUID taskId;

    @Column(name = "room_id")
    private UUID roomId;

    @Column(name = "url", nullable = false)
    private String url;

    @Column(name = "thumb_url")
    private String thumbUrl;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "bytes")
    private Integer bytes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private OffsetDateTime createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUploaderId() { return uploaderId; }
    public void setUploaderId(UUID uploaderId) { this.uploaderId = uploaderId; }

    public UUID getTaskId() { return taskId; }
    public void setTaskId(UUID taskId) { this.taskId = taskId; }

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getThumbUrl() { return thumbUrl; }
    public void setThumbUrl(String thumbUrl) { this.thumbUrl = thumbUrl; }

    public Integer getWidth() { return width; }
    public void setWidth(Integer width) { this.width = width; }

    public Integer getHeight() { return height; }
    public void setHeight(Integer height) { this.height = height; }

    public Integer getBytes() { return bytes; }
    public void setBytes(Integer bytes) { this.bytes = bytes; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
}
