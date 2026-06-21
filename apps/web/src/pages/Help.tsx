import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, PushHeader, StatusBar, TextField } from '../shared/ui'
import { getSettingsErrorMessage, useContact } from '../features/settings'

type Faq = { q: string; a: string }

const FAQS: Faq[] = [
  {
    q: '라이브는 어떻게 시작하나요?',
    a: '투두 상세 화면에서 "라이브 시작" 버튼을 누르면 라이브가 시작돼요. 같은 그룹의 친구들에게 알림이 가고, 함께 라이브 룸에서 집중할 수 있어요.',
  },
  {
    q: '그룹에 멤버를 초대하려면?',
    a: '그룹 상세 화면 우측 상단의 초대 버튼을 누른 뒤, 친구를 선택하거나 초대 링크를 공유하세요. 링크를 받은 사람은 링크를 열어 바로 그룹에 참여할 수 있어요.',
  },
  {
    q: '루틴 알림을 끄려면?',
    a: '설정 · 알림 설정에서 각 알림 종류를 켜고 끌 수 있어요. 라이브 시작, 투두 완료, 댓글, 친구 요청 알림을 개별적으로 조절할 수 있어요.',
  },
  {
    q: '투두에 사진을 추가하려면?',
    a: '투두 상세 화면에서 사진 추가 버튼을 눌러 인증 사진을 첨부할 수 있어요. 완료한 투두에 사진을 더하면 그룹 친구들과 함께 기록을 남길 수 있어요.',
  },
]

function FaqItem({ faq, open, onToggle }: { faq: Faq; open: boolean; onToggle: () => void; }) {
  return (
    <div style={{ borderBottom: '1px solid #F0F3F8' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        style={{ padding: '16px 0', textAlign: 'left', gap: 12 }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{faq.q}</span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2CBD8" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
          style={{ flex: 'none', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease' }}
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {open && (
        <p style={{ padding: '0 0 16px', fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{faq.a}</p>
      )}
    </div>
  )
}

export default function Help() {
  const navigate = useNavigate()
  const contact = useContact()
  const [open, setOpen] = useState<number | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = () => {
    setError(null)
    if (!subject.trim() || !body.trim()) {
      setError('제목과 내용을 입력해 주세요')
      return
    }
    contact.mutate(
      { subject: subject.trim(), body: body.trim() },
      {
        onSuccess: () => {
          setSent(true)
          setSubject('')
          setBody('')
        },
        onError: (e) => setError(getSettingsErrorMessage(e, '문의 전송에 실패했어요')),
      },
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader title="도움말" onBack={() => navigate(-1)} />

      <div style={{ padding: '8px 22px 40px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', margin: '4px 2px 18px' }}>무엇을 도와드릴까요?</div>

        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '0 0 11px 4px' }}>자주 묻는 질문</div>
        <div style={{ background: 'var(--color-card)', borderRadius: 22, padding: '2px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)', marginBottom: 22 }}>
          {FAQS.map((faq, i) => (
            <FaqItem key={faq.q} faq={faq} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </div>

        {contactOpen ? (
          <div style={{ background: 'var(--color-card)', borderRadius: 22, padding: 18, boxShadow: '0 6px 20px rgba(17,40,86,.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', marginBottom: 16 }}>문의하기</div>
            {sent ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 18 }}>문의가 접수되었어요. 빠르게 답변드릴게요!</p>
                <Button onClick={() => { setSent(false); setContactOpen(false) }}>확인</Button>
              </>
            ) : (
              <>
                <TextField label="제목" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginBottom: 14 }} />
                <div style={{ marginBottom: error ? 8 : 18 }}>
                  <label htmlFor="contact-body" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#7C8AA0', margin: '0 0 8px 2px' }}>내용</label>
                  <textarea
                    id="contact-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    className="w-full outline-none focus:ring-2 focus:ring-primary/40"
                    style={{ background: '#fff', border: '1.5px solid #E6ECF4', borderRadius: 16, padding: 16, fontSize: 15, fontWeight: 600, color: 'var(--color-text)', resize: 'vertical' }}
                  />
                </div>
                {error && <p role="alert" style={{ margin: '0 0 14px 2px', fontSize: 12.5, fontWeight: 600, color: 'var(--color-due)' }}>{error}</p>}
                <div className="flex" style={{ gap: 10 }}>
                  <Button variant="secondary" onClick={() => setContactOpen(false)}>취소</Button>
                  <Button onClick={submit} disabled={contact.isPending}>{contact.isPending ? '전송 중…' : '전송'}</Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="w-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ height: 54, borderRadius: 16, background: 'var(--color-primary-strong)', color: '#fff', fontSize: 15, fontWeight: 800, gap: 8 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            문의하기
          </button>
        )}
      </div>
    </div>
  )
}
