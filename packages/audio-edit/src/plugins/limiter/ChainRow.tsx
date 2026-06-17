// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { limiterChainSummary } from './index.js'
import type { LimiterParams } from './index.js'

export function LimiterChainRow({ params, enabled }: { params: LimiterParams; enabled: boolean }) {
  return <span className="plug__mono-summary">{limiterChainSummary(params, enabled)}</span>
}
