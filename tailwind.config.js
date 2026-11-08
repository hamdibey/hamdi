/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          950: "#04170f",
          900: "#062317",
          800: "#0a3323",
          700: "#0e4530",
          600: "#135a3d",
          500: "#1a7a52",
        },
        wood: {
          950: "#170d08",
          900: "#241610",
          800: "#33211a",
          700: "#4a2f22",
          600: "#5f3d2c",
        },
        ivory: {
          DEFAULT: "#f4eddc",
          dark: "#e6dcc2",
        },
        gold: {
          300: "#f2d98d",
          400: "#e8c15a",
          500: "#d4a53c",
          600: "#b8862a",
          700: "#8f6718",
        },
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
        body: ['"Segoe UI"', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        tile: "0 2px 4px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.7)",
        felt: "inset 0 0 120px rgba(0,0,0,.55)",
        pop: "0 10px 30px rgba(0,0,0,.55)",
      },
      keyframes: {
        floatUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseGold: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(232,193,90,.5)" },
          "50%": { boxShadow: "0 0 0 6px rgba(232,193,90,0)" },
        },
      },
      animation: {
        floatUp: "floatUp .25s ease-out",
        pulseGold: "pulseGold 2s infinite",
      },
    },
  },
  plugins: [],
}
