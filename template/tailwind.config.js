/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // The OSBMarquee band: one keyframe pair serves every speed and both
      // travel directions (see the builder's tailwind.config.js).
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
  // by the shipped OSBModal runtime.
  plugins: [require('tailwindcss-animate')],
}
