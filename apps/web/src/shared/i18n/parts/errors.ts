/**
 * User-facing API error messages, keyed by `<domain>.<SERVER_CODE>`. These used
 * to be hardcoded Korean maps inside each feature's api.ts; they now resolve
 * through i18n so English users see English.
 *
 * Domains are namespaced because the same server code carries a different
 * message per domain (e.g. errorTask.FORBIDDEN vs errorGroup.FORBIDDEN,
 * errorAuth.INVALID_CREDENTIALS vs errorSettings.INVALID_CREDENTIALS).
 *
 * `errors.generic` is the shared fallback. `errorsKo` and `errorsEn` MUST share
 * a key set.
 */
export const errorsKo = {
  'errors.generic': '문제가 발생했어요. 다시 시도해 주세요',

  // tasks/api.ts
  'errorTask.VERSION_CONFLICT': '다른 사람이 먼저 수정했어요. 새로고침 해주세요',
  'errorTask.FORBIDDEN': '이 작업을 할 권한이 없어요',
  'errorTask.TASK_NOT_FOUND': '투두를 찾을 수 없어요',
  'errorTask.SECTION_NOT_FOUND': '리스트를 찾을 수 없어요',
  'errorTask.GROUP_NOT_FOUND': '그룹을 찾을 수 없어요',

  // auth/api.ts
  'errorAuth.INVALID_CREDENTIALS': '이메일 또는 비밀번호가 올바르지 않아요',
  'errorAuth.EMAIL_TAKEN': '이미 가입된 이메일이에요',
  'errorAuth.USERNAME_TAKEN': '이미 사용 중인 아이디예요',

  // groups/api.ts
  'errorGroup.ALREADY_MEMBER': '이미 이 그룹의 멤버예요',
  'errorGroup.INVITATION_EXPIRED': '초대 링크가 만료되었어요',
  'errorGroup.FORBIDDEN': '권한이 없어요',
  'errorGroup.OWNER_MUST_DELEGATE': '방장은 다른 멤버에게 권한을 넘긴 뒤 나갈 수 있어요',
  'errorGroup.GROUP_NOT_FOUND': '그룹을 찾을 수 없어요',
  'errorGroup.INVITATION_NOT_FOUND': '초대 링크를 찾을 수 없어요',

  // settings/api.ts
  'errorSettings.INVALID_CREDENTIALS': '현재 비밀번호가 올바르지 않아요',
  'errorSettings.NO_PASSWORD_SET': '소셜 로그인 계정은 비밀번호가 없어요',

  // friends/api.ts
  'errorFriend.USER_NOT_FOUND': '해당 아이디의 사용자를 찾을 수 없어요',
  'errorFriend.ALREADY_FRIENDS': '이미 친구예요',
  'errorFriend.REQUEST_EXISTS': '이미 친구 요청을 보냈어요',
  'errorFriend.BLOCKED': '차단된 사용자예요',
}

export const errorsEn = {
  'errors.generic': 'Something went wrong. Please try again',

  // tasks/api.ts
  'errorTask.VERSION_CONFLICT': 'Someone edited this first. Please refresh.',
  'errorTask.FORBIDDEN': "You don't have permission to do this",
  'errorTask.TASK_NOT_FOUND': "Couldn't find this to-do",
  'errorTask.SECTION_NOT_FOUND': "Couldn't find this list",
  'errorTask.GROUP_NOT_FOUND': "Couldn't find this group",

  // auth/api.ts
  'errorAuth.INVALID_CREDENTIALS': 'Your email or password is incorrect',
  'errorAuth.EMAIL_TAKEN': 'This email is already registered',
  'errorAuth.USERNAME_TAKEN': 'This username is already taken',

  // groups/api.ts
  'errorGroup.ALREADY_MEMBER': "You're already a member of this group",
  'errorGroup.INVITATION_EXPIRED': 'This invite link has expired',
  'errorGroup.FORBIDDEN': "You don't have permission",
  'errorGroup.OWNER_MUST_DELEGATE': 'The owner must hand off to another member before leaving',
  'errorGroup.GROUP_NOT_FOUND': "Couldn't find this group",
  'errorGroup.INVITATION_NOT_FOUND': "Couldn't find this invite link",

  // settings/api.ts
  'errorSettings.INVALID_CREDENTIALS': 'Your current password is incorrect',
  'errorSettings.NO_PASSWORD_SET': "Social login accounts don't have a password",

  // friends/api.ts
  'errorFriend.USER_NOT_FOUND': "Couldn't find a user with that username",
  'errorFriend.ALREADY_FRIENDS': "You're already friends",
  'errorFriend.REQUEST_EXISTS': "You've already sent a friend request",
  'errorFriend.BLOCKED': 'This user is blocked',
}
