-- todly PHASE 1 — full PostgreSQL schema (transcribed from docs/03_데이터베이스설계.md)
-- PostgreSQL 16 / Hibernate 6.5 (Spring Boot 3.3.4)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- §2. ENUM TYPES
-- ============================================================
CREATE TYPE profile_color     AS ENUM ('blue','green','orange','purple');
CREATE TYPE member_role       AS ENUM ('owner','admin','member');
CREATE TYPE task_status       AS ENUM ('todo','in_progress','done','archived');
CREATE TYPE task_priority     AS ENUM ('none','low','medium','high','urgent');
CREATE TYPE recur_freq        AS ENUM ('daily','weekly','monthly','custom');
CREATE TYPE activity_type     AS ENUM (
  'task_created','task_completed','task_reopened',
  'live_started','live_ended','member_joined','comment_added','routine_done',
  'milestone_reached','friend_joined_room','photo_shared'
);
CREATE TYPE invitation_status AS ENUM ('pending','accepted','expired','revoked');
CREATE TYPE notification_type AS ENUM (
  'due_soon','overdue','assigned','live_started','milestone','mention','invite',
  'comment','friend_request','friend_accepted','room_cheer'
);
CREATE TYPE device_platform   AS ENUM ('web','ios','android');
CREATE TYPE oauth_provider    AS ENUM ('apple','google');

-- v2.0
CREATE TYPE group_type        AS ENUM ('group','couple','travel','list');
CREATE TYPE app_theme         AS ENUM ('ocean','mint','violet','coral','sunset');
CREATE TYPE friendship_status AS ENUM ('pending','accepted','blocked');
CREATE TYPE room_status       AS ENUM ('live','ended');
CREATE TYPE live_status       AS ENUM ('running','paused','done');

-- ============================================================
-- §3. CORE TABLES
-- ============================================================

-- 3.1 users
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    username      VARCHAR(30)  NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    nickname      VARCHAR(20)  NOT NULL,
    profile_color profile_color NOT NULL DEFAULT 'blue',
    avatar_url    TEXT,
    theme         app_theme NOT NULL DEFAULT 'ocean',
    dark_mode     BOOLEAN  NOT NULL DEFAULT false,
    language      VARCHAR(8) NOT NULL DEFAULT 'ko',
    timezone      VARCHAR(64)  NOT NULL DEFAULT 'Asia/Seoul',
    last_active_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;

-- 3.2 oauth_accounts
CREATE TABLE oauth_accounts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      oauth_provider NOT NULL,
    provider_uid  VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_uid)
);

-- 3.3 refresh_tokens
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- 3.4 groups
CREATE TABLE groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(60) NOT NULL,
    type        group_type NOT NULL DEFAULT 'group',
    color       VARCHAR(20) NOT NULL DEFAULT 'blue',
    icon        VARCHAR(40),
    description TEXT,
    owner_id    UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- 3.5 group_members
CREATE TABLE group_members (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         member_role NOT NULL DEFAULT 'member',
    last_seen_at TIMESTAMPTZ,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id)
);
CREATE INDEX idx_gm_group ON group_members(group_id);
CREATE INDEX idx_gm_user  ON group_members(user_id);

-- 3.6 sections
CREATE TABLE sections (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title      VARCHAR(60) NOT NULL,
    position   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sections_group ON sections(group_id, position);

-- 3.7 tasks
-- NOTE: routine_id references routines(id), but routines is defined AFTER tasks
-- in the doc (forward reference). We create tasks without that FK here and add
-- it via ALTER TABLE once routines exists (see below).
CREATE TABLE tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID REFERENCES groups(id) ON DELETE CASCADE,
    section_id   UUID REFERENCES sections(id) ON DELETE SET NULL,
    routine_id   UUID,
    creator_id   UUID NOT NULL REFERENCES users(id),
    title        VARCHAR(200) NOT NULL,
    note         TEXT,
    status       task_status NOT NULL DEFAULT 'todo',
    priority     task_priority NOT NULL DEFAULT 'none',
    due_date     DATE,
    due_at       TIMESTAMPTZ,
    position     INT NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    version      INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_tasks_group   ON tasks(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_section ON tasks(section_id);
CREATE INDEX idx_tasks_due     ON tasks(due_date) WHERE status <> 'done';
CREATE INDEX idx_tasks_status  ON tasks(group_id, status);

-- 3.8 task_assignees
CREATE TABLE task_assignees (
    task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);

-- 3.9 subtasks
CREATE TABLE subtasks (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title     VARCHAR(200) NOT NULL,
    is_done   BOOLEAN NOT NULL DEFAULT false,
    position  INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_subtasks_task ON subtasks(task_id);

-- 3.10 live_sessions
CREATE TABLE live_sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     live_status NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paused_seconds INT NOT NULL DEFAULT 0,
    ended_at   TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_live_active_user
  ON live_sessions(user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_live_active_task ON live_sessions(task_id) WHERE ended_at IS NULL;

-- 3.11 routines
CREATE TABLE routines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
    creator_id  UUID NOT NULL REFERENCES users(id),
    title       VARCHAR(200) NOT NULL,
    section_id  UUID REFERENCES sections(id) ON DELETE SET NULL,
    recur_freq  recur_freq NOT NULL,
    recur_rule  JSONB,
    next_run_at TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_routines_next ON routines(next_run_at) WHERE is_active;

-- forward-ref FK: tasks.routine_id -> routines.id
ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_routine
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE SET NULL;

-- 3.12 activities
CREATE TABLE activities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      UUID REFERENCES groups(id) ON DELETE CASCADE,
    actor_id      UUID NOT NULL REFERENCES users(id),
    type          activity_type NOT NULL,
    target_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    meta          JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_group_time ON activities(group_id, created_at DESC);

-- 3.13 comments
CREATE TABLE comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id  UUID NOT NULL REFERENCES users(id),
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_comments_task ON comments(task_id, created_at);

-- 3.14 notifications
CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       notification_type NOT NULL,
    title      VARCHAR(120) NOT NULL,
    body       TEXT,
    link       TEXT,
    is_read    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, is_read, created_at DESC);

-- 3.15 invitations
CREATE TABLE invitations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    inviter_id  UUID NOT NULL REFERENCES users(id),
    code        VARCHAR(16) NOT NULL UNIQUE,
    email       VARCHAR(255),
    status      invitation_status NOT NULL DEFAULT 'pending',
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.16 device_tokens
CREATE TABLE device_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(512) NOT NULL UNIQUE,
    platform   device_platform NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.17 notification_settings
CREATE TABLE notification_settings (
    user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    push_due       BOOLEAN NOT NULL DEFAULT true,
    push_assigned  BOOLEAN NOT NULL DEFAULT true,
    push_live      BOOLEAN NOT NULL DEFAULT true,
    push_comment   BOOLEAN NOT NULL DEFAULT true,
    quiet_from     TIME,
    quiet_to       TIME
);

-- ============================================================
-- §3-B. v2.0 TABLES
-- ============================================================

-- 3.18 friendships
CREATE TABLE friendships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      friendship_status NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id),
    UNIQUE (requester_id, addressee_id)
);
CREATE INDEX idx_friend_addressee ON friendships(addressee_id, status);
CREATE INDEX idx_friend_requester ON friendships(requester_id, status);

-- 3.19 live_rooms
CREATE TABLE live_rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
    routine_id  UUID REFERENCES routines(id) ON DELETE SET NULL,
    host_id     UUID NOT NULL REFERENCES users(id),
    title       VARCHAR(120) NOT NULL,
    status      room_status NOT NULL DEFAULT 'live',
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at    TIMESTAMPTZ
);
CREATE INDEX idx_rooms_status ON live_rooms(status) WHERE status='live';

-- 3.20 live_room_participants
CREATE TABLE live_room_participants (
    room_id   UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_host   BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at   TIMESTAMPTZ,
    PRIMARY KEY (room_id, user_id)
);

-- 3.21 live_room_messages
CREATE TABLE live_room_messages (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id   UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body      VARCHAR(300),
    emoji     VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_room_msg ON live_room_messages(room_id, created_at);

-- 3.22 photos
CREATE TABLE photos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
    room_id    UUID REFERENCES live_rooms(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    thumb_url  TEXT,
    width      INT,
    height     INT,
    bytes      INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_photo_target CHECK (task_id IS NOT NULL OR room_id IS NOT NULL)
);
CREATE INDEX idx_photos_task ON photos(task_id);
CREATE INDEX idx_photos_room ON photos(room_id, created_at);

-- 3.23 user_stats
CREATE TABLE user_stats (
    user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    life_score       INT NOT NULL DEFAULT 0,
    routine_score    INT NOT NULL DEFAULT 0,
    completion_rate  NUMERIC(5,2) NOT NULL DEFAULT 0,
    current_streak   INT NOT NULL DEFAULT 0,
    best_streak      INT NOT NULL DEFAULT 0,
    yearly_count     INT NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.24 daily_activity
CREATE TABLE daily_activity (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day       DATE NOT NULL,
    count     INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);
CREATE INDEX idx_daily_user ON daily_activity(user_id, day);

-- 3.25 routine_logs / routine_streaks
CREATE TABLE routine_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    done_on    DATE NOT NULL,
    skipped    BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (routine_id, user_id, done_on)
);

CREATE TABLE routine_streaks (
    routine_id UUID PRIMARY KEY REFERENCES routines(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    best_streak    INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
