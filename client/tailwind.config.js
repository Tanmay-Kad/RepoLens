/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f0f0f",
        surface: "#1a1a1a",
        border: "#2a2a2a",
        text: "#e0e0e0",
        muted: "#888",
        primary: "#7F77DD"
      }
    }
  },
  plugins: []
};
