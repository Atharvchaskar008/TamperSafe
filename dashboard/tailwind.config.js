/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ts-black': '#050608',
        'ts-black-subtle': '#0a0c10',
        'ts-card': 'rgba(14, 18, 24, 0.85)',
        'ts-card-hover': 'rgba(22, 28, 38, 0.95)',
        'ts-red': '#EB0C0D',
        'ts-red-dark': '#b8090a',
        'ts-cyan': '#00f0ff',
        'ts-emerald': '#00e676',
        'ts-amber': '#ffb300',
        'ts-purple': '#b388ff',
        'ts-border': 'rgba(255, 255, 255, 0.08)',
        'ts-border-strong': 'rgba(255, 255, 255, 0.16)',
        'ts-border-red': 'rgba(235, 12, 13, 0.45)',
      },
      fontFamily: {
        sans: ['TWKEverett', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['TWKEverettMono', 'JetBrains Mono', 'SF Mono', 'monospace'],
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(235, 12, 13, 0.35)',
        'glow-cyan': '0 0 15px rgba(0, 240, 255, 0.3)',
        'glow-emerald': '0 0 15px rgba(0, 230, 118, 0.3)',
      }
    },
  },
  plugins: [],
}
