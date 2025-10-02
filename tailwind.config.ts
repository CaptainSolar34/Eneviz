import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f8ff",
          100: "#e0efff",
          200: "#b9dbff",
          300: "#8ac2ff",
          400: "#54a2ff",
          500: "#2f82f6",
          600: "#1f64d4",
          700: "#164fb1",
          800: "#143f8f",
          900: "#132f6a"
        }
      }
    }
  },
  plugins: [],
};

export default config;
