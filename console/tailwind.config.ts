import defaultTheme from "tailwindcss/defaultTheme";
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        brand: {
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#627d98",
          500: "#1e3a5f",
          600: "#1a3354",
          700: "#152b48",
          800: "#11233b",
          900: "#0d1b2e",
          950: "#0a1128",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
