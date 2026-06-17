// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { gainChainSummary } from '@tahti/audio-edit'
import type { GainParams } from '@tahti/audio-edit'

export function GainChainRow({ params, enabled }: { params: GainParams; enabled: boolean }) {
  return (
    <span className="plug__mono-summary">{gainChainSummary(params, enabled)}</span>
  )
}
