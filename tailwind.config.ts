import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101014",
        paper: "#FAF7F0",
        marker: {
          yellow: "#FFE600",
          lime: "#C6FF3D",
          pink: "#FF3D81",
          coral: "#FF5C35",
          blue: "#3D5AFF",
          sky: "#37C2FF",
          purple: "#8A5CFF",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        blob: "42% 58% 63% 37% / 41% 44% 56% 59%",
      },
      boxShadow: {
        pop: "6px 6px 0 0 #101014",
        "pop-lg": "10px 10px 0 0 #101014",
      },
      keyframes: {
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "swipe-in": {
          "0%": { transform: "scaleX(0)", transformOrigin: "left" },
          "100%": { transform: "scaleX(1)", transformOrigin: "left" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(2deg)" },
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        "swipe-in": "swipe-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        float: "float 6s ease-in-out infinite",
        wiggle: "wiggle 0.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
