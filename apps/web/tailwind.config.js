/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Background colors
        'bg-primary': '#0d0d0f',
        'bg-secondary': '#131316',
        'bg-tertiary': '#1a1a1f',
        'bg-card': '#16161a',
        'bg-card-hover': '#1c1c21',
        'bg-input': '#0a0a0c',
        // Accent colors
        'accent-primary': '#8b5cf6',
        'accent-primary-hover': '#7c3aed',
        'accent-secondary': '#6366f1',
        // Status colors
        'status-success': '#22c55e',
        'status-warning': '#f59e0b',
        'status-error': '#ef4444',
        'status-info': '#3b82f6',
        'status-idle': '#6b7280',
        // Text colors
        'text-primary': '#f3f4f6',
        'text-secondary': '#9ca3af',
        'text-muted': '#6b7280',
        'text-accent': '#a78bfa',
        // Border colors
        'border-primary': '#2a2a30',
        'border-secondary': '#3a3a42',
        'border-focus': '#8b5cf6',
        // Kanban column colors
        'kanban-queued': '#6b7280',
        'kanban-planning': '#8b5cf6',
        'kanban-designing': '#ec4899',
        'kanban-building': '#3b82f6',
        'kanban-testing': '#22c55e',
        'kanban-diagnosing': '#f59e0b',
        'kanban-bugfix': '#ef4444',
        'kanban-review': '#06b6d4',
        'kanban-done': '#10b981',
        'kanban-blocked': '#dc2626',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      spacing: {
        'header': '40px',
        'left-sidebar': '220px',
        'right-sidebar': '280px',
        'bottom-bar': '60px',
      },
    },
  },
  plugins: [],
};
