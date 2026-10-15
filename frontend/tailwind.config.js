/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // The OSBMarquee band. `--gap` is the track gutter (set by the class)
      // and `--duration` the speed (set from config), so one keyframe pair
      // serves every speed and both travel directions. `reverse` lives in
      // the shorthand for the left-to-right variant: a separate
      // `animation-direction` longhand would be reset by the shorthand.
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - var(--gap)))' },
        },
      },
      animation: {
        marquee: 'marquee var(--duration, 35s) linear infinite',
        'marquee-reverse': 'marquee var(--duration, 35s) linear infinite reverse',
      },
    },
  },
  // shadcn dialog animations (animate-in, fade-in-0, zoom-in-95, ...) used
  // by the overlay shells we vendor (osb/OSBDialog, osb/OSBSheet).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require('tailwindcss-animate')],
}
