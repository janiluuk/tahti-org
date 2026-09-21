// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Reveal } from './Reveal.js'

describe('Reveal', () => {
  afterEach(() => cleanup())

  it('starts collapsed and shows the expand label', () => {
    render(
      <Reveal>
        <p>hidden content</p>
      </Reveal>,
    )
    const toggle = screen.getByRole('button', { name: 'Read more' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('expands on click and shows the collapse label', () => {
    render(
      <Reveal>
        <p>hidden content</p>
      </Reveal>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Read more' }))
    const toggle = screen.getByRole('button', { name: 'Show less' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('respects custom labels and defaultOpen', () => {
    render(
      <Reveal expandLabel="More" collapseLabel="Less" defaultOpen>
        <p>content</p>
      </Reveal>,
    )
    expect(screen.getByRole('button', { name: 'Less' })).not.toBeNull()
  })

  it('links the toggle button to the content region via aria-controls', () => {
    render(
      <Reveal>
        <p>content</p>
      </Reveal>,
    )
    const toggle = screen.getByRole('button')
    const controlsId = toggle.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()
    expect(document.getElementById(controlsId!)).not.toBeNull()
  })
})
