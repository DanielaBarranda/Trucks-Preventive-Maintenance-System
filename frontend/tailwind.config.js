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
        ink: '#0C0A09', // stone-950: text and primary buttons
        brand: '#F97316', // orange-500: the logo dot only
      },
    },
  },
  plugins: [],
};
