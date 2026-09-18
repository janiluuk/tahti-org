// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Spinner } from './Spinner.js'

describe('Spinner', () => {
  afterEach(() => cleanup())

  it('defaults to the md size', () => {
    const { container } = render(<Spinner />)
    const el = container.firstElementChild!
    expect(el.className).toContain('ui-spinner--md')
    expect(el.getAttribute('aria-hidden')).not.toBeNull()
  })

  it('renders the sm size when requested', () => {
    const { container } = render(<Spinner size="sm" />)
    expect(container.firstElementChild!.className).toContain('ui-spinner--sm')
  })

  it('appends a custom className', () => {
    const { container } = render(<Spinner className="my-extra" />)
    expect(container.firstElementChild!.className).toContain('my-extra')
  })
})
