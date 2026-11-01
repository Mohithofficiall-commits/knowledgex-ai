/** @type {import('tailwindcss').Config} */
const ramp = (name) => ({
  50: `var(--${name}-50)`,
  100: `var(--${name}-100)`,
  200: `var(--${name}-200)`,
  300: `var(--${name}-300)`,
  400: `var(--${name}-400)`,
  500: `var(--${name}-500)`,
  600: `var(--${name}-600)`,
  700: `var(--${name}-700)`,
  800: `var(--${name}-800)`,
  900: `var(--${name}-900)`,
});

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: ramp('primary'),
        secondary: ramp('secondary'),
        accent: ramp('accent'),
        warm: ramp('warm'),
        lavender: ramp('lavender'),
        ink: ramp('ink'),
        brand: {
          green: '#53B54F',
          orange: '#F09B04',
          purple: '#C6A9D8',
          cyan: '#14F6FA',
          lavender: '#E4D8F1',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Tamil"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.05)',
        lift: '0 4px 6px rgba(15, 23, 42, 0.04), 0 20px 40px rgba(15, 23, 42, 0.08)',
        glow: '0 0 24px rgba(20, 246, 250, 0.15)',
        'glow-green': '0 0 24px rgba(83, 181, 79, 0.18)',
        'glow-purple': '0 0 24px rgba(198, 169, 216, 0.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.03)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.35s ease-out both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-slow': 'pulseSlow 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
