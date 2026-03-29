import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        glass: {
          light: 'rgba(255, 255, 255, 0.1)',
          medium: 'rgba(255, 255, 255, 0.15)',
          heavy: 'rgba(255, 255, 255, 0.25)',
        },
        accent: {
          DEFAULT: 'var(--accent-color, #6366f1)',
          hover: 'var(--accent-hover, #818cf8)',
        },
      },
      backdropBlur: {
        xs: '2px',
        glass: '12px',
        'glass-heavy': '24px',
      },
      animation: {
        'fade-in': 'fadeIn var(--animation-speed, 0.3s) ease-out',
        'slide-in': 'slideIn var(--animation-speed, 0.3s) ease-out',
        'slide-up': 'slideUp var(--animation-speed, 0.3s) ease-out',
        'scale-in': 'scaleIn var(--animation-speed, 0.3s) ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px var(--accent-color, #6366f1)' },
          '100%': { boxShadow: '0 0 20px var(--accent-color, #6366f1)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
