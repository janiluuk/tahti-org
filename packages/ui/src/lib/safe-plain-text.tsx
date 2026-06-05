// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { CSSProperties } from 'react'
import { plainTextToHtml, plainTextWithMentionsToHtml } from './escape-html'

/** Renders user bio/description as escaped plain text (no raw HTML). */
export function SafePlainText({
  text,
  className,
  style,
  linkMentions = false,
}: {
  text: string
  className?: string
  style?: CSSProperties
  /** Phase 10: turn @username into profile links */
  linkMentions?: boolean
}) {
  const html = linkMentions ? plainTextWithMentionsToHtml(text) : plainTextToHtml(text)
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />
}
