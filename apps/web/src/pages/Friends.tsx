import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar, PushHeader, StatusBar, EmptyState, SkeletonList } from '../shared/ui'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import {
  getFriendErrorMessage,
  presenceText,
  presenceKind,
  useAcceptRequest,
  useBlock,
  useDeclineRequest,
  useFriendRequests,
  useFriends,
  useSendRequest,
  useUnfriend,
  useUserSearch,
} from '../features/friends'
import type { Friend, UserSearchResult } from '../features/friends'

export default function Friends() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const friends = useFriends()
  const requests = useFriendRequests()
  const search = useUserSearch(query)

  const sendRequest = useSendRequest()
  const accept = useAcceptRequest()
  const decline = useDeclineRequest()
  const unfriend = useUnfriend()
  const block = useBlock()

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
  const incoming = requests.data?.incoming ?? []
  const friendList = friends.data ?? []

  const handleSend = (username: string) => {
    sendRequest.mutate(username, {
      onSuccess: (res) =>
        showToast('status' in res && res.status === 'accepted' ? t('friends.toastBecameFriends') : t('friends.toastRequestSent')),
      onError: (err) => showToast(getFriendErrorMessage(err)),
    })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader
        title={t('friends.title')}
        onBack={() => navigate(-1)}
        trailing={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1366CE" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
            <path d="M18 8v6M21 11h-6" />
          </svg>
        }
      />

      <div style={{ padding: '8px 22px 24px' }}>
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
            aria-label={t('friends.searchLabel')}
            placeholder={t('friends.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-[#B4BFCE]"
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}
          />
        </div>

        {showingSearch ? (
          <SearchResults
            results={search.data}
            isLoading={search.isLoading}
            isError={search.isError}
            onSend={handleSend}
            pendingUsername={sendRequest.isPending ? sendRequest.variables : undefined}
          />
        ) : (
          <>
            {/* Incoming requests */}
            {incoming.length > 0 && (
              <section style={{ marginBottom: 22 }}>
                <div className="flex items-center" style={{ gap: 7, margin: '0 0 11px 4px' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0' }}>{t('friends.requestsHeading')}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#FF6B6B', padding: '1px 7px', borderRadius: 9 }}>
                    {incoming.length}
                  </span>
                </div>
                <div style={{ background: '#fff', borderRadius: 22, padding: '2px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)' }}>
                  {incoming.map((req, i) => (
                    <div
                      key={req.id}
                      className="flex items-center"
                      style={{ gap: 12, padding: '12px 0', borderBottom: i < incoming.length - 1 ? '1px solid #F0F3F8' : 'none' }}
                    >
                      <Avatar
                        initial={(req.fromUser.nickname || req.fromUser.username).charAt(0)}
                        color={PROFILE_COLOR_TO_AVATAR[req.fromUser.profileColor]}
                        size={46}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="truncate" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--color-text)' }}>
                          {req.fromUser.nickname}
                        </div>
                        <div className="truncate" style={{ fontSize: 11.5, fontWeight: 600, color: '#9AA7BC' }}>
                          @{req.fromUser.username}
                        </div>
                      </div>
                      <div className="flex" style={{ gap: 7, flex: 'none' }}>
                        <button
                          type="button"
                          onClick={() =>
                            accept.mutate(req.id, { onError: (err) => showToast(getFriendErrorMessage(err)) })
                          }
                          disabled={accept.isPending}
                          style={{ padding: '0 16px', height: 34, borderRadius: 12, background: '#1366CE', color: '#fff', fontSize: 12, fontWeight: 800 }}
                        >
                          {t('friends.accept')}
                        </button>
                        <button
                          type="button"
                          aria-label={t('friends.declineAria', { name: req.fromUser.nickname })}
                          onClick={() =>
                            decline.mutate(req.id, { onError: (err) => showToast(getFriendErrorMessage(err)) })
                          }
                          disabled={decline.isPending}
                          className="flex items-center justify-center"
                          style={{ width: 34, height: 34, borderRadius: 12, background: '#F0F3F8' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA7BC" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Friend list */}
            <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '8px 0 13px 4px' }}>
              {t('friends.myFriends', { count: friendList.length })}
            </div>
            {friends.isLoading ? (
              <SkeletonList rows={3} />
            ) : friendList.length === 0 ? (
              <EmptyState
                title={t('empty.friendsTitle')}
                subtitle={t('friends.emptySubtitle')}
              />
            ) : (
              <div style={{ background: '#fff', borderRadius: 22, padding: '8px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)' }}>
                {friendList.map((f, i) => (
                  <FriendRow
                    key={f.userId}
                    friend={f}
                    last={i === friendList.length - 1}
                    onUnfriend={() =>
                      unfriend.mutate(f.userId, {
                        onSuccess: () => showToast(t('friends.toastUnfriended')),
                        onError: (err) => showToast(getFriendErrorMessage(err)),
                      })
                    }
                    onBlock={() =>
                      block.mutate(f.userId, {
                        onSuccess: () => showToast(t('friends.toastBlocked')),
                        onError: (err) => showToast(getFriendErrorMessage(err)),
                      })
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2"
          style={{ bottom: 40, zIndex: 50, background: 'rgba(20,35,58,.94)', color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '12px 18px', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

/** A single confirmed-friend row with presence text + overflow menu. */
function FriendRow({
  friend,
  last,
  onUnfriend,
  onBlock,
}: {
  friend: Friend
  last: boolean
  onUnfriend: () => void
  onBlock: () => void
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const status = presenceText(friend.online, friend.lastActiveAt)
  const isActive = presenceKind(friend.online, friend.lastActiveAt) !== 'offline'

  return (
    <div
      className="flex items-center"
      style={{ gap: 12, padding: '12px 0', borderBottom: last ? 'none' : '1px solid #F0F3F8' }}
    >
      <div className="relative" style={{ width: 46, height: 46, flex: 'none' }}>
        <Avatar
          initial={(friend.nickname || friend.username).charAt(0)}
          color={PROFILE_COLOR_TO_AVATAR[friend.profileColor]}
          size={46}
        />
        {friend.online && (
          <span
            aria-hidden="true"
            style={{ position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: '50%', background: '#46D38A', border: '2.5px solid #fff' }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--color-text)' }}>
          {friend.nickname}
        </div>
        <div className="truncate" style={{ fontSize: 11.5, fontWeight: 600, color: isActive ? '#159B89' : '#9AA7BC' }}>
          {status}
        </div>
      </div>
      <div className="relative" style={{ flex: 'none' }}>
        <button
          type="button"
          aria-label={t('friends.moreAria', { name: friend.nickname })}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ width: 28, height: 28, borderRadius: 8 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#C2CBD8" aria-hidden="true">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0" style={{ zIndex: 30 }} onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div
              role="menu"
              className="absolute right-0"
              style={{ top: 32, zIndex: 40, background: '#fff', borderRadius: 14, minWidth: 130, padding: 6, boxShadow: '0 12px 30px rgba(17,40,86,.18)' }}
            >
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onUnfriend()
                }}
                className="w-full text-left"
                style={{ padding: '11px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}
              >
                {t('friends.unfriend')}
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onBlock()
                }}
                className="w-full text-left"
                style={{ padding: '11px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: 'var(--color-due)' }}
              >
                {t('friends.block')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Search-result list with relation-aware action buttons. */
function SearchResults({
  results,
  isLoading,
  isError,
  onSend,
  pendingUsername,
}: {
  results: UserSearchResult[] | undefined
  isLoading: boolean
  isError: boolean
  onSend: (username: string) => void
  pendingUsername?: string
}) {
  const { t } = useTranslation()
  if (isLoading) {
    return <SkeletonList rows={3} />
  }
  if (isError) {
    return <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-due)', padding: '8px 4px' }}>{t('friends.searchFailed')}</div>
  }
  if (!results || results.length === 0) {
    return (
      <EmptyState
        bordered={false}
        title={t('friends.searchEmptyTitle')}
        subtitle={t('friends.searchEmptySubtitle')}
      />
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 22, padding: '8px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)' }}>
      {results.map((u, i) => (
        <div
          key={u.userId}
          className="flex items-center"
          style={{ gap: 12, padding: '12px 0', borderBottom: i < results.length - 1 ? '1px solid #F0F3F8' : 'none' }}
        >
          <Avatar
            initial={(u.nickname || u.username).charAt(0)}
            color={PROFILE_COLOR_TO_AVATAR[u.profileColor]}
            size={46}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="truncate" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--color-text)' }}>
              {u.nickname}
            </div>
            <div className="truncate" style={{ fontSize: 11.5, fontWeight: 600, color: '#9AA7BC' }}>
              @{u.username}
              {u.sharedGroups > 0 ? t('friends.sharedGroups', { count: u.sharedGroups }) : ''}
            </div>
          </div>
          <RelationButton
            user={u}
            onSend={() => onSend(u.username)}
            pending={pendingUsername === u.username}
          />
        </div>
      ))}
    </div>
  )
}

/** Renders the correct action for a search result based on its relation. */
function RelationButton({
  user,
  onSend,
  pending,
}: {
  user: UserSearchResult
  onSend: () => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const base = { flex: 'none' as const, padding: '0 16px', height: 34, borderRadius: 12, fontSize: 12, fontWeight: 800 }

  if (user.relation === 'friend') {
    return (
      <span style={{ ...base, display: 'inline-flex', alignItems: 'center', background: '#EAF7F2', color: '#159B89' }}>
        {t('friends.relationFriend')}
      </span>
    )
  }
  if (user.relation === 'outgoing') {
    return (
      <button type="button" disabled style={{ ...base, background: '#F0F3F8', color: '#9AA7BC' }}>
        {t('friends.relationRequested')}
      </button>
    )
  }
  if (user.relation === 'incoming') {
    // The search result does not carry a request id; route to accept by sending
    // back a request, which the API auto-accepts (reverse auto-accept).
    return (
      <button
        type="button"
        onClick={onSend}
        disabled={pending}
        style={{ ...base, background: '#1366CE', color: '#fff' }}
      >
        {t('friends.accept')}
      </button>
    )
  }
  if (user.relation === 'blocked') {
    return (
      <span style={{ ...base, display: 'inline-flex', alignItems: 'center', background: '#F0F3F8', color: '#9AA7BC' }}>
        {t('friends.relationBlocked')}
      </span>
    )
  }
  // none
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={pending}
      style={{ ...base, background: '#1366CE', color: '#fff' }}
    >
      {pending ? t('friends.requesting') : t('friends.add')}
    </button>
  )
}
