/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        brand: {
          bg: '#F4F6FA',
          surface2: '#EEF1F7',
          primary: '#1A6BFF',
          'primary-light': '#E8F0FF',
          accent: '#FF6B35',
          'accent-light': '#FFF0EA',
          border: '#E2E8F0',
        },
      },
    },
  },
  plugins: [],
}