import type { Config } from "tailwindcss";

// Marker Studio brand palette — sampled from the official logo.
// A disciplined two-color system: Orange + Charcoal on warm neutrals.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: "#FF9100",
          deep: "#E07E00",
          soft: "#FFB347",
          50: "#FFF4E5",
          100: "#FFE3BF",
          200: "#FFCB80",
        },
        charcoal: {
          DEFAULT: "#303030",
          90: "#424242",
          80: "#525252",
          60: "#757575",
          40: "#A8A8A8",
          20: "#D4D4D4",
          10: "#E8E8E8",
        },
        cream: "#F5F2EC",
        paper: "#FAF8F4",
        ink: "#1A1A1A",
      },
      fontFamily: {
        display: ["Poppins", "Thmanyah Serif Display", "system-ui", "sans-serif"],
        body: ["Poppins", "Thmanyah Serif Text", "system-ui", "sans-serif"],
        arabic: ["Thmanyah Serif Text", "Poppins", "Tahoma", "sans-serif"],
        "arabic-display": ["Thmanyah Serif Display", "Poppins", "serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      maxWidth: {
        container: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
