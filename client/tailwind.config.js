/** @type {import('tailwindcss').Config} */
// Frondly design tokens — Cozy Botanical. Single source of styling truth.
// See docs/design-tokens.md. Never hardcode hex/font in components; use these classes.
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        paper: "#EEF1E9",
        surface: "#F7F8F3",
        forest: "#20322A",
        secondary: "#7A7F76",
        citron: "#C7D64F",
        sage: "#BFD0A8",
        mintBg: "#E4EAD8",
        leafText: "#5C7E4A",
        rust: "#C8553D",
        blushBg: "#F2DDD4",
        stoneBg: "#ECEEE8",
        border: "#DCE2D2",
        onDarkSecondary: "#C3CDBE",
      },
      fontFamily: {
        display: ["Fraunces"],
        body: ["Mulish"],
      },
    },
  },
  plugins: [],
};
