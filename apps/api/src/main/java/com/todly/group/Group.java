package com.todly.group;

import com.todly.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "groups")
public class Group extends BaseEntity {

    @Column(name = "name", nullable = false, length = 60)
    private String name;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, columnDefinition = "group_type")
    private GroupType type = GroupType.group;

    @Column(name = "color", nullable = false, length = 20)
    private String color = "blue";

    @Column(name = "icon", length = 40)
    private String icon;

    @Column(name = "description")
    private String description;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public GroupType getType() { return type; }
    public void setType(GroupType type) { this.type = type; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
