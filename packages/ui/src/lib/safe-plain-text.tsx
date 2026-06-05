// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { CSSProperties } from 'react'
import { plainTextToHtml } from './escape-html'

/** Renders user bio/description as escaped plain text (no raw HTML). */
export function SafePlainText({
  text,
  className,
  style,
}: {
  text: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: plainTextToHtml(text) }}
    />
  )
}
