// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BrandLogo, Heading, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'

interface StreamSettings {
  rtmp: { server: string; streamKey: string }
  icecast: { server: string; mount: string; password: string }
}

async function fetchStreamSettings(sessionValue: string): Promise<StreamSettings | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/me/stream-settings`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as StreamSettings
  } catch {
    return null
  }
}

export default async function SignupBroadcastPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/signup/broadcast')

  const settings = await fetchStreamSettings(sessionCookie.value)

  return (
    <>
      <BgCanvas />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark auth-card--wide">
          <BrandLogo />
          <Heading level={1}>Set up broadcasting</Heading>
          <Text tone="muted">
            Use these credentials in OBS Studio, Mixxx, Traktor, or any RTMP/Icecast-compatible
            software to go live.
          </Text>

          <section style={{ marginTop: '1.25rem' }}>
            <h2
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--cyan)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.5rem',
              }}
            >
              OBS Studio (RTMP)
            </h2>
            <dl className="signup-creds-list">
              <dt>Server</dt>
              <dd>
                <code>{settings?.rtmp.server ?? '(visit dashboard)'}</code>
              </dd>
              <dt>Stream key</dt>
              <dd>
                <code>{settings?.rtmp.streamKey ?? '(visit dashboard)'}</code>
              </dd>
            </dl>
          </section>

          <section style={{ marginTop: '1.25rem' }}>
            <h2
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--cyan)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.5rem',
              }}
            >
              Mixxx / Traktor (Icecast)
            </h2>
            <dl className="signup-creds-list">
              <dt>Server</dt>
              <dd>
                <code>{settings?.icecast.server ?? '(visit dashboard)'}</code>
              </dd>
              <dt>Mount</dt>
              <dd>
                <code>{settings?.icecast.mount ?? '(visit dashboard)'}</code>
              </dd>
              <dt>Password</dt>
              <dd>
                <code>{settings?.icecast.password ?? '(visit dashboard)'}</code>
              </dd>
            </dl>
          </section>

          <Text tone="muted" size="sm" style={{ marginTop: '1rem' }}>
            Your stream keys are also available any time from{' '}
            <Link href="/dashboard">Dashboard → Channel</Link>. You can rotate them there if needed.
          </Text>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '1.25rem',
            }}
          >
            <Link href="/dashboard" className="ui-btn ui-btn--primary">
              Go to dashboard →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
