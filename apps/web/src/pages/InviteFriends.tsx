import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, PushHeader, StatusBar } from '../shared/ui'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import {
  getFriendErrorMessage,
  useFriends,
  useInviteFriends,
  useUserSearch,
} from '../features/friends'
import type { Friend, UserSearchResult } from '../features/friends'

/** A normalized row the multi-select list can render from either source. */
type Candidate = {
  userId: string
  username: string
  nickname: string
  profileColor: Friend['profileColor']
  sharedGroups: number
}

export default function InviteFriends() {
  const { id: groupId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const friends = useFriends()
  const search = useUserSearch(query)
  const invite = useInviteFriends(groupId ?? '')

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const trimmed = query.trim()
  const showingSearch = trimmed.length > 0

  const candidates: Candidate[] = useMemo(() => {
    if (showingSearch) {
      // Only friends can be invited; filter search to existing friends.
      return (search.data ?? [])
        .filter((u: UserSearchResult) => u.relation === 'friend')
        .map((u) => ({
          userId: u.userId,
          username: u.username,
          nickname: u.nickname,
          profileColor: u.profileColor,
          sharedGroups: u.sharedGroups,
        }))
    }
    return (friends.data ?? []).map((f) => ({
      userId: f.userId,
      username: f.username,
      nickname: f.nickname,
      profileColor: f.profileColor,
      sharedGroups: f.sharedGroups,
    }))
  }, [showingSearch, search.data, friends.data])

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const count = selected.size
  const isLoading = showingSearch ? search.isLoading : friends.isLoading

  const handleInvite = () => {
    if (!groupId || count === 0) return
    invite.mutate(Array.from(selected), {
      onSuccess: (res) => {
        const addedN = res.added.length
        const skippedN = res.skipped.length
        const msg =
          skippedN > 0
            ? `${addedN}명 초대 완료 · ${skippedN}명은 이미 멤버예요`
            : `${addedN}명을 초대했어요`
        navigate(`/groups/${groupId}`, { state: { inviteToast: msg } })
      },
      onError: (err) => showToast(getFriendErrorMessage(err)),
    })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader title="친구 초대" onBack={() => navigate(-1)} />

      <div className="flex-1" style={{ padding: '8px 22px 24px' }}>
        {/* Search field */}
        <div
          className="flex items-center focus-within:ring-2 focus-within:ring-primary/40"
          style={{ gap: 10, background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 5px 16px rgba(17,40,86,.05)', marginBottom: 22 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#AEB9CC" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.2-3.2" />
          </svg>
          <input
            type="search"
            aria-label="친구 검색"
            placeholder="이름 또는 아이디 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-[#B4BFCE]"
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}
          />
        </div>

        <div className="flex items-center justify-between" style={{ margin: '0 4px 11px' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0' }}>내 친구</span>
          {count > 0 && (
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1366CE' }}>{count}명 선택됨</span>
          )}
        </div>

        {isLoading ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-subtle)', padding: '8px 4px' }}>불러오는 중…</div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center text-center" style={{ padding: '36px 20px' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)' }}>
              {showingSearch ? '검색 결과가 없어요' : '초대할 친구가 없어요'}
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 22, padding: '2px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)' }}>
            {candidates.map((c, i) => {
              const isSelected = selected.has(c.userId)
              return (
                <button
                  key={c.userId}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggle(c.userId)}
                  className="w-full text-left flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{ gap: 12, padding: '11px 0', borderBottom: i < candidates.length - 1 ? '1px solid #F0F3F8' : 'none' }}
                >
                  <Avatar
                    initial={(c.nickname || c.username).charAt(0)}
                    color={PROFILE_COLOR_TO_AVATAR[c.profileColor]}
                    size={46}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--color-text)' }}>
                      {c.nickname}
                    </div>
                    <div className="truncate" style={{ fontSize: 11.5, fontWeight: 600, color: '#9AA7BC' }}>
                      @{c.username} · 함께한 그룹 {c.sharedGroups}개
                    </div>
                  </div>
                  <span className="sr-only">{isSelected ? '선택됨' : '선택 안 됨'}</span>
                  {isSelected ? (
                    <span
                      className="flex items-center justify-center"
                      aria-hidden="true"
                      style={{ width: 30, height: 30, borderRadius: '50%', background: '#1366CE', flex: 'none' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 6.5" />
                      </svg>
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid #DDE3EC', flex: 'none' }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Sticky invite CTA */}
      <div
        className="sticky bottom-0"
        style={{ padding: '14px 22px 26px', background: 'linear-gradient(180deg,rgba(242,246,252,0),var(--color-bg-2) 32%)' }}
      >
        <button
          type="button"
          onClick={handleInvite}
          disabled={count === 0 || invite.isPending}
          className="w-full flex items-center justify-center disabled:opacity-50"
          style={{ gap: 8, height: 56, borderRadius: 18, background: '#1366CE', color: '#fff', fontSize: 16, fontWeight: 800, boxShadow: '0 10px 24px rgba(19,102,206,.26)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
            <path d="M18 8v6M21 11h-6" />
          </svg>
          {invite.isPending ? '초대하는 중…' : `${count}명 초대하기`}
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2"
          style={{ bottom: 96, zIndex: 50, background: 'rgba(20,35,58,.94)', color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '12px 18px', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
