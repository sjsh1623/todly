package com.todly.room;

import com.todly.common.ApiException;
import com.todly.group.GroupAccessService;
import com.todly.live.LiveService;
import com.todly.photo.Photo;
import com.todly.photo.PhotoRepository;
import com.todly.realtime.RealtimeEventPublisher;
import com.todly.room.dto.LiveRoomDtos.MembershipPayload;
import com.todly.room.dto.LiveRoomDtos.MessageDto;
import com.todly.room.dto.LiveRoomDtos.ParticipantDto;
import com.todly.room.dto.LiveRoomDtos.ParticipantsPayload;
import com.todly.room.dto.LiveRoomDtos.PhotoDto;
import com.todly.room.dto.LiveRoomDtos.RoomDetailDto;
import com.todly.room.dto.LiveRoomDtos.RoomDto;
import com.todly.room.dto.LiveRoomDtos.RoomEndedPayload;
import com.todly.room.dto.LiveRoomDtos.RoomListItem;
import com.todly.room.dto.LiveRoomDtos.RoomStartedPayload;
import com.todly.room.dto.LiveRoomDtos.UserRef;
import com.todly.storage.LocalFileStorage;
import com.todly.storage.StorageService;
import com.todly.task.Task;
import com.todly.task.TaskRepository;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Live-room lifecycle (PHASE 6 / SCR-07). Mirrors the PHASE 5 realtime design:
 * all fan-out goes through {@link RealtimeEventPublisher} (Redis single-path);
 * this service never touches {@code SimpMessagingTemplate}.
 *
 * <p>Room-scoped events ({@code room.joined|left|participants|message|photo|ended})
 * fan out to {@code /topic/rooms/{id}}; {@code room.started} additionally fans out
 * to the task's {@code /topic/groups/{groupId}} so members see the room open.
 */
@Service
public class LiveRoomService {

    /** Hard cap on concurrent active participants (IMP-22). */
    public static final int MAX_PARTICIPANTS = 12;

    /** Max accepted upload size (10 MB). */
    public static final long MAX_PHOTO_BYTES = 10L * 1024 * 1024;

    private final LiveRoomRepository roomRepository;
    private final LiveRoomParticipantRepository participantRepository;
    private final LiveRoomMessageRepository messageRepository;
    private final PhotoRepository photoRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final GroupAccessService access;
    private final com.todly.group.GroupMemberRepository groupMemberRepository;
    private final LiveService liveService;
    private final RealtimeEventPublisher realtime;
    private final StorageService storage;
    private final com.todly.activity.ActivityService activityService;
    private final com.todly.storage.ImageThumbnailer thumbnailer;

    public LiveRoomService(LiveRoomRepository roomRepository,
                           LiveRoomParticipantRepository participantRepository,
                           LiveRoomMessageRepository messageRepository,
                           PhotoRepository photoRepository,
                           TaskRepository taskRepository,
                           UserRepository userRepository,
                           GroupAccessService access,
                           com.todly.group.GroupMemberRepository groupMemberRepository,
                           LiveService liveService,
                           RealtimeEventPublisher realtime,
                           StorageService storage,
                           com.todly.activity.ActivityService activityService,
                           com.todly.storage.ImageThumbnailer thumbnailer) {
        this.roomRepository = roomRepository;
        this.participantRepository = participantRepository;
        this.messageRepository = messageRepository;
        this.photoRepository = photoRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.access = access;
        this.groupMemberRepository = groupMemberRepository;
        this.liveService = liveService;
        this.realtime = realtime;
        this.storage = storage;
        this.activityService = activityService;
        this.thumbnailer = thumbnailer;
    }

    // --- create / join ----------------------------------------------------

    /** Idempotent host-or-join for a task: open the live room or join the existing one. */
    @Transactional
    public RoomDto createOrJoin(UUID taskId, UUID userId) {
        Task task = requireGroupTaskMember(taskId, userId);
        UUID groupId = task.getGroup().getId();

        Optional<LiveRoom> existing = roomRepository.findLiveByTask(taskId, RoomStatus.live);
        if (existing.isPresent()) {
            // A live room already exists: join it (idempotent).
            return joinInternal(existing.get(), userId);
        }

        LiveRoom room = new LiveRoom();
        room.setTaskId(taskId);
        room.setRoutineId(task.getRoutineId());
        room.setHostId(userId);
        room.setTitle(task.getTitle());
        room.setStatus(RoomStatus.live);
        room.setStartedAt(OffsetDateTime.now());
        roomRepository.saveAndFlush(room);

        addOrReactivate(room.getId(), userId, true);

        // Tie-in: ensure my live session for the task is running so it shows in_progress.
        try {
            liveService.start(taskId, userId);
        } catch (RuntimeException ex) {
            // Live session start is best-effort; the room is the source of truth here.
        }

        User host = requireUser(userId);
        realtime.publish("room.started", groupId,
            new RoomStartedPayload(room.getId(), taskId, groupId, room.getTitle(), userRef(host)));
        broadcastParticipants(room.getId());
        return toRoomDto(room);
    }

    @Transactional
    public RoomDto join(UUID roomId, UUID userId) {
        LiveRoom room = requireRoom(roomId);
        requireGroupMemberForRoom(room, userId);
        return joinInternal(room, userId);
    }

    private RoomDto joinInternal(LiveRoom room, UUID userId) {
        if (room.getStatus() == RoomStatus.ended) {
            throw new ApiException(HttpStatus.GONE, "ROOM_ENDED", "This live room has ended");
        }
        boolean alreadyActive = participantRepository.isActiveParticipant(room.getId(), userId);
        if (!alreadyActive) {
            long active = participantRepository.countActiveByRoom(room.getId());
            if (active >= MAX_PARTICIPANTS) {
                throw new ApiException(HttpStatus.CONFLICT, "ROOM_FULL",
                    "This live room is full (max " + MAX_PARTICIPANTS + ")");
            }
            boolean isHost = room.getHostId().equals(userId);
            addOrReactivate(room.getId(), userId, isHost);
            User user = requireUser(userId);
            realtime.publishRoom("room.joined", room.getId(),
                new MembershipPayload(room.getId(), userRef(user),
                    (int) participantRepository.countActiveByRoom(room.getId())));
            broadcastParticipants(room.getId());

            // Feed: a member joined this live room (only for non-host joins).
            if (!isHost) {
                UUID groupId = groupIdForRoom(room);
                if (groupId != null) {
                    activityService.record(groupId, userId,
                        com.todly.activity.ActivityType.friend_joined_room,
                        room.getTaskId(),
                        "{\"roomId\":\"" + room.getId() + "\"}");
                }
            }
        }
        return toRoomDto(room);
    }

    // --- leave / end ------------------------------------------------------

    @Transactional
    public void leave(UUID roomId, UUID userId) {
        LiveRoom room = requireRoom(roomId);
        LiveRoomParticipant p = participantRepository
            .findById(new LiveRoomParticipantId(roomId, userId)).orElse(null);
        if (p == null || p.getLeftAt() != null) {
            return; // not an active participant; idempotent no-op
        }
        p.setLeftAt(OffsetDateTime.now());
        participantRepository.saveAndFlush(p);

        if (room.getHostId().equals(userId) && room.getStatus() == RoomStatus.live) {
            // Host leaving ends the room.
            endRoomInternal(room);
            return;
        }

        if (room.getStatus() == RoomStatus.live) {
            User user = requireUser(userId);
            realtime.publishRoom("room.left", roomId,
                new MembershipPayload(roomId, userRef(user),
                    (int) participantRepository.countActiveByRoom(roomId)));
            broadcastParticipants(roomId);
        }
    }

    @Transactional
    public void end(UUID roomId, UUID userId) {
        LiveRoom room = requireRoom(roomId);
        if (!room.getHostId().equals(userId)) {
            throw GroupAccessService.forbidden("Only the host can end the room");
        }
        if (room.getStatus() == RoomStatus.ended) {
            return;
        }
        endRoomInternal(room);
    }

    /** End a room (status, endedAt) and broadcast {@code room.ended}. */
    private void endRoomInternal(LiveRoom room) {
        room.setStatus(RoomStatus.ended);
        room.setEndedAt(OffsetDateTime.now());
        roomRepository.saveAndFlush(room);
        // End the host's underlying live session so the task doesn't linger as
        // in_progress with no active session (reverts task → todo, broadcasts live.ended).
        if (room.getTaskId() != null) {
            liveService.endActiveSessionForTask(room.getTaskId(), room.getHostId());
        }
        realtime.publishRoom("room.ended", room.getId(),
            new RoomEndedPayload(room.getId(), room.getTaskId(), room.getEndedAt()));
    }

    // --- messages ---------------------------------------------------------

    @Transactional
    public MessageDto postMessage(UUID roomId, UUID userId, String body, String emoji) {
        LiveRoom room = requireRoom(roomId);
        requireActiveRoom(room);
        requireParticipant(roomId, userId);

        String trimmedBody = body == null || body.isBlank() ? null : body.trim();
        String trimmedEmoji = emoji == null || emoji.isBlank() ? null : emoji.trim();
        if (trimmedBody == null && trimmedEmoji == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "At least one of body or emoji is required");
        }

        LiveRoomMessage msg = new LiveRoomMessage();
        msg.setRoomId(roomId);
        msg.setSenderId(userId);
        msg.setBody(trimmedBody);
        msg.setEmoji(trimmedEmoji);
        messageRepository.saveAndFlush(msg);

        User sender = requireUser(userId);
        MessageDto dto = toMessageDto(msg, sender);
        realtime.publishRoom("room.message", roomId, dto);
        return dto;
    }

    // --- photos -----------------------------------------------------------

    @Transactional
    public PhotoDto postPhoto(UUID roomId, UUID userId, byte[] bytes, String contentType) {
        LiveRoom room = requireRoom(roomId);
        requireActiveRoom(room);
        requireParticipant(roomId, userId);

        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CONTENT_TYPE",
                "Only image/* uploads are accepted");
        }
        if (bytes == null || bytes.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Empty upload");
        }
        if (bytes.length > MAX_PHOTO_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "PHOTO_TOO_LARGE",
                "Image exceeds the " + (MAX_PHOTO_BYTES / (1024 * 1024)) + "MB limit");
        }

        BufferedImage image = thumbnailer.decode(bytes);

        // Persist first so Hibernate assigns the UUID, then key storage by it.
        Photo photo = new Photo();
        photo.setUploaderId(userId);
        photo.setRoomId(roomId);
        photo.setUrl("pending"); // url column is NOT NULL; replaced below
        photo.setWidth(image.getWidth());
        photo.setHeight(image.getHeight());
        photo.setBytes(bytes.length);
        photoRepository.saveAndFlush(photo);

        UUID photoId = photo.getId();
        String key = photoId.toString();
        String thumbKey = photoId + "-thumb";
        byte[] thumbBytes = thumbnailer.thumbnail(image);
        try {
            storage.put(key, bytes, contentType);
            storage.put(thumbKey, thumbBytes, "image/png");
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR",
                "Failed to store the image");
        }

        photo.setUrl("/api/v1/photos/" + photoId);
        photo.setThumbUrl("/api/v1/photos/" + photoId + "/thumb");
        photoRepository.saveAndFlush(photo);

        User uploader = requireUser(userId);
        PhotoDto dto = toPhotoDto(photo, uploader);
        realtime.publishRoom("room.photo", roomId, dto);

        // Feed: a photo was shared in this room.
        UUID groupId = groupIdForRoom(room);
        if (groupId != null) {
            activityService.record(groupId, userId,
                com.todly.activity.ActivityType.photo_shared, room.getTaskId(),
                "{\"photoId\":\"" + photoId + "\",\"roomId\":\"" + roomId + "\"}");
        }
        return dto;
    }

    // --- queries ----------------------------------------------------------

    @Transactional(readOnly = true)
    public RoomDetailDto detail(UUID roomId, UUID userId) {
        LiveRoom room = requireRoom(roomId);
        requireGroupMemberForRoom(room, userId);

        List<LiveRoomParticipant> active = participantRepository.findActiveByRoom(roomId);
        Map<UUID, User> users = usersById(collectUserIds(active, roomId));

        List<ParticipantDto> participants = new ArrayList<>();
        for (LiveRoomParticipant p : active) {
            User u = users.get(p.getId().getUserId());
            participants.add(new ParticipantDto(p.getId().getUserId(),
                nick(u), color(u), p.isHost(), p.getJoinedAt()));
        }

        List<LiveRoomMessage> recent = messageRepository
            .findRecentByRoom(roomId, PageRequest.of(0, 50));
        List<MessageDto> messages = new ArrayList<>();
        for (int i = recent.size() - 1; i >= 0; i--) { // reverse to chronological
            LiveRoomMessage m = recent.get(i);
            messages.add(toMessageDto(m, users.get(m.getSenderId())));
        }

        List<Photo> recentPhotos = photoRepository
            .findRecentByRoom(roomId, PageRequest.of(0, 30));
        List<PhotoDto> photos = new ArrayList<>();
        for (Photo p : recentPhotos) {
            photos.add(toPhotoDto(p, users.get(p.getUploaderId())));
        }

        User host = users.get(room.getHostId());
        return new RoomDetailDto(room.getId(), room.getTitle(), room.getStatus().name(),
            room.getStartedAt(), room.getEndedAt(), userRef(host),
            participants.size(), participants, messages, photos);
    }

    @Transactional(readOnly = true)
    public List<RoomListItem> myActiveRooms(UUID userId) {
        List<LiveRoom> liveRooms = roomRepository.findByStatus(RoomStatus.live);
        List<RoomListItem> result = new ArrayList<>();
        for (LiveRoom room : liveRooms) {
            if (room.getTaskId() == null) {
                continue;
            }
            Task task = taskRepository.findActiveById(room.getTaskId()).orElse(null);
            if (task == null || task.getGroup() == null) {
                continue;
            }
            UUID groupId = task.getGroup().getId();
            if (!isGroupMember(groupId, userId)) {
                continue;
            }
            User host = userRepository.findById(room.getHostId()).orElse(null);
            int count = (int) participantRepository.countActiveByRoom(room.getId());
            result.add(new RoomListItem(room.getId(), room.getTitle(), room.getTaskId(),
                groupId, userRef(host), count, room.getStartedAt()));
        }
        return result;
    }

    /** Authorize a photo view: caller must be a member of the photo's room group. */
    @Transactional(readOnly = true)
    public Photo requirePhotoForViewer(UUID photoId, UUID userId) {
        Photo photo = photoRepository.findById(photoId)
            .orElseThrow(() -> ApiException.notFound("Photo not found"));
        if (photo.getRoomId() != null) {
            LiveRoom room = roomRepository.findById(photo.getRoomId())
                .orElseThrow(() -> ApiException.notFound("Photo not found"));
            requireGroupMemberForRoom(room, userId);
        } else if (photo.getTaskId() != null) {
            Task task = taskRepository.findActiveById(photo.getTaskId())
                .orElseThrow(() -> ApiException.notFound("Photo not found"));
            if (task.getGroup() != null) {
                access.requireMember(task.getGroup().getId(), userId);
            } else if (!photo.getUploaderId().equals(userId)) {
                throw GroupAccessService.forbidden("Not allowed to view this photo");
            }
        }
        return photo;
    }

    public StorageService storage() {
        return storage;
    }

    public String storedContentType(String key, String fallback) {
        if (storage instanceof LocalFileStorage local) {
            String ct = local.contentType(key);
            if (ct != null) {
                return ct;
            }
        }
        return fallback;
    }

    // --- idle auto-close --------------------------------------------------

    /**
     * End rooms that have no active participants, or no message/photo/start activity
     * for {@code idleMinutes}. Returns the count ended. Called by the scheduler.
     */
    @Transactional
    public int closeIdleRooms(int idleMinutes) {
        OffsetDateTime threshold = OffsetDateTime.now().minusMinutes(idleMinutes);
        int ended = 0;
        for (LiveRoom room : roomRepository.findByStatus(RoomStatus.live)) {
            long activeCount = participantRepository.countActiveByRoom(room.getId());
            OffsetDateTime lastActivity = lastActivity(room);
            boolean idle = lastActivity.isBefore(threshold);
            if (activeCount == 0 || idle) {
                endRoomInternal(room);
                ended++;
            }
        }
        return ended;
    }

    private OffsetDateTime lastActivity(LiveRoom room) {
        OffsetDateTime last = room.getStartedAt();
        OffsetDateTime msg = messageRepository.lastMessageAt(room.getId());
        OffsetDateTime photo = photoRepository.lastPhotoAt(room.getId());
        if (msg != null && msg.isAfter(last)) {
            last = msg;
        }
        if (photo != null && photo.isAfter(last)) {
            last = photo;
        }
        return last;
    }

    // --- helpers ----------------------------------------------------------

    private void addOrReactivate(UUID roomId, UUID userId, boolean isHost) {
        LiveRoomParticipantId id = new LiveRoomParticipantId(roomId, userId);
        LiveRoomParticipant p = participantRepository.findById(id).orElse(null);
        if (p == null) {
            p = new LiveRoomParticipant();
            p.setId(id);
            p.setHost(isHost);
        } else {
            p.setLeftAt(null); // re-activate
            if (isHost) {
                p.setHost(true);
            }
        }
        participantRepository.saveAndFlush(p);
    }

    private void broadcastParticipants(UUID roomId) {
        List<LiveRoomParticipant> active = participantRepository.findActiveByRoom(roomId);
        Map<UUID, User> users = usersById(active.stream().map(p -> p.getId().getUserId()).toList());
        List<ParticipantDto> dtos = new ArrayList<>();
        for (LiveRoomParticipant p : active) {
            User u = users.get(p.getId().getUserId());
            dtos.add(new ParticipantDto(p.getId().getUserId(), nick(u), color(u),
                p.isHost(), p.getJoinedAt()));
        }
        realtime.publishRoom("room.participants", roomId,
            new ParticipantsPayload(roomId, dtos.size(), dtos));
    }

    private RoomDto toRoomDto(LiveRoom room) {
        User host = userRepository.findById(room.getHostId()).orElse(null);
        int count = (int) participantRepository.countActiveByRoom(room.getId());
        return new RoomDto(room.getId(), room.getTitle(), room.getStatus().name(),
            room.getStartedAt(), room.getEndedAt(), userRef(host), count);
    }

    private MessageDto toMessageDto(LiveRoomMessage m, User sender) {
        return new MessageDto(m.getId(), m.getRoomId(), m.getSenderId(),
            nick(sender), color(sender), m.getBody(), m.getEmoji(), m.getCreatedAt());
    }

    private PhotoDto toPhotoDto(Photo p, User uploader) {
        return new PhotoDto(p.getId(), p.getRoomId(), p.getUploaderId(),
            nick(uploader), p.getUrl(), p.getThumbUrl(), p.getCreatedAt());
    }

    private List<UUID> collectUserIds(List<LiveRoomParticipant> active, UUID roomId) {
        List<UUID> ids = new ArrayList<>(active.stream().map(p -> p.getId().getUserId()).toList());
        // include senders/uploaders/host even if no longer active
        messageRepository.findRecentByRoom(roomId, PageRequest.of(0, 50))
            .forEach(m -> ids.add(m.getSenderId()));
        photoRepository.findRecentByRoom(roomId, PageRequest.of(0, 30))
            .forEach(p -> ids.add(p.getUploaderId()));
        roomRepository.findById(roomId).ifPresent(r -> ids.add(r.getHostId()));
        return ids;
    }

    private Map<UUID, User> usersById(List<UUID> ids) {
        Map<UUID, User> map = new HashMap<>();
        userRepository.findAllById(ids).forEach(u -> map.put(u.getId(), u));
        return map;
    }

    private UserRef userRef(User u) {
        if (u == null) {
            return null;
        }
        return new UserRef(u.getId(), u.getNickname(), u.getProfileColor().name());
    }

    private String nick(User u) { return u == null ? null : u.getNickname(); }

    private String color(User u) { return u == null ? null : u.getProfileColor().name(); }

    private LiveRoom requireRoom(UUID roomId) {
        return roomRepository.findById(roomId)
            .orElseThrow(() -> ApiException.notFound("Live room not found"));
    }

    private void requireActiveRoom(LiveRoom room) {
        if (room.getStatus() == RoomStatus.ended) {
            throw new ApiException(HttpStatus.GONE, "ROOM_ENDED", "This live room has ended");
        }
    }

    public void requireParticipant(UUID roomId, UUID userId) {
        if (!participantRepository.isActiveParticipant(roomId, userId)) {
            throw GroupAccessService.forbidden("You are not a participant of this room");
        }
    }

    private Task requireGroupTaskMember(UUID taskId, UUID userId) {
        Task t = taskRepository.findActiveById(taskId)
            .orElseThrow(() -> ApiException.notFound("Task not found"));
        if (t.getGroup() == null) {
            throw GroupAccessService.forbidden("Live rooms require a group task");
        }
        access.requireMember(t.getGroup().getId(), userId);
        return t;
    }

    /** A room's group is derived from its task; membership is required to view/join. */
    private void requireGroupMemberForRoom(LiveRoom room, UUID userId) {
        if (room.getTaskId() == null) {
            // Routine-only rooms: fall back to participant check.
            requireParticipant(room.getId(), userId);
            return;
        }
        Task task = taskRepository.findActiveById(room.getTaskId())
            .orElseThrow(() -> ApiException.notFound("Task not found"));
        if (task.getGroup() == null) {
            throw GroupAccessService.forbidden("Live rooms require a group task");
        }
        access.requireMember(task.getGroup().getId(), userId);
    }

    /** Non-throwing groupId resolver for a room (via its task), or null. */
    private UUID groupIdForRoom(LiveRoom room) {
        if (room.getTaskId() == null) {
            return null;
        }
        return taskRepository.findActiveById(room.getTaskId())
            .map(t -> t.getGroup() != null ? t.getGroup().getId() : null)
            .orElse(null);
    }

    private boolean isGroupMember(UUID groupId, UUID userId) {
        // Non-throwing check: throwing ApiException inside a @Transactional method
        // marks the transaction rollback-only, which then fails commit with
        // UnexpectedRollbackException even when caught here. Query a boolean instead.
        return groupMemberRepository.isMember(groupId, userId);
    }

    private User requireUser(UUID userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
