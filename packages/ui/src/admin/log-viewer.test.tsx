// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LogViewer } from './log-viewer.js'

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
    expect(screen.getByText('Ledger entry created')).toBeTruthy()
    expect(screen.getByText('Aino Board · target entry-9')).toBeTruthy()
  })

  it('shows an empty state when there are no entries', () => {
    render(<LogViewer entries={[]} emptyMessage="Nothing to audit." />)
    expect(screen.getByText('Nothing to audit.')).toBeTruthy()
  })
})
