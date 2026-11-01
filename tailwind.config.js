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
          tealDark: '#003135',
          tealDeep: '#024950',
          rust: '#964734',
          cyan: '#0FA4AF',
          ice: '#AFDDE5',
          // Theme Aliases
          green: '#0FA4AF',
          orange: '#964734',
          purple: '#024950',
          lavender: '#AFDDE5',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Tamil"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0, 49, 53, 0.04), 0 8px 24px rgba(0, 49, 53, 0.06)',
        lift: '0 4px 6px rgba(0, 49, 53, 0.05), 0 20px 40px rgba(0, 49, 53, 0.09)',
        glow: '0 0 24px rgba(15, 164, 175, 0.22)',
        'glow-green': '0 0 24px rgba(15, 164, 175, 0.25)',
        'glow-purple': '0 0 24px rgba(2, 73, 80, 0.3)',
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
