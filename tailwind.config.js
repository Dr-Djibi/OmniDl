/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "surface": "#121318",
        "on-surface": "#e3e1e9",
        "surface-container-lowest": "#0d0e13",
        "surface-container-low": "#1a1b21",
        "surface-container-high": "#292a2f",
        "outline-variant": "#494454",
        "outline": "#958ea0",
        "primary": "#d0bcff",
        "on-primary": "#3c0091",
        "on-surface-variant": "#cbc3d7",
        "surface-variant": "#34343a",
        "primary-container": "#a078ff",
        "secondary-container": "#03b5d3",
      }
    },
  },
  plugins: [],
}
