// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudioAmbientClock } from './StudioAmbientClock.js'

function renderIntoStudioRoot(children: ReactNode) {
  const root = document.createElement('div')
  root.setAttribute('data-tahti-ui', 'studio')
  root.className = 'tahti-studio'
  document.body.appendChild(root)
  render(children, { container: root })
  return root
}

describe('StudioAmbientClock', () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('adds studio-ambient and sets data-studio-time on mount when celestial', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0))
    const root = renderIntoStudioRoot(<StudioAmbientClock />)

    expect(root.classList.contains('studio-ambient')).toBe(true)
    expect(root.getAttribute('data-studio-time')).toBe('day')
  })

  it('omits data-studio-time when celestial is disabled (admin)', () => {
    const root = renderIntoStudioRoot(<StudioAmbientClock celestial={false} />)

    expect(root.classList.contains('studio-ambient')).toBe(true)
    expect(root.hasAttribute('data-studio-time')).toBe(false)
  })

  it('updates data-studio-time on a 60s interval', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 5, 59, 0))
    const root = renderIntoStudioRoot(<StudioAmbientClock />)

    expect(root.getAttribute('data-studio-time')).toBe('night')

    vi.setSystemTime(new Date(2026, 0, 1, 6, 1, 0))
    vi.advanceTimersByTime(60_000)

    expect(root.getAttribute('data-studio-time')).toBe('dawn')
  })

  it('clears the interval on unmount', () => {
    vi.useFakeTimers()
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const root = document.createElement('div')
    root.setAttribute('data-tahti-ui', 'studio')
    root.className = 'tahti-studio'
    document.body.appendChild(root)

    const { unmount } = render(<StudioAmbientClock />, { container: root })
    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
