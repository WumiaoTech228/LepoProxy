/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        app: {
          base: 'var(--app-base)',
          surface: 'var(--app-surface)',
          border: 'var(--app-border)',
          text: 'var(--app-text)',
          muted: 'var(--app-muted)',
          hover: 'var(--app-hover)',
          primary: '#0284c7',
          success: '#16a34a',
        }
      }
    }
  },
  plugins: [],
}
