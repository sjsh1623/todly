import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const API_BASE =
  process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:8080/api/v1'

export type ProfileColor = 'blue' | 'green' | 'orange' | 'purple'

export type TestUser = {
  nickname: string
  username: string
  email: string
  password: string
  profileColor: ProfileColor
}

let counter = 0
function uniq() {
  counter += 1
  return `${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e4)}`
}

/** Builds a fresh, unique test user. Username is lowercase alnum/underscore. */
export function makeUser(prefix = 'e2e'): TestUser {
  const id = uniq().toLowerCase().replace(/[^a-z0-9_]/g, '')
  return {
    nickname: `${prefix}${id.slice(0, 5)}`,
    username: `${prefix}_${id}`.slice(0, 20),
    email: `${prefix}_${id}@todly.app`,
    password: 'password123',
    profileColor: 'blue',
  }
}

export type SeededUser = TestUser & {
  id: string
  accessToken: string
  refreshToken: string
}

/** Creates a user directly via the REST API (for 2nd-user / setup flows). */
export async function apiSignup(
  request: APIRequestContext,
  user: TestUser = makeUser('e2eapi'),
): Promise<SeededUser> {
  const res = await request.post(`${API_BASE}/auth/signup`, {
    data: {
      nickname: user.nickname,
      username: user.username,
      email: user.email,
      password: user.password,
      profileColor: user.profileColor,
    },
  })
  if (!res.ok()) {
    throw new Error(`apiSignup failed: ${res.status()} ${await res.text()}`)
  }
  const body = await res.json()
  return {
    ...user,
    id: body.user.id,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  }
}

/** Authenticated REST helper bound to a seeded user. */
export function apiAs(request: APIRequestContext, token: string) {
  const headers = { Authorization: `Bearer ${token}` }
  return {
    async post(path: string, data?: unknown) {
      const res = await request.post(`${API_BASE}${path}`, { headers, data })
      return res
    },
    async get(path: string) {
      const res = await request.get(`${API_BASE}${path}`, { headers })
      return res
    },
  }
}

/**
 * Signs a fresh user up through the UI and waits until the protected app
 * (bottom nav) is visible. Returns the created user.
 */
export async function signupViaUI(page: Page, user: TestUser = makeUser()): Promise<TestUser> {
  await page.goto('/signup')
  await page.getByLabel('닉네임').fill(user.nickname)
  await page.getByLabel('아이디').fill(user.username)
  await page.getByLabel('이메일').fill(user.email)
  await page.getByLabel('비밀번호', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: '회원가입' }).click()
  // Lands on Home with the bottom navigation visible.
  await expect(page.getByRole('navigation', { name: '주요' })).toBeVisible({ timeout: 15000 })
  return user
}

/** Logs in an existing user through the UI. */
export async function loginViaUI(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(user.email)
  await page.getByLabel('비밀번호', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page.getByRole('navigation', { name: '주요' })).toBeVisible({ timeout: 15000 })
}

/**
 * Seeds auth state directly into localStorage so a page loads already logged in.
 * Faster + more isolated than UI login for flows where auth isn't under test.
 */
export async function seedAuth(page: Page, seeded: SeededUser) {
  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem(
        'todly-auth',
        JSON.stringify({
          state: { refreshToken: token, user },
          version: 0,
        }),
      )
    },
    [
      seeded.refreshToken,
      {
        id: seeded.id,
        username: seeded.username,
        nickname: seeded.nickname,
        email: seeded.email,
        profileColor: seeded.profileColor,
        theme: 'ocean',
        darkMode: false,
        language: 'ko',
        avatarUrl: null,
      },
    ] as const,
  )
}

/**
 * Creates a task inside the given group via the UI. Assumes the page is on the
 * group detail screen. Robust against the FAB-before-navigation race.
 */
export async function createTaskInGroup(page: Page, group: string, title: string) {
  const fab = page.getByRole('button', { name: '투두 추가', exact: true })
  await expect(fab).toBeVisible()
  await fab.click()
  await page.waitForURL(/\/tasks\/new/, { timeout: 15000 })
  await page.getByPlaceholder('무엇을 할까요?').fill(title)
  await page.getByRole('radio', { name: group }).click()
  await page.getByRole('button', { name: '투두 추가하기' }).click()
  await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15000 })
}

/** Creates a group via the UI from the Groups tab. Returns the group name. */
export async function createGroupViaUI(
  page: Page,
  name = `그룹${Math.floor(Math.random() * 1e5)}`,
): Promise<string> {
  await page.goto('/groups/new')
  // Wait for the create form to mount (guards against a slow auth bootstrap
  // briefly bouncing the protected route under heavy parallel load).
  const nameField = page.getByLabel('그룹 이름')
  await expect(nameField).toBeVisible({ timeout: 20000 })
  await nameField.fill(name)
  await page.getByRole('button', { name: '그룹 만들기' }).click()
  // Lands on the new group's detail page.
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible({ timeout: 15000 })
  return name
}
