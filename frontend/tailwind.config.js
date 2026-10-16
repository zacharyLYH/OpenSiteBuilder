/** @type {import('tailwindcss').Config} */
export default {
  // Class-driven dark mode: the SITE theme (light/dark) owns `.dark` on
  // <html>, never the OS. Fresh shadcn `dark:` variants would otherwise follow
  // the visitor's OS and fight the site's own theme.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require('tailwindcss-animate')],
}
