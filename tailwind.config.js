/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FAF8F5',
        sand: '#F5F0E8',
        charcoal: '#1A1A1A',
        warmgray: '#6B6560',
        accent: '#FF8D6B',
        'accent-light': '#FFB499',
        success: '#4A7C59',
        warning: '#D4A853',
        danger: '#C4554D',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
