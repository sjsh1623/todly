/** The faux iOS status bar shown at the top of each phone-frame screen. */
export function StatusBar() {
  return (
    <div
      className="relative flex items-center justify-between"
      style={{ height: 54, padding: '17px 30px 0', zIndex: 20 }}
      aria-hidden="true"
    >
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>9:41</span>
      <div className="flex items-center" style={{ gap: 7 }}>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="var(--color-text)">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="4.5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="9" y="3" width="3" height="9" rx="1" />
          <rect x="13.5" y="0.5" width="3" height="11.5" rx="1" />
        </svg>
        <svg width="22" height="12" viewBox="0 0 24 12">
          <rect x="1" y="1" width="19" height="10" rx="3" fill="none" stroke="var(--color-text)" strokeWidth="1.4" opacity=".45" />
          <rect x="3" y="3" width="14" height="6" rx="1.5" fill="var(--color-text)" />
          <rect x="21" y="4" width="2" height="4" rx="1" fill="var(--color-text)" opacity=".5" />
        </svg>
      </div>
    </div>
  )
}
