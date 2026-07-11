/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#fdfdfb',
        frame: '#e9e9e6',
        ink: '#121210',
        'ink-mid': '#9c9c96',
        'ink-soft': '#52524d',
        rule: '#e4e4e0',
      },
      fontFamily: {
        display: ['"Inter Tight"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        ui: ['Inter', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      maxWidth: {
        wrap: '1360px',
      },
    },
  },
  plugins: [],
}
