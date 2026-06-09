// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import { resolveColorScheme } from '@tahti/shared'

interface Props {
  colorSchemeJson?: string | null
  paletteJson?: string | null
  /** CSS selector for the element to inject custom properties on (default: nearest ancestor with data-channel-root). */
  selector?: string
}

// Injects --channel-* CSS custom properties onto the wrapper element.
// Using a wrapper element (not :root) so properties don't leak across navigations.
export function ChannelColorScheme({ colorSchemeJson, paletteJson }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scheme = resolveColorScheme(colorSchemeJson, paletteJson)
    const target = ref.current?.closest('[data-channel-root]') as HTMLElement | null ?? ref.current?.parentElement
    if (!target) return

    target.style.setProperty('--channel-bg', scheme.bg)
    target.style.setProperty('--channel-accent', scheme.accent)
    target.style.setProperty('--channel-text', scheme.text)
    target.style.setProperty('--channel-muted', scheme.muted)
    target.style.setProperty('--channel-highlight', scheme.highlight)

    return () => {
      target.style.removeProperty('--channel-bg')
      target.style.removeProperty('--channel-accent')
      target.style.removeProperty('--channel-text')
      target.style.removeProperty('--channel-muted')
      target.style.removeProperty('--channel-highlight')
    }
  }, [colorSchemeJson, paletteJson])

  return <div ref={ref} style={{ display: 'none' }} aria-hidden />
}
