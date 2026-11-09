import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#0f0f12',
        'surface-raised': '#141418',
        'surface-border': 'rgba(255,255,255,0.07)',
        zinc: {
          925: '#0f0f12',
          950: '#09090b',
        },
        brand: {
          amber: '#f59e0b',
          'amber-dim': '#d97706',
          orange: '#ea580c',
          teal: '#0d9488',
          indigo: '#6366f1',
          rose: '#e11d48',
          emerald: '#10b981',
        },
      },
      fontFamily: {
        display: ['Archivo Variable', 'Archivo', 'system-ui', 'sans-serif'],
        sans: ['Archivo Variable', 'Archivo', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Spline Sans Mono Variable', 'Spline Sans Mono', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'amber-radial': 'radial-gradient(ellipse at top, rgba(245,158,11,0.08) 0%, transparent 70%)',
        'hero-glow': 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(245,158,11,0.15), transparent)',
      },
      backgroundSize: {
        'grid': '48px 48px',
      },
      boxShadow: {
        'amber-sm': '0 0 16px -4px rgba(245,158,11,0.3)',
        'amber-md': '0 0 32px -8px rgba(245,158,11,0.4)',
        'indigo-sm': '0 0 16px -4px rgba(99,102,241,0.25)',
        'teal-sm': '0 0 16px -4px rgba(13,148,136,0.25)',
        'inner-border': 'inset 0 1px 0 rgba(255,255,255,0.05)',
        'card': '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'ticker': 'ticker 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
