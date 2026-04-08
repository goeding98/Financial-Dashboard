/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gs: {
          navy:       '#003B6F',
          blue:       '#1666B0',
          'blue-mid': '#2A7DE1',
          'blue-lt':  '#EBF2FB',
          gold:       '#B09756',
          green:      '#1B7F4A',
          'green-lt': '#E6F4ED',
          red:        '#B91C1C',
          'red-lt':   '#FEE2E2',
          bg:         '#F4F5F7',
          card:       '#FFFFFF',
          border:     '#DFE2E8',
          text:       '#1C2B3A',
          muted:      '#6B7A8D',
          divider:    '#EBEDF0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
