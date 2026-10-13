import { cn } from '../lib/utils'
import { resolveConfig, type OSBField } from './types'

export type OSBVideoConfig = {
  /** Video file address. Empty shows a placeholder block, same as images. */
  videoSrc: string
  /** Poster frame shown before playback. Empty = browser default. */
  poster: string
  controls: boolean
  autoplay: boolean
  muted: boolean
  loop: boolean
}

export const OSB_VIDEO_DEFAULTS: OSBVideoConfig = {
  videoSrc: '',
  poster: '',
  controls: true,
  autoplay: false,
  muted: false,
  loop: false,
}

export const OSB_VIDEO_FIELDS: OSBField[] = [
  { key: 'videoSrc', label: 'Video web address', hint: 'Empty shows a placeholder block.', kind: 'text', required: true },
  { key: 'poster', label: 'Cover image', hint: 'Shown before the video plays. Optional.', kind: 'text' },
  { key: 'controls', label: 'Playback controls', kind: 'boolean' },
  { key: 'autoplay', label: 'Autoplay', hint: 'Most browsers only autoplay muted videos.', kind: 'boolean' },
  { key: 'muted', label: 'Muted', kind: 'boolean' },
  { key: 'loop', label: 'Loop', kind: 'boolean' },
]

export interface OSBVideoProps {
  config?: Partial<OSBVideoConfig>
  children?: React.ReactNode
}

export default function OSBVideo({ config }: OSBVideoProps) {
  const c = resolveConfig(OSB_VIDEO_DEFAULTS, config)
  // Box is the component: the player (or its placeholder) always fills the
  // grid footprint, so the bounding box never disagrees with the render.
  if (c.videoSrc !== '') {
    return (
      <video
        src={c.videoSrc}
        poster={c.poster !== '' ? c.poster : undefined}
        controls={c.controls}
        autoPlay={c.autoplay}
        muted={c.muted}
        loop={c.loop}
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    )
  }
  return (
    <div
      role="img"
      aria-label="Video placeholder"
      data-testid="osb-video-fallback"
      className={cn('h-full w-full', 'bg-gradient-to-br from-slate-400 to-slate-500')}
    />
  )
}
