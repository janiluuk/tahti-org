// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LogViewer, previewLogLine } from './log-viewer.js'

describe('previewLogLine', () => {
  it('collapses whitespace and truncates long lines', () => {
    expect(previewLogLine('  hello   world  ', 20)).toBe('hello world')
    expect(previewLogLine('abcdefghijklmnopqrstuvwxyz', 8)).toBe('abcdefgh…')
  })

  it('labels empty lines', () => {
    expect(previewLogLine('   ')).toBe('Empty line')
  })
})

describe('LogViewer', () => {
  afterEach(() => cleanup())

  it('renders timestamp, source, title, and expandable detail', () => {
    render(
      <LogViewer
        entries={[
          {
            id: '1',
            timestamp: '2026-09-06T12:00:00.000Z',
            source: 'Finance & grants',
            title: 'Ledger entry created',
            detail: 'Aino Board · target entry-9',
          },
        ]}
      />,
    )
    expect(screen.getByText('Finance & grants')).toBeTruthy()
    expect(screen.getAllByText('Ledger entry created').length).toBeGreaterThan(0)
    expect(screen.getByText('Aino Board · target entry-9')).toBeTruthy()
  })

  it('shows an empty state when there are no entries', () => {
    render(<LogViewer entries={[]} emptyMessage="Nothing to audit." />)
    expect(screen.getByText('Nothing to audit.')).toBeTruthy()
  })

  it('copies the title and detail', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(
      <LogViewer
        entries={[
          {
            id: '1',
            timestamp: '2026-09-06T12:00:00.000Z',
            source: 'api',
            title: 'boot',
            detail: 'ready',
          },
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('boot\nready')
  })

  it('pauses follow-live when the viewer is scrolled away from the tail', async () => {
    const onFollowPause = vi.fn()
    const { container } = render(
      <LogViewer
        live
        onFollowPause={onFollowPause}
        entries={[
          {
            id: '1',
            timestamp: 1,
            source: 'api',
            title: 'line',
          },
        ]}
      />,
    )
    const viewer = container.querySelector('.ui-log-viewer')
    expect(viewer).toBeTruthy()
    await act(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve())
        }),
    )
    Object.defineProperty(viewer, 'scrollHeight', { configurable: true, value: 400 })
    Object.defineProperty(viewer, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(viewer, 'scrollTop', { configurable: true, value: 0, writable: true })
    fireEvent.scroll(viewer!)
    expect(onFollowPause).toHaveBeenCalled()
  })
})
