import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#EDEFEA",
        muted: "#8B958E",
        paper: "#0E1310",
        surface: "#161C19",
        accent: "#F2A93B",
        signal: "#4FD1A5",
        line: "#2A322D"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;