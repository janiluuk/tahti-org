// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { eqChainSummary } from './index.js'
import type { EqParams } from './index.js'

export function EqChainRow({ params, enabled }: { params: EqParams; enabled: boolean }) {
  return <span className="plug__mono-summary">{eqChainSummary(params, enabled)}</span>
}
