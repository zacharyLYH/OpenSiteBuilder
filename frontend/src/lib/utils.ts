import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The one keyboard-focus ring for the builder's own chrome (buttons, inputs,
 * selects). Written once so every control in `components/ui` signals focus the
 * same way — a keyboard user gets the same cue everywhere, and the cue cannot
 * drift control by control. OSB user components are full-bleed grid boxes and
 * stay visually static here (see osb/README: the box is the component).
 *
 * Note: this is BUILDER chrome, not part of the published OSB vocabulary.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white'
