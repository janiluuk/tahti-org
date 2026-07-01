// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BrandLogo, Heading, SidebarNavIconSvg, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { getDashboardUser } from '@/lib/dashboard-session'
import { SignupWizard } from '../signup-wizard'

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

  const user = await getDashboardUser()
  if (user?.channel) redirect('/dashboard/broadcast')

  const settings = await fetchStreamSettings(sessionCookie.value)

  return (
    <>
      <BgCanvas variant="subtle" />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark auth-card--wide">
          <BrandLogo />
          <SignupWizard current="broadcast" />
          <Heading level={1}>Set up broadcasting</Heading>
          <Text tone="muted">
            Use these credentials in OBS Studio, Mixxx, Traktor, or any RTMP/Icecast-compatible
            software to go live.
          </Text>

          <section className="signup-broadcast-section">
            <h2 className="signup-section-heading">OBS Studio (RTMP)</h2>
            <ol className="signup-quickstart">
              <li>Open OBS → Settings → Stream</li>
              <li>Service: Custom</li>
              <li>Paste the server and stream key below</li>
              <li>Click “Start Streaming” when you are ready to go live</li>
            </ol>
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

          <section className="signup-broadcast-section">
            <h2 className="signup-section-heading">Mixxx / Traktor (Icecast)</h2>
            <ol className="signup-quickstart">
              <li>Open Live Broadcast preferences in your DJ software</li>
              <li>Connection type: Icecast 2</li>
              <li>Enter server, mount, and password below</li>
            </ol>
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

          <Text tone="muted" size="sm">
            Your stream keys are also available any time from{' '}
            <Link href="/dashboard/broadcast">Dashboard → Broadcast studio</Link>. You can rotate
            them there if needed.
          </Text>

          <div className="signup-broadcast-actions">
            <Link href="/dashboard/broadcast" className="ui-btn ui-btn--primary">
              <SidebarNavIconSvg name="distribution" />
              Open broadcast studio →
            </Link>
            <Link href="/signup/profile" className="ui-btn ui-btn--ghost">
              ← Back to profile
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
