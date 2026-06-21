/**
 * Flat i18n keys for the public auth flows (login, signup, password reset,
 * group invite acceptance, OAuth buttons). Keys are dotted strings under a
 * per-screen namespace and merge into the main ko/en bundles.
 *
 * authKo and authEn MUST share an identical key set.
 */

export const authKo = {
  // login
  'login.title': '다시 오신 걸 환영해요',
  'login.subtitle': '함께 살아가는 하루를 이어가요',
  'login.emailLabel': '이메일',
  'login.passwordLabel': '비밀번호',
  'login.emailRequired': '이메일을 입력해 주세요',
  'login.emailInvalid': '올바른 이메일 형식이 아니에요',
  'login.passwordRequired': '비밀번호를 입력해 주세요',
  'login.forgotPassword': '비밀번호를 잊으셨나요?',
  'login.submit': '로그인',
  'login.submitting': '로그인 중…',
  'login.or': '또는',
  'login.noAccount': '계정이 없으신가요?',
  'login.signupLink': '회원가입',

  // signup
  'signup.back': '뒤로 가기',
  'signup.title': '함께 시작해요',
  'signup.subtitle': '몇 가지만 알려주시면 돼요',
  'signup.profileColor': '프로필 색상',
  'signup.nicknameLabel': '닉네임',
  'signup.nicknamePlaceholder': '석현',
  'signup.usernameLabel': '아이디',
  'signup.emailLabel': '이메일',
  'signup.passwordLabel': '비밀번호',
  'signup.nicknameRequired': '닉네임을 입력해 주세요',
  'signup.nicknameMax': '닉네임은 최대 {{max}}자까지 가능해요',
  'signup.usernameMin': '아이디는 3자 이상이어야 해요',
  'signup.usernameMax': '아이디는 최대 20자까지 가능해요',
  'signup.usernamePattern': '영문 소문자, 숫자, 밑줄(_)만 사용할 수 있어요',
  'signup.emailRequired': '이메일을 입력해 주세요',
  'signup.emailInvalid': '올바른 이메일 형식이 아니에요',
  'signup.passwordMin': '비밀번호는 8자 이상이어야 해요',
  'signup.usernameChecking': '확인 중…',
  'signup.usernameAvailable': '사용 가능한 아이디예요',
  'signup.usernameTaken': '이미 사용 중인 아이디예요',
  'signup.usernameCheckFailed': '확인에 실패했어요',
  'signup.submit': '회원가입',
  'signup.submitting': '가입 중…',
  'signup.termsPrefix': '가입하면',
  'signup.termsOfService': '이용약관',
  'signup.termsConjunction': '과',
  'signup.privacyPolicy': '개인정보처리방침',
  'signup.termsSuffix': '에',
  'signup.termsAgree': '동의하게 됩니다.',
  'signup.haveAccount': '이미 계정이 있으신가요?',
  'signup.loginLink': '로그인',

  // resetPassword
  'resetPassword.back': '뒤로 가기',
  'resetPassword.title': '비밀번호 재설정',
  'resetPassword.subtitle': '가입하신 이메일로 재설정 링크를 보내드릴게요',
  'resetPassword.emailLabel': '이메일',
  'resetPassword.emailRequired': '이메일을 입력해 주세요',
  'resetPassword.emailInvalid': '올바른 이메일 형식이 아니에요',
  'resetPassword.sentLine1': '입력하신 이메일로 재설정 안내를 보냈어요.',
  'resetPassword.sentLine2': '메일함을 확인해 주세요.',
  'resetPassword.submit': '재설정 링크 보내기',
  'resetPassword.submitting': '전송 중…',
  'resetPassword.rememberPassword': '비밀번호가 기억나셨나요?',
  'resetPassword.loginLink': '로그인',

  // inviteAccept
  'inviteAccept.invalidTitle': '초대 링크를 확인할 수 없어요',
  'inviteAccept.invalidFallback': '링크가 만료되었거나 존재하지 않아요',
  'inviteAccept.toGroupList': '그룹 목록으로',
  'inviteAccept.invitedHeading': '그룹 초대를 받았어요',
  'inviteAccept.memberCount': '멤버 {{memberCount}}명',
  'inviteAccept.expired': '이 초대 링크는 만료되었어요',
  'inviteAccept.join': '그룹 참여하기',
  'inviteAccept.joining': '참여하는 중…',

  // passwordStrength — password.ts
  'passwordStrength.weak': '약함',
  'passwordStrength.medium': '보통',
  'passwordStrength.strong': '안전함',

  // oauth
  'oauth.continueWith': '{{provider}}로 계속하기',
} as const

export const authEn = {
  // login
  'login.title': 'Welcome back',
  'login.subtitle': 'Pick up the day you share together',
  'login.emailLabel': 'Email',
  'login.passwordLabel': 'Password',
  'login.emailRequired': 'Please enter your email',
  'login.emailInvalid': "That email doesn't look right",
  'login.passwordRequired': 'Please enter your password',
  'login.forgotPassword': 'Forgot your password?',
  'login.submit': 'Log in',
  'login.submitting': 'Logging in…',
  'login.or': 'or',
  'login.noAccount': "Don't have an account?",
  'login.signupLink': 'Sign up',

  // signup
  'signup.back': 'Go back',
  'signup.title': "Let's get started",
  'signup.subtitle': 'Just a few quick details',
  'signup.profileColor': 'Profile color',
  'signup.nicknameLabel': 'Nickname',
  'signup.nicknamePlaceholder': 'Alex',
  'signup.usernameLabel': 'Username',
  'signup.emailLabel': 'Email',
  'signup.passwordLabel': 'Password',
  'signup.nicknameRequired': 'Please enter a nickname',
  'signup.nicknameMax': 'Nickname can be up to {{max}} characters',
  'signup.usernameMin': 'Username must be at least 3 characters',
  'signup.usernameMax': 'Username can be up to 20 characters',
  'signup.usernamePattern': 'Use only lowercase letters, numbers, and underscores (_)',
  'signup.emailRequired': 'Please enter your email',
  'signup.emailInvalid': "That email doesn't look right",
  'signup.passwordMin': 'Password must be at least 8 characters',
  'signup.usernameChecking': 'Checking…',
  'signup.usernameAvailable': 'This username is available',
  'signup.usernameTaken': 'This username is already taken',
  'signup.usernameCheckFailed': 'Could not check availability',
  'signup.submit': 'Sign up',
  'signup.submitting': 'Signing up…',
  'signup.termsPrefix': 'By signing up, you agree to our',
  'signup.termsOfService': 'Terms of Service',
  'signup.termsConjunction': ' and',
  'signup.privacyPolicy': 'Privacy Policy',
  'signup.termsSuffix': '.',
  'signup.termsAgree': '',
  'signup.haveAccount': 'Already have an account?',
  'signup.loginLink': 'Log in',

  // resetPassword
  'resetPassword.back': 'Go back',
  'resetPassword.title': 'Reset password',
  'resetPassword.subtitle': "We'll send a reset link to your email",
  'resetPassword.emailLabel': 'Email',
  'resetPassword.emailRequired': 'Please enter your email',
  'resetPassword.emailInvalid': "That email doesn't look right",
  'resetPassword.sentLine1': "We've sent reset instructions to your email.",
  'resetPassword.sentLine2': 'Please check your inbox.',
  'resetPassword.submit': 'Send reset link',
  'resetPassword.submitting': 'Sending…',
  'resetPassword.rememberPassword': 'Remembered your password?',
  'resetPassword.loginLink': 'Log in',

  // inviteAccept
  'inviteAccept.invalidTitle': "We couldn't verify this invite link",
  'inviteAccept.invalidFallback': "This link has expired or doesn't exist",
  'inviteAccept.toGroupList': 'Back to groups',
  'inviteAccept.invitedHeading': "You've been invited to a group",
  'inviteAccept.memberCount': '{{memberCount}} members',
  'inviteAccept.expired': 'This invite link has expired',
  'inviteAccept.join': 'Join group',
  'inviteAccept.joining': 'Joining…',

  // passwordStrength — password.ts
  'passwordStrength.weak': 'Weak',
  'passwordStrength.medium': 'Medium',
  'passwordStrength.strong': 'Strong',

  // oauth
  'oauth.continueWith': 'Continue with {{provider}}',
} as const
