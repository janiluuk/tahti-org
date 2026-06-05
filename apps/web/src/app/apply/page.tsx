// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { BetaApplyForm } from './beta-apply-form'

export const metadata: Metadata = {
  title: 'Apply for beta — Tahti',
  description: 'Apply for the Tahti private beta for independent artists and DJs.',
}

export default function ApplyPage() {
  return <BetaApplyForm />
}
