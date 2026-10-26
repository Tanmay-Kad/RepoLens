/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          app: 'var(--surface-app)',
          panel: 'var(--surface-panel)',
          raised: 'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
        },
        status: {
          danger: 'var(--danger)',
          'danger-subtle': 'var(--danger-subtle)',
          warning: 'var(--warning)',
          'warning-subtle': 'var(--warning-subtle)',
          success: 'var(--success)',
          'success-subtle': 'var(--success-subtle)',
          info: 'var(--info)',
          'info-subtle': 'var(--info-subtle)',
        },
        node: {
          entry: 'var(--node-entry)',
          important: 'var(--node-important)',
          normal: 'var(--node-normal)',
          test: 'var(--node-test)',
          isolated: 'var(--node-isolated)',
          cycle: 'var(--node-cycle)',
        },
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
      },
      transitionDuration: {
        DEFAULT: '140ms',
        fast: '140ms',
      },
    },
  },
  plugins: [],
}
