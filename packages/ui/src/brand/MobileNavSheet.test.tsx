// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { MobileNavSheet } from './MobileNavSheet.js'

function TestSheet() {
  const triggerRef = createRef<HTMLButtonElement>()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        More
      </button>
      <MobileNavSheet
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        ariaLabel="More sections"
      >
        <a href="/one">First section</a>
        <a href="/two">Last section</a>
      </MobileNavSheet>
    </>
  )
}

describe('MobileNavSheet', () => {
  afterEach(() => cleanup())

  it('moves focus into the sheet, traps Tab, closes on Escape, and restores focus', () => {
    render(<TestSheet />)
    const trigger = screen.getByRole('button', { name: 'More' })
    trigger.focus()
    fireEvent.click(trigger)

    const close = screen.getByRole('button', { name: 'Close menu' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Last section' }))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
