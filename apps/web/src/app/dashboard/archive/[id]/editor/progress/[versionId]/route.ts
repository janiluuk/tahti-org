// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(
  _request: Request,
  { params }: { params: { id: string; versionId: string } },
): Promise<Response> {
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const upstream = await fetch(
    `${apiUrl}/api/me/archive/${params.id}/versions/${params.versionId}/progress`,
    {
      headers: { Cookie: `tahti_session=${session.value}` },
      cache: 'no-store',
    },
  )

  if (!upstream.ok) {
    return new Response(upstream.statusText, { status: upstream.status })
  }

  const headers = new Headers()
  headers.set('Content-Type', 'text/event-stream')
  headers.set('Cache-Control', 'no-cache, no-transform')
  headers.set('Connection', 'keep-alive')

  return new Response(upstream.body, { status: 200, headers })
}
