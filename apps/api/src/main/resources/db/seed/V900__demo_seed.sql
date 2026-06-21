-- DEMO SEED — only runs under the `demo` Spring profile (see application-demo.yml).
-- Fixed UUIDs keep it deterministic. Demo-only data.

-- Users: 석현(@seokhyun), 서연, 엄마, 민재
INSERT INTO users (id, email, username, nickname, profile_color) VALUES
  ('11111111-1111-1111-1111-111111111111', 'seokhyun@todly.dev', 'seokhyun', '석현', 'blue'),
  ('22222222-2222-2222-2222-222222222222', 'seoyeon@todly.dev',  'seoyeon',  '서연', 'green'),
  ('33333333-3333-3333-3333-333333333333', 'mom@todly.dev',      'mom',      '엄마', 'orange'),
  ('44444444-4444-4444-4444-444444444444', 'minjae@todly.dev',   'minjae',   '민재', 'purple');

-- Group: "이사 준비" (type group), owned by 석현
INSERT INTO groups (id, name, type, color, owner_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '이사 준비', 'group', 'blue',
   '11111111-1111-1111-1111-111111111111');

-- Section: "짐 싸기"
INSERT INTO sections (id, group_id, title, position) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '짐 싸기', 0);

-- 4 group members
INSERT INTO group_members (group_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member');

-- 5 tasks across statuses → 4 done / 1 not done = 80% progress
INSERT INTO tasks (group_id, section_id, creator_id, title, status, priority, completed_at, completed_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '11111111-1111-1111-1111-111111111111', '주방 정리하기',   'done', 'medium', now(), '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222', '택배 포장하기',   'done', 'high',   now(), '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '33333333-3333-3333-3333-333333333333', '옷장 정리하기',   'done', 'low',    now(), '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '44444444-4444-4444-4444-444444444444', '책 박스 싸기',     'done', 'none',   now(), '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '11111111-1111-1111-1111-111111111111', '청소 업체 예약하기', 'in_progress', 'urgent', NULL, NULL);
