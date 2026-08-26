// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatCard, StatCardGrid, StatCardStrip } from './StatCard.js'

describe('StatCard', () => {
  afterEach(() => cleanup())

  it('(Snapshot) renders correctly with the default card layout', () => {
    const { container } = render(
      <StatCard variant="plays" value="12,890" label="Total plays" />,
    )
    expect(container).toMatchSnapshot()
  })

  it('(Snapshot) renders correctly with a subtitle, inline layout, compact size, and positive', () => {
    const { container } = render(
      <StatCard
        variant="revenue"
        value="€842.10"
        label="Paid out YTD"
        subtitle="8 payouts this month"
        positive
        layout="inline"
        size="compact"
      />,
    )
    expect(container).toMatchSnapshot()
  })
})

describe('StatCardGrid', () => {
  afterEach(() => cleanup())

  it('(Snapshot) renders correctly with several stat cards', () => {
    const { container } = render(
      <StatCardGrid cols={2} aria-label="Channel summary">
        <StatCard variant="plays" value="12,890" label="Total plays" />
        <StatCard variant="fans" value="284" label="Followers" />
      </StatCardGrid>,
    )
    expect(container).toMatchSnapshot()
  })
})

describe('StatCardStrip', () => {
  afterEach(() => cleanup())

  it('(Snapshot) renders correctly with a separator between items', () => {
    const { container } = render(
      <StatCardStrip aria-label="Platform stats">
        <StatCard variant="neutral" value="1,204" label="Artists" />
        <StatCard variant="neutral" value="38" label="Live now" />
      </StatCardStrip>,
    )
    expect(container).toMatchSnapshot()
  })
})
