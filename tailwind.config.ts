import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      /* FM-3: Map CSS variable tokens to Tailwind utility classes.
         Usage: bg-surface-1, text-text-secondary, border-border-subtle, etc. */
      colors: {
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          muted: 'var(--border-muted)',
          focus: 'var(--border-focus)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
        },
        accent: {
          base: 'var(--accent-base)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
        },
        status: {
          info: 'var(--status-info)',
          'info-bg': 'var(--status-info-bg)',
          warning: 'var(--status-warning)',
          'warning-bg': 'var(--status-warning-bg)',
          error: 'var(--status-error)',
          'error-bg': 'var(--status-error-bg)',
        },
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        elevated: 'var(--shadow-elevated)',
        deep: 'var(--shadow-deep)',
      },
      transitionDuration: {
        interaction: 'var(--duration-fast)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
      },
    },
  },
  plugins: [],
} satisfies Config
