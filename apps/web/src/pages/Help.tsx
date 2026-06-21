import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, PushHeader, StatusBar, TextField } from '../shared/ui'
import { getSettingsErrorMessage, useContact } from '../features/settings'

type Faq = { q: string; a: string }

// FAQ entries by i18n key suffix; resolved to localized strings in the component.
const FAQ_KEYS = [
  { qKey: 'help.faq1Q', aKey: 'help.faq1A' },
  { qKey: 'help.faq2Q', aKey: 'help.faq2A' },
  { qKey: 'help.faq3Q', aKey: 'help.faq3A' },
  { qKey: 'help.faq4Q', aKey: 'help.faq4A' },
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
  const { t } = useTranslation()
  const contact = useContact()
  const faqs: Faq[] = FAQ_KEYS.map(({ qKey, aKey }) => ({ q: t(qKey), a: t(aKey) }))
  const [open, setOpen] = useState<number | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = () => {
    setError(null)
    if (!subject.trim() || !body.trim()) {
      setError(t('help.fillSubjectBody'))
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
        onError: (e) => setError(getSettingsErrorMessage(e, t('help.contactFailed'))),
      },
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader title={t('help.title')} onBack={() => navigate(-1)} />

      <div style={{ padding: '8px 22px 40px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', margin: '4px 2px 18px' }}>{t('help.heading')}</div>

        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '0 0 11px 4px' }}>{t('help.faqSection')}</div>
        <div style={{ background: 'var(--color-card)', borderRadius: 22, padding: '2px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)', marginBottom: 22 }}>
          {faqs.map((faq, i) => (
            <FaqItem key={faq.q} faq={faq} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </div>

        {contactOpen ? (
          <div style={{ background: 'var(--color-card)', borderRadius: 22, padding: 18, boxShadow: '0 6px 20px rgba(17,40,86,.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', marginBottom: 16 }}>{t('help.contact')}</div>
            {sent ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 18 }}>{t('help.contactReceived')}</p>
                <Button onClick={() => { setSent(false); setContactOpen(false) }}>{t('help.confirm')}</Button>
              </>
            ) : (
              <>
                <TextField label={t('help.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginBottom: 14 }} />
                <div style={{ marginBottom: error ? 8 : 18 }}>
                  <label htmlFor="contact-body" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#7C8AA0', margin: '0 0 8px 2px' }}>{t('help.body')}</label>
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
                  <Button variant="secondary" onClick={() => setContactOpen(false)}>{t('help.cancel')}</Button>
                  <Button onClick={submit} disabled={contact.isPending}>{contact.isPending ? t('help.sending') : t('help.send')}</Button>
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
            {t('help.contact')}
          </button>
        )}
      </div>
    </div>
  )
}
