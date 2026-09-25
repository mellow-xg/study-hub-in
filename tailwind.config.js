/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172438",
        accent: "#0f766e",
        accent2: "#d78453",
        glow: "#67cdb4"
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #0f766e 0%, #155d69 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, rgba(15,118,110,0.12) 0%, rgba(215,132,83,0.12) 100%)"
      }
    }
  },
  plugins: []
};