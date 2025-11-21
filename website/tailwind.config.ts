import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      typography: {
        DEFAULT: {
          css: {
            h1: {
              marginTop: '0.5em',
              marginBottom: '0.25em',
            },
            h2: {
              marginTop: '1em',
              marginBottom: '0.25em',
            },
            h3: {
              marginTop: '0.75em',
              marginBottom: '0.25em',
            },
            h4: {
              marginTop: '0.5em',
              marginBottom: '0.25em',
            },
            p: {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            ul: {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            ol: {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            li: {
              marginTop: '0.1em',
              marginBottom: '0.1em',
            },
            code: {
              marginTop: '0',
              marginBottom: '0',
            },
            pre: {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
