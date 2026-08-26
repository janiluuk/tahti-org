// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CoverArt } from './CoverArt.js'

describe('CoverArt', () => {
  afterEach(() => cleanup())

  it('(Snapshot) renders correctly as a gradient placeholder when there is no src', () => {
    const { container } = render(<CoverArt size="md" gradient="coral" />)
    expect(container).toMatchSnapshot()
  })

  it('(Snapshot) renders correctly as an image when src is set', () => {
    const { container } = render(
      <CoverArt size="lg" src="https://example.com/cover.jpg" alt="First Light EP" />,
    )
    expect(container).toMatchSnapshot()
  })

  it('(Snapshot) renders correctly at full size', () => {
    const { container } = render(
      <CoverArt size="full" src="https://example.com/cover.jpg" alt="First Light EP" />,
    )
    expect(container).toMatchSnapshot()
  })
})
