import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0F1113', // أعمق طبقة — خلف كل شيء
          800: '#14161A', // الخلفية الأساسية
          700: '#1B1E24', // سطح مرتفع
          600: '#232730', // سطح ثانٍ / حقول الإدخال
          500: '#2E333D', // حدود بارزة
        },
        paper: {
          100: '#E8E6E1', // النص الأساسي
          300: '#B4B1AA', // نص ثانوي واضح
          500: '#8E8C86', // نص ثانوي
          700: '#5F5E59', // نص خافت
        },
        gain: { DEFAULT: '#3FA96A', dim: '#2A6B45', wash: 'rgba(63,169,106,0.12)' },
        loss: { DEFAULT: '#D45C50', dim: '#8C3B33', wash: 'rgba(212,92,80,0.12)' },
        proj: { DEFAULT: '#C9A227', dim: '#7E661A', wash: 'rgba(201,162,39,0.12)' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderColor: {
        rule: 'rgba(232,230,225,0.09)',
        'rule-strong': 'rgba(232,230,225,0.16)',
      },
      maxWidth: { app: '30rem' },
    },
  },
  plugins: [],
} satisfies Config
