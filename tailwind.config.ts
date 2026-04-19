import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 24px 90px rgba(255, 126, 95, 0.18)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      colors: {
        ink: "#101010",
        coral: "#ff7e5f",
        apricot: "#ffb26b",
        cream: "#fff6ea",
        sage: "#d4f0df",
        ocean: "#113c5d"
      },
      fontFamily: {
        display: [
          "var(--font-space-grotesk)",
          "sans-serif"
        ],
        body: [
          "var(--font-noto-sans-kr)",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
