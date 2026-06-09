// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Create your artist account — Tahti',
  description: 'Join Tahti — a nonprofit broadcasting platform for independent artists.',
}

export default function SignupPage() {
  return <SignupForm />
}
