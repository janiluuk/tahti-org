// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Badge, LiveBadge, QualityBadge } from './Badge.js'

describe('LiveBadge', () => {
  afterEach(() => cleanup())

  it('(Snapshot) renders correctly', () => {
    const { container } = render(<LiveBadge />)
    expect(container).toMatchSnapshot()
  })
})

describe('QualityBadge', () => {
  afterEach(() => cleanup())

  it.each(['FLAC', 'MP3', 'OPUS'] as const)(
    '(Snapshot) renders correctly for quality=%s',
    (quality) => {
      const { container } = render(<QualityBadge quality={quality} />)
      expect(container).toMatchSnapshot()
    },
  )
})

describe('Badge', () => {
  afterEach(() => cleanup())

  it('(Snapshot) renders correctly with the default variant', () => {
    const { container } = render(<Badge>New</Badge>)
    expect(container).toMatchSnapshot()
  })

  it('(Snapshot) renders correctly with an explicit variant and className', () => {
    const { container } = render(
      <Badge variant="purple" className="ml-2">
        Beta
      </Badge>,
    )
    expect(container).toMatchSnapshot()
  })
})
