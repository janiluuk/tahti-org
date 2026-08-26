// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RankBadge } from './RankBadge.js'

describe('RankBadge', () => {
  afterEach(() => cleanup())

  it('(Snapshot) renders correctly for a single-digit rank', () => {
    const { container } = render(<RankBadge rank={1} />)
    expect(container).toMatchSnapshot()
  })

  it('(Snapshot) renders correctly with a className', () => {
    const { container } = render(<RankBadge rank={42} className="top-list-badge" />)
    expect(container).toMatchSnapshot()
  })
})
