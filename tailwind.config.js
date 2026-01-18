/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: This includes the app/ and src/ directories
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};

