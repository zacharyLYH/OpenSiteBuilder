import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OSBVideo, { OSB_VIDEO_DEFAULTS, OSB_VIDEO_FIELDS } from './OSBVideo'
import ConfigDrawer from '../canvas/ConfigDrawer'
import type { PlacedNode } from '../canvas/doc'

describe('OSBVideo rendering', () => {
  it('shows a placeholder when no source is set', () => {
    render(<OSBVideo config={{}} />)
    const fallback = screen.getByTestId('osb-video-fallback')
    expect(fallback.getAttribute('aria-label')).toBe('Video placeholder')
    expect(document.querySelector('video')).toBeNull()
  })

  it('renders a full-bleed player with the bells and whistles', () => {
    const { container } = render(
      <OSBVideo
        config={{ videoSrc: 'https://example.com/clip.mp4', poster: 'https://example.com/cover.jpg', loop: true, muted: true }}
      />,
    )
    const video = container.querySelector('video')
    if (!video) throw new Error('expected a video element')
    expect(video.getAttribute('src')).toBe('https://example.com/clip.mp4')
    expect(video.getAttribute('poster')).toBe('https://example.com/cover.jpg')
    // Defaults on: controls + playsInline + metadata preload; opted-in loop.
    expect(video.hasAttribute('controls')).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
    expect(video.getAttribute('preload')).toBe('metadata')
    expect(video.hasAttribute('loop')).toBe(true)
    expect(video.className).toContain('object-cover')
  })

  it('omits the poster when none is set and honors control toggles', () => {
    const { container } = render(<OSBVideo config={{ videoSrc: 'https://example.com/clip.mp4', controls: false }} />)
    const video = container.querySelector('video')
    if (!video) throw new Error('expected a video element')
    expect(video.hasAttribute('poster')).toBe(false)
    expect(video.hasAttribute('controls')).toBe(false)
  })
})

describe('OSBVideo registry shape', () => {
  it('defaults to controls on, everything else off', () => {
    expect(OSB_VIDEO_DEFAULTS).toMatchObject({
      videoSrc: '',
      controls: true,
      autoplay: false,
      muted: false,
      loop: false,
    })
  })

  it('marks the source required and exposes every knob', () => {
    const kinds = Object.fromEntries(OSB_VIDEO_FIELDS.map((f) => [f.key, f]))
    expect(kinds.videoSrc.required).toBe(true)
    expect(Object.keys(kinds).sort()).toEqual(['autoplay', 'controls', 'loop', 'muted', 'poster', 'videoSrc'])
  })

  it('edits through the generic drawer (no video-specific UI)', () => {
    const node: PlacedNode = {
      id: 'v1',
      type: 'video',
      config: {},
      parentId: null,
      x: 0,
      y: 0,
      cols: 6,
      rows: 4,
    }
    render(<ConfigDrawer node={node} side="right" onClose={() => {}} onApply={() => {}} />)
    expect(screen.getByText('Video settings')).toBeTruthy()
    // Required fields carry a red asterisk inside the label, so match the
    // label text (not the form control) for the URL…
    expect(screen.getByText('Video web address')).toBeTruthy()
    // …and the plain control label for a toggle.
    expect(screen.getByLabelText('Playback controls')).toBeTruthy()
  })
})
