import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
// Initialize i18n (Korean default) so components and helpers that call t()
// resolve real strings in tests instead of raw keys.
import '../shared/i18n/i18n'

// Unmount React trees between tests to avoid cross-test DOM leakage.
afterEach(() => {
  cleanup()
})
