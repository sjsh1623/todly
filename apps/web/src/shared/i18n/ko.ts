/**
 * Korean (default) resource bundle for todly.
 *
 * PATTERN: keep keys grouped by domain (nav, common, empty, …). To migrate a
 * string, move the literal here and call `t('group.key')` at the call site.
 * Korean is the default + fallback language; add an `en.ts` with the same shape
 * to enable English later (see i18n.ts).
 */
export const ko = {
  translation: {
    nav: {
      home: '홈',
      groups: '그룹',
      activity: '활동',
      routine: '루틴',
      profile: '프로필',
    },
    common: {
      save: '저장',
      cancel: '취소',
      delete: '삭제',
      done: '완료',
      confirm: '확인',
      close: '닫기',
      retry: '다시 시도',
      loading: '불러오는 중…',
      saving: '저장 중…',
      skipToContent: '본문으로 건너뛰기',
    },
    offline: {
      banner: '오프라인 상태예요. 일부 기능이 제한될 수 있어요.',
      backOnline: '다시 연결됐어요',
    },
    empty: {
      activityTitle: '아직 활동이 없어요',
      activitySubtitle: '함께 투두를 시작하면 여기에 보여드릴게요',
      routineTitle: '아직 루틴이 없어요',
      routineSubtitle: '+ 버튼으로 반복할 루틴을 추가하세요',
      notificationsTitle: '새 알림이 없어요',
      notificationsSubtitle: '활동이 생기면 여기로 알려드릴게요',
      friendsTitle: '아직 친구가 없어요',
      friendsSubtitle: '친구를 초대해 함께 시작해 보세요',
      searchTitle: '검색 결과가 없어요',
      searchSubtitle: '다른 검색어로 다시 시도해 보세요',
      groupsTitle: '아직 그룹이 없어요',
      groupsSubtitle: '첫 그룹을 만들어 함께 시작해 보세요',
    },
  },
} as const

export type Resources = typeof ko
