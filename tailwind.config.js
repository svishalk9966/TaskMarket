/** @type {import('tailwindcss').Config} */
import daisyui from 'daisyui';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#667eea',
        secondary: '#764ba2',
        accent: '#f093fb',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          'primary': '#667eea',
          'secondary': '#764ba2',
          'accent': '#ec7cf7',
          'neutral': '#1f2937',
          'base-100': '#f8fafc',
          'base-200': '#eef2ff',
          'base-300': '#dbe4ff',
          'base-content': '#0f172a',
          'info': '#38bdf8',
          'success': '#10b981',
          'warning': '#f59e0b',
          'error': '#ef4444',
        },
      },
      {
        dark: {
          'primary': '#7c8cff',
          'secondary': '#a879ff',
          'accent': '#f59cff',
          'neutral': '#0f172a',
          'base-100': '#0f172a',
          'base-200': '#152235',
          'base-300': '#1e2d45',
          'base-content': '#e5eefb',
          'info': '#38bdf8',
          'success': '#34d399',
          'warning': '#fbbf24',
          'error': '#f87171',
        },
      },
    ],
  },
};
