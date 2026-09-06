// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProfileHero } from './ProfilePageLayout.js'

const base = {
  displayName: 'Nova',
  username: 'nova',
  bio: null,
  avatarUrl: null,
  subscribeHref: '/u/nova/subscribe',
}

describe('ProfileHero member badge', () => {
  afterEach(() => cleanup())

  it('shows the association badge only for members', () => {
    const { rerender } = render(<ProfileHero {...base} showSupport={false} />)
    expect(screen.queryByLabelText('Tahti ry member')).toBeNull()

    rerender(<ProfileHero {...base} showSupport={false} isMember />)
    expect(screen.getByLabelText('Tahti ry member')).toBeTruthy()
  })
})
