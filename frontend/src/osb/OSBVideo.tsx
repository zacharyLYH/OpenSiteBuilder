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
  // Flow sizing (no grid footprint anymore): the player keeps 16:9 at full
  // width; placeholders hold the same box so the node stays visible.
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
        className="aspect-video w-full object-cover"
      />
    )
  }
  return (
    <div
      role="img"
      aria-label="Video placeholder"
      data-testid="osb-video-fallback"
      className="aspect-video w-full bg-gradient-to-br from-slate-400 to-slate-500"
    />
  )
}
