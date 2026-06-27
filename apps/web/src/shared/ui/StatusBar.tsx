/**
 * Top safe-area spacer for each phone-frame screen.
 *
 * The real OS status bar (clock / wifi / battery) is drawn by the device, so we
 * never render a faux one — we only reserve the notch height via the
 * `safe-area-inset-top` env var (0 on the web / non-notched devices, so it
 * collapses and reclaims the space). It stays transparent on purpose so the
 * screen's own background or gradient paints right up to the very top edge.
 */
export function StatusBar() {
  return <div aria-hidden="true" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
}
