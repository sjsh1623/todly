import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Button, Card, PushHeader, StatusBar } from '../shared/ui'
import {
  getApiErrorCode,
  getGroupErrorMessage,
  useAcceptInvite,
  useInvitePreview,
} from '../features/groups'

export default function InviteAccept() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { data: preview, isLoading, isError, error } = useInvitePreview(code)
  const accept = useAcceptInvite()

  const expired = preview?.expired || preview?.status === 'expired'

  const handleAccept = () => {
    if (!code) return
    accept.mutate(code, {
      onSuccess: (res) => navigate(`/groups/${res.groupId}`, { replace: true }),
      onError: (err) => {
        // If already a member, just take them into the group.
        if (getApiErrorCode(err) === 'ALREADY_MEMBER' && preview) {
          navigate(`/groups/${preview.group.id}`, { replace: true })
        }
      },
    })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader onBack={() => navigate('/groups')} />

      <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ padding: '0 26px 40px' }}>
        {isLoading && (
          <div className="animate-pulse flex flex-col items-center">
            <div style={{ width: 78, height: 78, borderRadius: 26, background: '#E6ECF4', marginBottom: 20 }} />
            <div style={{ width: 160, height: 18, borderRadius: 6, background: '#E6ECF4', marginBottom: 12 }} />
            <div style={{ width: 110, height: 13, borderRadius: 6, background: '#EDF1F7' }} />
          </div>
        )}

        {isError && (
          <Card style={{ width: '100%', maxWidth: 340, borderRadius: 22, padding: 28 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>
              초대 링크를 확인할 수 없어요
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-subtle)', marginBottom: 20 }}>
              {getGroupErrorMessage(error, '링크가 만료되었거나 존재하지 않아요')}
            </p>
            <Button variant="secondary" style={{ height: 48 }} onClick={() => navigate('/groups')}>
              그룹 목록으로
            </Button>
          </Card>
        )}

        {!isLoading && !isError && preview && (
          <div className="flex flex-col items-center" style={{ width: '100%', maxWidth: 340 }}>
            <div style={{ marginBottom: 22 }}>
              <Avatar initial={preview.group.name.charAt(0)} gradient size={78} />
            </div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-subtle)', marginBottom: 6 }}>
              그룹 초대를 받았어요
            </p>
            <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.5px' }}>
              {preview.group.name}
            </h1>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-subtle)', marginTop: 8, marginBottom: 32 }}>
              멤버 {preview.group.memberCount}명
            </p>

            {expired ? (
              <Card style={{ width: '100%', borderRadius: 18, padding: 18, marginBottom: 16 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-due)' }}>
                  이 초대 링크는 만료되었어요
                </p>
              </Card>
            ) : (
              <>
                {accept.isError && getApiErrorCode(accept.error) !== 'ALREADY_MEMBER' && (
                  <p role="alert" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-due)', marginBottom: 14 }}>
                    {getGroupErrorMessage(accept.error)}
                  </p>
                )}
                <Button
                  disabled={accept.isPending}
                  onClick={handleAccept}
                  style={{ boxShadow: '0 10px 24px rgba(19,102,206,.26)' }}
                >
                  {accept.isPending ? '참여하는 중…' : '그룹 참여하기'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
