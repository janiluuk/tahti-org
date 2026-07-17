// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WaveformPlayer } from './WaveformPlayer.js'

describe('WaveformPlayer', () => {
  afterEach(() => cleanup())

  it('shows a waiting label and dot when no signal is connected yet', () => {
    const { container } = render(<WaveformPlayer waitingForSignal playing={false} />)
    expect(screen.getByText('Waiting for signal…')).toBeTruthy()
    expect(container.querySelector('.waveform-player__dot--waiting')).toBeTruthy()
    expect(container.querySelectorAll('.waveform-player__bar--waiting').length).toBeGreaterThan(0)
  })

  it('does not show the waiting state once playing', () => {
    const { container } = render(<WaveformPlayer playing statusLabel="Now playing" />)
    expect(screen.queryByText('Waiting for signal…')).toBeNull()
    expect(container.querySelector('.waveform-player__dot--waiting')).toBeNull()
    expect(container.querySelectorAll('.waveform-player__bar--active').length).toBeGreaterThan(0)
  })

  it('lets an explicit statusLabel override the default waiting copy', () => {
    render(<WaveformPlayer waitingForSignal statusLabel="Connecting…" />)
    expect(screen.getByText('Connecting…')).toBeTruthy()
    expect(screen.queryByText('Waiting for signal…')).toBeNull()
  })
})
