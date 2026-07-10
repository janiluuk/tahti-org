// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { filterChainSummary } from './index.js'
import type { FilterParams } from './index.js'

export function FilterChainRow({ params, enabled }: { params: FilterParams; enabled: boolean }) {
  return <span className="plug__mono-summary">{filterChainSummary(params, enabled)}</span>
}
