// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { ChipFilterBar } from './ChipFilterBar.js'

function Harness() {
  const [value, setValue] = useState<string | null>(null)
  return (
    <ChipFilterBar
      label="Filter by genre"
      value={value}
      onChange={setValue}
      options={[
        { value: 'techno', label: 'Techno' },
        { value: 'ambient', label: 'Ambient' },
      ]}
    />
  )
}

describe('ChipFilterBar', () => {
  afterEach(() => cleanup())

  it('opens a filter sheet and applies a selection', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = screen.getByRole('dialog', { name: 'Filter by genre' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Techno' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('.chip-filter-bar__current span')?.textContent).toBe('Techno')
  })
})
