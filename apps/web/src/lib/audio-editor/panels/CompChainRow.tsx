// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { compChainSummary } from '@tahti/audio-edit'
import type { CompParams } from '@tahti/audio-edit'

export function CompChainRow({ params, enabled }: { params: CompParams; enabled: boolean }) {
  return <span className="plug__mono-summary">{compChainSummary(params, enabled)}</span>
}
