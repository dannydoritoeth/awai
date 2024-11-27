import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
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

export default config;