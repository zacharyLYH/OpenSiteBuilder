import { useState } from 'react'
import { resolveConfig, type OSBField } from './types'

export type OSBImageConfig = {
  imageSrc: string
  imageAlt: string
}

export const OSB_IMAGE_DEFAULTS: OSBImageConfig = {
  imageSrc: '',
  imageAlt: '',
}

export const OSB_IMAGE_FIELDS: OSBField[] = [
  { key: 'imageSrc', label: 'Image web address', hint: 'Empty shows a placeholder block.', kind: 'text' },
  { key: 'imageAlt', label: 'Image description', hint: 'Read aloud for visitors who cannot see the image.', kind: 'text' },
]

export interface OSBImageProps {
  config?: Partial<OSBImageConfig>
  children?: React.ReactNode
}

export default function OSBImage({ config }: OSBImageProps) {
  const c = resolveConfig(OSB_IMAGE_DEFAULTS, config)
  // A dead link is a user typo, not a missing component: show the same
  // placeholder as an empty src instead of a broken-image icon. The failed
  // URL is remembered (not a boolean) so editing the URL heals the render
  // with no effect; the stored src is untouched throughout.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const broken = failedSrc !== null && failedSrc === c.imageSrc
  // Flow sizing (no grid footprint anymore): real images keep their own
  // ratio at full width; placeholders hold a 16:9 box so the node is visible.
  if (c.imageSrc !== '' && !broken) {
    return (
      <img
        src={c.imageSrc}
        alt={c.imageAlt}
        className="h-auto w-full object-cover"
        onError={() => setFailedSrc(c.imageSrc)}
      />
    )
  }
  return (
    <div
      role="img"
      aria-label="Image placeholder"
      data-testid="osb-image-fallback"
      className="aspect-video w-full bg-gradient-to-br from-slate-300 to-slate-400"
    />
  )
}
