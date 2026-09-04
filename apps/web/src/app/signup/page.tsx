// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { isSignupOpen } from '@/lib/signup'
import { BetaApplyForm } from '../apply/beta-apply-form'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: isSignupOpen() ? 'Create artist account — Tahti' : 'Apply for beta — Tahti',
  description: isSignupOpen()
    ? 'Create your Tahti artist account — broadcast, archive, and connect with listeners.'
    : 'Apply for the Tahti private beta — we review every application personally.',
}

export default function SignupPage() {
  if (!isSignupOpen()) return <BetaApplyForm />
  return <SignupForm />
}
