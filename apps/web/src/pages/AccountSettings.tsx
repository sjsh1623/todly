import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Button, ColorPicker, PushHeader, StatusBar, TextField } from '../shared/ui'
import { useAuthStore } from '../features/auth'
import { PROFILE_COLOR_TO_AVATAR, type ProfileColor } from '../features/auth/types'
import {
  getSettingsErrorMessage,
  settingsApi,
  useChangePassword,
  useConnectedAccounts,
  useDeleteAccount,
  useUpdateMe,
} from '../features/settings'

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2CBD8" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export default function AccountSettings() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const updateMe = useUpdateMe()
  const connected = useConnectedAccounts()

  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [profileColor, setProfileColor] = useState<ProfileColor>(user?.profileColor ?? 'blue')

  const [pwOpen, setPwOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const startEdit = () => {
    setNickname(user?.nickname ?? '')
    setProfileColor(user?.profileColor ?? 'blue')
    setEditing(true)
  }

  const saveProfile = () => {
    const trimmed = nickname.trim()
    if (!trimmed) return
    updateMe.mutate(
      { nickname: trimmed, profileColor },
      { onSuccess: () => setEditing(false) },
    )
  }

  const handleExport = async () => {
    setExportError(null)
    setExporting(true)
    try {
      await settingsApi.exportData()
    } catch (e) {
      setExportError(getSettingsErrorMessage(e, '내보내기에 실패했어요'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader title="계정" onBack={() => navigate(-1)} />

      <div style={{ padding: '8px 22px 40px' }}>
        {/* Profile row / inline edit */}
        {editing ? (
          <div style={{ background: 'var(--color-card)', borderRadius: 20, padding: 18, boxShadow: '0 6px 20px rgba(17,40,86,.06)', marginBottom: 22 }}>
            <div className="flex items-center" style={{ gap: 13, marginBottom: 16 }}>
              <Avatar initial={nickname.charAt(0) || '?'} color={PROFILE_COLOR_TO_AVATAR[profileColor]} size={48} gradient />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)' }}>@{user?.username}</div>
              </div>
            </div>
            <TextField label="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7C8AA0', margin: '0 0 10px 2px' }}>프로필 색상</div>
            <div style={{ marginBottom: 16 }}>
              <ColorPicker value={profileColor} onChange={setProfileColor} />
            </div>
            <div className="flex" style={{ gap: 10 }}>
              <Button variant="secondary" onClick={() => setEditing(false)} style={{ height: 48 }}>취소</Button>
              <Button onClick={saveProfile} disabled={updateMe.isPending || !nickname.trim()} style={{ height: 48 }}>
                {updateMe.isPending ? '저장 중…' : '저장'}
              </Button>
            </div>
            {updateMe.isError && (
              <p role="alert" style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: 'var(--color-due)' }}>
                {getSettingsErrorMessage(updateMe.error)}
              </p>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--color-card)', borderRadius: 20, padding: '14px 16px', boxShadow: '0 6px 20px rgba(17,40,86,.06)', display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
            {user && <Avatar initial={user.nickname.charAt(0) || '?'} color={PROFILE_COLOR_TO_AVATAR[user.profileColor]} size={48} gradient />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--color-text)' }}>{user?.nickname}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)' }}>@{user?.username}</div>
            </div>
            <button
              type="button"
              onClick={startEdit}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-primary-strong)', background: 'var(--color-primary-tint)', padding: '7px 13px', borderRadius: 12 }}
            >
              편집
            </button>
          </div>
        )}

        {/* Account rows */}
        <div style={{ background: 'var(--color-card)', borderRadius: 22, padding: '2px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)', marginBottom: 22 }}>
          <div className="flex items-center justify-between" style={{ padding: '16px 0', borderBottom: '1px solid #F0F3F8' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>이메일</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-subtle)' }}>{user?.email}</span>
          </div>

          <button
            type="button"
            onClick={() => setPwOpen(true)}
            className="w-full flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ padding: '16px 0', borderBottom: '1px solid #F0F3F8' }}
          >
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>비밀번호 변경</span>
            <Chevron />
          </button>

          <div className="flex items-center justify-between" style={{ padding: '16px 0', borderBottom: '1px solid #F0F3F8' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>연결된 계정</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-subtle)' }}>
              {connected.isLoading
                ? '불러오는 중…'
                : connected.data && connected.data.length > 0
                ? connected.data.map((a) => a.provider).join(', ')
                : '없음'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            style={{ padding: '16px 0' }}
          >
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{exporting ? '내보내는 중…' : '데이터 내보내기'}</span>
            <Chevron />
          </button>
        </div>
        {exportError && (
          <p role="alert" style={{ margin: '-12px 4px 22px', fontSize: 12.5, fontWeight: 600, color: 'var(--color-due)' }}>{exportError}</p>
        )}

        {/* 계정 삭제 */}
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="w-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ height: 52, borderRadius: 16, background: 'var(--color-card)', boxShadow: '0 5px 16px rgba(17,40,86,.05)', color: '#FF6B6B', fontSize: 14.5, fontWeight: 800, gap: 8 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
          </svg>
          계정 삭제
        </button>
      </div>

      {pwOpen && <PasswordSheet onClose={() => setPwOpen(false)} />}
      {deleteOpen && (
        <DeleteSheet
          hasPassword={!connected.data || connected.data.length === 0}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  )
}

function SheetShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(15,23,34,.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{ maxWidth: 420, background: 'var(--color-card)', borderRadius: '24px 24px 0 0', padding: '24px 22px 30px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const changePassword = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = () => {
    setError(null)
    if (next.length < 8) {
      setError('새 비밀번호는 8자 이상이어야 해요')
      return
    }
    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다')
      return
    }
    changePassword.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => setDone(true),
        onError: (e) => setError(getSettingsErrorMessage(e)),
      },
    )
  }

  return (
    <SheetShell onClose={onClose}>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)', marginBottom: 18 }}>비밀번호 변경</div>
      {done ? (
        <>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 20 }}>비밀번호가 변경되었어요.</p>
          <Button onClick={onClose}>확인</Button>
        </>
      ) : (
        <>
          <TextField label="현재 비밀번호" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ marginBottom: 14 }} />
          <TextField label="새 비밀번호" type="password" value={next} onChange={(e) => setNext(e.target.value)} style={{ marginBottom: 14 }} />
          <TextField label="새 비밀번호 확인" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ marginBottom: error ? 8 : 18 }} />
          {error && <p role="alert" style={{ margin: '0 0 14px 2px', fontSize: 12.5, fontWeight: 600, color: 'var(--color-due)' }}>{error}</p>}
          <div className="flex" style={{ gap: 10 }}>
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button onClick={submit} disabled={changePassword.isPending || !current || !next}>
              {changePassword.isPending ? '변경 중…' : '변경'}
            </Button>
          </div>
        </>
      )}
    </SheetShell>
  )
}

function DeleteSheet({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const deleteAccount = useDeleteAccount()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    deleteAccount.mutate(hasPassword ? password : undefined, {
      onSuccess: () => navigate('/login', { replace: true }),
      onError: (e) => setError(getSettingsErrorMessage(e, '계정 삭제에 실패했어요')),
    })
  }

  return (
    <SheetShell onClose={onClose}>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)', marginBottom: 10 }}>계정 삭제</div>
      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 18 }}>
        계정과 모든 데이터가 영구적으로 삭제돼요. 이 작업은 되돌릴 수 없어요.
      </p>
      {hasPassword && (
        <TextField label="비밀번호 확인" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: error ? 8 : 18 }} />
      )}
      {error && <p role="alert" style={{ margin: '0 0 14px 2px', fontSize: 12.5, fontWeight: 600, color: 'var(--color-due)' }}>{error}</p>}
      <div className="flex" style={{ gap: 10 }}>
        <Button variant="secondary" onClick={onClose}>취소</Button>
        <Button
          onClick={submit}
          disabled={deleteAccount.isPending || (hasPassword && !password)}
          style={{ background: '#FF6B6B' }}
        >
          {deleteAccount.isPending ? '삭제 중…' : '삭제'}
        </Button>
      </div>
    </SheetShell>
  )
}
