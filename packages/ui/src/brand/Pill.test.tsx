// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Pill, type PillVariant } from './Pill.js'

describe('Pill', () => {
  afterEach(() => cleanup())

  it.each(['live', 'flac', 'archive', 'recommended', 'default'] as PillVariant[])(
    '(Snapshot) renders correctly for variant=%s with its default label',
    (variant) => {
      const { container } = render(<Pill variant={variant} />)
      expect(container).toMatchSnapshot()
    },
  )

  it('(Snapshot) renders correctly with explicit children overriding the default label', () => {
    const { container } = render(<Pill variant="default">Custom label</Pill>)
    expect(container).toMatchSnapshot()
  })
})
