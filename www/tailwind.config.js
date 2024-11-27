/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        blue: {
          900: '#002B3D', // Primary brand color
        }
      },
      container: {
        center: true,
        padding: '2rem',
      },
    },
  },
  plugins: [],
};