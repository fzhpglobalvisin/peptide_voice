import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        panel: '#07111f',
        navy: '#0b1d44',
        cyan: {
          brand: '#3db8d9',
          soft: '#6cc4e6',
          text: '#4fc3f7',
          price: '#6fb7ff',
          faq: '#3ab4f2',
        },
        teal: { foot: '#2a9ab8', deep: '#0f4c5c' },
      },
      fontFamily: {
        head: ['var(--font-head)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        alt: ['var(--font-alt)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { tighter2: '-0.045em' },
      keyframes: {
        ticker: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(1.7)', opacity: '0' },
        },
      },
      animation: {
        ticker: 'ticker 40s linear infinite',
        pulseRing: 'pulseRing 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
