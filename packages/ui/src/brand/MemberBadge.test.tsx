// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemberBadge } from './MemberBadge.js'

describe('MemberBadge', () => {
  afterEach(() => cleanup())

  it('labels the artist as a Tahti ry member', () => {
    render(<MemberBadge />)
    const badge = screen.getByLabelText('Tahti ry member')
    expect(badge.textContent).toBe('Tahti ry member')
    expect(badge.getAttribute('title')).toContain('nonprofit')
  })

  it('accepts a className', () => {
    const { container } = render(<MemberBadge className="extra" />)
    expect(container.firstElementChild?.className).toContain('member-badge')
    expect(container.firstElementChild?.className).toContain('extra')
  })
})
