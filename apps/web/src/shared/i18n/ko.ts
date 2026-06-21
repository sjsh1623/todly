/**
 * Korean (default) resource bundle for todly.
 *
 * Keys are FLAT, dotted strings (i18n is configured with keySeparator:false /
 * nsSeparator:false) so per-component key namespaces merge without collisions.
 * Keep `en.ts` in sync — every key here must exist there. Group keys by domain
 * via a `<namespace>.<key>` prefix.
 */
import { authKo } from './parts/auth'
import { homeKo } from './parts/home'
import { tasksKo } from './parts/tasks'
import { socialKo } from './parts/social'
import { settingsKo } from './parts/settings'
import { uiKo } from './parts/ui'
import { groupsKo } from './parts/groups'
import { timeKo } from './parts/time'
import { errorsKo } from './parts/errors'

export const ko = {
  translation: {
    // Per-component bundles (migrated strings) merged first; the shared keys
    // below take precedence on any accidental overlap.
    ...authKo,
    ...homeKo,
    ...tasksKo,
    ...socialKo,
    ...settingsKo,
    ...uiKo,
    ...groupsKo,
    ...timeKo,
    ...errorsKo,

    // nav
    'nav.home': '홈',
    'nav.groups': '그룹',
    'nav.activity': '활동',
    'nav.routine': '루틴',
    'nav.profile': '프로필',

    // common
    'common.save': '저장',
    'common.cancel': '취소',
    'common.delete': '삭제',
    'common.done': '완료',
    'common.confirm': '확인',
    'common.close': '닫기',
    'common.retry': '다시 시도',
    'common.loading': '불러오는 중…',
    'common.saving': '저장 중…',
    'common.skipToContent': '본문으로 건너뛰기',

    // offline
    'offline.banner': '오프라인 상태예요. 일부 기능이 제한될 수 있어요.',
    'offline.backOnline': '다시 연결됐어요',

    // empty states
    'empty.activityTitle': '아직 활동이 없어요',
    'empty.activitySubtitle': '함께 투두를 시작하면 여기에 보여드릴게요',
    'empty.routineTitle': '아직 루틴이 없어요',
    'empty.routineSubtitle': '+ 버튼으로 반복할 루틴을 추가하세요',
    'empty.notificationsTitle': '새 알림이 없어요',
    'empty.notificationsSubtitle': '활동이 생기면 여기로 알려드릴게요',
    'empty.friendsTitle': '아직 친구가 없어요',
    'empty.friendsSubtitle': '친구를 초대해 함께 시작해 보세요',
    'empty.searchTitle': '검색 결과가 없어요',
    'empty.searchSubtitle': '다른 검색어로 다시 시도해 보세요',
    'empty.groupsTitle': '아직 그룹이 없어요',
    'empty.groupsSubtitle': '첫 그룹을 만들어 함께 시작해 보세요',

    // settings — language switcher
    'settings.language': '언어',
    'settings.languageKo': '한국어',
    'settings.languageEn': 'English',
  },
} as const

export type Resources = typeof ko
