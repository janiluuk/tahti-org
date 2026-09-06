// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GoLiveStatus } from './GoLiveStatus.js'

describe('GoLiveStatus', () => {
  afterEach(() => cleanup())

  it('links to Studio overview for the stream manager when live', () => {
    render(<GoLiveStatus isReallyLive goneLiveAt="2026-09-06T02:00:00.000Z" />)
    fireEvent.click(screen.getByRole('button', { name: 'Stream status' }))
    const link = screen.getByRole('menuitem', { name: /open stream manager/i })
    expect(link.getAttribute('href')).toBe('/dashboard')
  })

  it('links to the Go live wizard when offline', () => {
    render(<GoLiveStatus isReallyLive={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Stream status' }))
    const link = screen.getByRole('menuitem', { name: /go live/i })
    expect(link.getAttribute('href')).toBe('/dashboard/broadcast')
  })
})
