/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0C0A09', // stone-950: text
        // Cobalt: the one accent. Action, focus, selection, links, the logo mark.
        // Never used for maintenance status (red / amber / green own that).
        accent: {
          50: '#EFF2FE',
          100: '#DFE5FD',
          200: '#C3CEFB',
          300: '#9AAEF7',
          500: '#4A66EA',
          600: '#2F4FE0', // 6.3:1 on white — safe for text and white-on-accent
          700: '#2540BF',
          800: '#1F3599',
        },
      },
    },
  },
  plugins: [],
};
