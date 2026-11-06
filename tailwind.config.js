/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#FFFFFF',
        subtle: '#FAFAFA',
        border: {
          DEFAULT: '#E4E4E7', // zinc-200
          light: '#F4F4F5',
          dark: '#D4D4D8',
        },
        primary: {
          DEFAULT: '#09090B', // zinc-950
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#71717A', // zinc-500
          foreground: '#A1A1AA',
        },
        branch: {
          main: '#18181B',
          blue: '#2563EB',
          emerald: '#059669',
          amber: '#D97706',
          rose: '#E11D48',
          cyan: '#0891B2',
          slate: '#475569',
          purple: '#6D28D9',
        },
      },
      borderRadius: {
        card: '14px',
        sheet: '20px',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 1px rgba(0, 0, 0, 0.02)',
        card: '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.03)',
        floating: '0 12px 32px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
      },
      aspectRatio: {
        '3/4': '3 / 4',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
