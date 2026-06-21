/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-strong': 'var(--color-primary-strong)',
        'primary-deep': 'var(--color-primary-deep)',
        'primary-soft': 'var(--color-primary-soft)',
        'primary-tint': 'var(--color-primary-tint)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'text-subtle': 'var(--color-text-subtle)',
        'nav-inactive': 'var(--color-nav-inactive)',
        bg: 'var(--color-bg)',
        'bg-2': 'var(--color-bg-2)',
        card: 'var(--color-card)',
        due: 'var(--color-due)',
        overdue: 'var(--color-overdue)',
        success: 'var(--color-success)',
        'avatar-blue': 'var(--avatar-blue)',
        'avatar-mint': 'var(--avatar-mint)',
        'avatar-orange': 'var(--avatar-orange)',
        'avatar-purple': 'var(--avatar-purple)',
      },
      fontFamily: {
        sans: ['Pretendard', 'Pretendard Variable', '-apple-system', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
      },
      borderRadius: {
        phone: '28px',
        card: '18px',
        'card-lg': '22px',
        chip: '14px',
      },
    },
  },
  plugins: [],
}
