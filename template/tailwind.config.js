/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  // shadcn dialog animations (animate-in, fade-in-0, zoom-in-95, ...) used
  // by the shipped OSBModal runtime.
  plugins: [require('tailwindcss-animate')],
}
