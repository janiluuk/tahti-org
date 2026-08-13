// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createTahtiClient } from '@tahti/api-client'
import { ApiTokensPanel } from './api-tokens-panel'

export default async function ApiTokensSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const api = createTahtiClient({ baseUrl: apiUrl, cookie: `tahti_session=${sessionCookie.value}` })

  const { data: tokens } = await api.GET('/api/me/api-tokens')

  return (
    <>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">API tokens</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Personal tokens for scripted or third-party access to the Tahti API — see{' '}
            <a href="https://api.tahti.live/api" target="_blank" rel="noreferrer">
              api.tahti.live/api
            </a>{' '}
            for the full reference. Each token is shown once at creation; store it somewhere
            safe.
          </p>
        </div>
      </div>

      <ApiTokensPanel initial={tokens ?? []} apiBase={process.env.NEXT_PUBLIC_API_BASE ?? apiUrl} />
    </>
  )
}
