import * as React from 'react'
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react'
import { cn } from '../lib/utils'
import { useOSBTheme } from './OSBTheme'
import type { OSBTheme } from './types'

/**
 * Transplanted from shadcn/ui `carousel.tsx` (MIT, built on Embla Carousel).
 * The decomposition (Carousel, CarouselContent, CarouselItem, CarouselPrevious,
 * CarouselNext, `useCarousel`), the Embla wiring, the `role="region"` +
 * `aria-roledescription="carousel"` contract, the arrow-key handling, and the
 * `-ml-4` / `basis-full` / `pl-4` slide rhythm are shadcn's. Deliberate
 * adaptations for OpenSiteBuilder, each marked ADAPT below:
 *
 * ADAPT-1 (icons): `ArrowLeft` / `ArrowRight` from lucide-react are inlined as
 *   ArrowIcon with lucide's exact paths, so the published template needs no
 *   extra dependency (same rule as OSBSheet's XIcon).
 * ADAPT-2 (theme): the arrow controls carry explicit slate classes picked from
 *   the GLOBAL theme (useOSBTheme) instead of shadcn's Button tokens, which
 *   come from ambient CSS vars OSB does not ship. Theme never becomes a
 *   per-component config.
 * ADAPT-3 (fill): like every OSB component, the carousel fills its grid box
 *   (`h-full`), so drop size = render size.
 * ADAPT-4 (snap state): shadcn keeps `canScrollPrev` / `canScrollNext` in
 *   React state, filled by a `select` subscription PLUS a direct call in the
 *   effect body. That direct call is a synchronous setState inside an effect
 *   (react-hooks/set-state-in-effect, and it cascades), and subscribing alone
 *   would miss whatever embla already emitted during init. Embla IS an
 *   external mutable store, so the snap is read with `useSyncExternalStore`:
 *   correct on the first paint, updated on every `select` / `reInit`.
 * ADAPT-5 (setApi): shadcn's `setApi` callback is dropped — the dot indicator
 *   and autoplay read the api through `useCarousel()` from inside the provider,
 *   so nothing needs the callback (keep OSB props minimal, PRD §2.1).
 *
 * This is the ONE carousel base the canvas renders and publish ships (see OSB
 * README: single source of truth — `OSBCarousel.tsx` is the user-facing piece
 * the way `OSBDropdownMenu.tsx` backs `OSBDropdown.tsx`).
 */

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

/** Where the carousel stands right now, as one React value. */
export type CarouselSnap = {
  /** How many snaps (slides, or pages of slides) exist. */
  count: number
  /** Which snap is showing. */
  index: number
  canScrollPrev: boolean
  canScrollNext: boolean
}

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: 'horizontal' | 'vertical'
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: CarouselApi
  scrollPrev: () => void
  scrollNext: () => void
  snap: CarouselSnap
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

export function useCarousel(): CarouselContextProps {
  const context = React.useContext(CarouselContext)
  if (!context) throw new Error('useCarousel must be used within a <Carousel />')
  return context
}

/** The embla api's state as ONE string. Strings compare by value, so the
 * snapshot can be rebuilt on every read without thrashing the store. */
function snapKey(api: CarouselApi): string {
  if (!api) return ''
  return [api.selectedScrollSnap(), api.scrollSnapList().length, api.canScrollPrev() ? 1 : 0, api.canScrollNext() ? 1 : 0].join(':')
}

/** ADAPT-4: read embla as what it is — an external store. */
function useSnap(api: CarouselApi): CarouselSnap {
  const subscribe = React.useCallback(
    (notify: () => void) => {
      if (!api) return () => {}
      api.on('select', notify)
      api.on('reInit', notify)
      return () => {
        api.off('select', notify)
        api.off('reInit', notify)
      }
    },
    [api],
  )
  const read = React.useCallback(() => snapKey(api), [api])
  const key = React.useSyncExternalStore(subscribe, read, () => '')
  const [index, count, prev = '0', next = '0'] = key === '' ? [] : key.split(':')
  return {
    index: Number(index ?? 0),
    count: Number(count ?? 0),
    canScrollPrev: prev === '1',
    canScrollNext: next === '1',
  }
}

const Carousel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & CarouselProps>(
  ({ orientation = 'horizontal', opts, plugins, className, children, ...props }, ref) => {
    const [carouselRef, api] = useEmblaCarousel(
      { ...opts, axis: orientation === 'horizontal' ? 'x' : 'y' },
      plugins,
    )
    const snap = useSnap(api)
    const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api])
    const scrollNext = React.useCallback(() => api?.scrollNext(), [api])
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          scrollPrev()
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          scrollNext()
        }
      },
      [scrollPrev, scrollNext],
    )
    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api,
          opts,
          orientation: orientation || (opts?.axis === 'y' ? 'vertical' : 'horizontal'),
          scrollPrev,
          scrollNext,
          snap,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn('relative', className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    )
  },
)
Carousel.displayName = 'Carousel'

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel()
    return (
      <div ref={carouselRef} className="h-full overflow-hidden">
        <div
          ref={ref}
          className={cn('flex h-full', orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col', className)}
          {...props}
        />
      </div>
    )
  },
)
CarouselContent.displayName = 'CarouselContent'

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarousel()
    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn('min-w-0 shrink-0 grow-0 basis-full', orientation === 'horizontal' ? 'pl-4' : 'pt-4', className)}
        {...props}
      />
    )
  },
)
CarouselItem.displayName = 'CarouselItem'

/** The two arrow skins, in the global theme's palette (ADAPT-2). */
const ARROW_CLASSES: Record<OSBTheme, string> = {
  light: 'border-slate-200 bg-white text-slate-900 hover:bg-slate-100',
  dark: 'border-slate-700 bg-slate-900 text-slate-50 hover:bg-slate-800',
}

const CarouselArrow = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithRef<'button'> & { side: 'left' | 'right'; label: string }>(
  ({ side, label, className, ...props }, ref) => {
    const theme = useOSBTheme()
    const { orientation, scrollPrev, scrollNext, snap } = useCarousel()
    const isPrev = side === 'left'
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        disabled={isPrev ? !snap.canScrollPrev : !snap.canScrollNext}
        onClick={isPrev ? scrollPrev : scrollNext}
        className={cn(
          'absolute z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors disabled:opacity-40',
          ARROW_CLASSES[theme],
          orientation === 'horizontal'
            ? `top-1/2 -translate-y-1/2 ${isPrev ? 'left-2' : 'right-2'}`
            : `left-1/2 -translate-x-1/2 ${isPrev ? 'top-2' : 'bottom-2'}`,
          className,
        )}
        {...props}
      >
        <ArrowIcon side={side} className="h-4 w-4" />
      </button>
    )
  },
)
CarouselArrow.displayName = 'CarouselArrow'

/** Lucide's arrow, inlined (see ADAPT-1). */
function ArrowIcon({ side, className }: { side: 'left' | 'right'; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {side === 'left' ? <path d="m12 19-7-7 7-7M19 12H5" /> : <path d="M5 12h14m-7-7 7 7-7 7" />}
    </svg>
  )
}

const CarouselPrevious = React.forwardRef<HTMLButtonElement, Omit<React.ComponentPropsWithRef<'button'>, 'aria-label'>>(
  (props, ref) => <CarouselArrow ref={ref} side="left" label="Previous slide" {...props} />,
)
CarouselPrevious.displayName = 'CarouselPrevious'

const CarouselNext = React.forwardRef<HTMLButtonElement, Omit<React.ComponentPropsWithRef<'button'>, 'aria-label'>>(
  (props, ref) => <CarouselArrow ref={ref} side="right" label="Next slide" {...props} />,
)
CarouselNext.displayName = 'CarouselNext'

export { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi }
