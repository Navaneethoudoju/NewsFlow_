/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'Source Serif 4'", "ui-serif", "Georgia", "serif"],
        sans: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        paper: {
          DEFAULT: "#F6F4EE",
          dim: "#EFEBE1",
        },
        ink: {
          DEFAULT: "#1B2430",
          light: "#4A5568",
          faint: "#7C8798",
        },
        rule: "#D9D3C5",
        masthead: {
          DEFAULT: "#8F2A1E",
          dark: "#6E2016",
          light: "#A94435",
        },
        status: {
          draft: "#6B7280",
          review: "#A6740A",
          approved: "#0F766E",
          scheduled: "#4338CA",
          published: "#15803D",
          overdue: "#B91C1C",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(27, 36, 48, 0.06), 0 1px 0 rgba(27,36,48,0.04)",
      },
    },
  },
  plugins: [],
};
