/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        // Mapped to CSS custom properties in tokens.css so themes can switch.
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        text: 'rgb(var(--c-text) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        'brand-soft': 'rgb(var(--c-brand-soft) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        // Per-track accent colors
        algebra: 'rgb(var(--c-algebra) / <alpha-value>)',
        geometry: 'rgb(var(--c-geometry) / <alpha-value>)',
        trig: 'rgb(var(--c-trig) / <alpha-value>)',
        precalc: 'rgb(var(--c-precalc) / <alpha-value>)',
        calculus: 'rgb(var(--c-calculus) / <alpha-value>)',
        linalg: 'rgb(var(--c-linalg) / <alpha-value>)',
        probability: 'rgb(var(--c-probability) / <alpha-value>)',
        statistics: 'rgb(var(--c-statistics) / <alpha-value>)',
        optimization: 'rgb(var(--c-optimization) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        prose: '46rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'pop-in': 'pop-in 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
