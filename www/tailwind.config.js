/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        blue: {
          900: '#002B3D', // Primary brand color
        },
        'hubspot-blue': '#1B2A47',
        'hubspot-dark': '#243456',
      },
      container: {
        center: true,
        padding: '2rem',
      },
    },
  },
  plugins: [],
};