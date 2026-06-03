// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import React from 'react'

interface UrlBoxProps {
  prefix?: string
  highlight: string
  suffix?: string
}

export function UrlBox({ prefix = 'https://', highlight, suffix = '' }: UrlBoxProps) {
  return (
    <div className="url-box">
      <span style={{ color: 'var(--muted)' }}>{prefix}</span>
      <span className="highlight">{highlight}</span>
      <span style={{ color: 'var(--muted)' }}>{suffix}</span>
    </div>
  )
}
