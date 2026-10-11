import { cn } from '../lib/utils'
import { OSB_ALIGN_CLASSES, resolveConfig, type OSBAlign, type OSBField, type OSBTheme } from './types'

export type OSBTextConfig = {
  text: string
  align: OSBAlign
  theme: OSBTheme
}

export const OSB_TEXT_DEFAULTS: OSBTextConfig = {
  text: 'Text',
  align: 'left',
  theme: 'light',
}

export const OSB_TEXT_FIELDS: OSBField[] = [
  { key: 'text', label: 'Text', kind: 'longtext' },
  {
    key: 'align',
    label: 'Alignment',
    kind: 'select',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
    ],
  },
  { key: 'theme', label: 'Appearance', kind: 'theme' },
]

const TONE: Record<OSBTheme, string> = {
  light: 'text-slate-900',
  dark: 'text-slate-50',
}

export interface OSBTextProps {
  config?: Partial<OSBTextConfig>
  children?: React.ReactNode
}

export default function OSBText({ config }: OSBTextProps) {
  const c = resolveConfig(OSB_TEXT_DEFAULTS, config)
  return (
    <div className={cn('h-full w-full overflow-hidden', OSB_ALIGN_CLASSES[c.align])}>
      <p className={cn('w-full break-words text-base leading-relaxed', OSB_ALIGN_CLASSES[c.align], TONE[c.theme])}>
        {c.text === '' ? 'Text' : c.text}
      </p>
    </div>
  )
}
