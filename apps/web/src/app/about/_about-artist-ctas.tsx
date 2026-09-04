// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { BETA_CLIENT_URL } from '@/lib/beta-client'
import { isSignupOpen } from '@/lib/signup'

/** Shared artist-facing CTAs for About (beta client + optional signup). */
export async function AboutArtistCtas() {
  const signupOpen = isSignupOpen()
  return (
    <>
      <a
        href={BETA_CLIENT_URL}
        className="about-cta-primary"
        target="_blank"
        rel="noopener noreferrer"
      >
        Try beta client →
      </a>
      {signupOpen && (
        <Link href="/signup" className="about-cta-secondary">
          Join as an artist
        </Link>
      )}
      <Link href="/login" className="about-cta-secondary">
        Sign in
      </Link>
    </>
  )
}
