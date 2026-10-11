import { cn } from '../lib/utils'
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
  // Box is the component: the image (or its placeholder) always fills the
  // grid footprint, so the bounding box never disagrees with the render.
  if (c.imageSrc !== '') {
    return <img src={c.imageSrc} alt={c.imageAlt} className="h-full w-full object-cover" />
  }
  return (
    <div
      role="img"
      aria-label="Image placeholder"
      data-testid="osb-image-fallback"
      className={cn('h-full w-full', 'bg-gradient-to-br from-slate-300 to-slate-400')}
    />
  )
}
