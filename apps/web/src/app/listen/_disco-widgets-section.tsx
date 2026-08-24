// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import type { DiscoWidgetRenderItem } from '@tahti/shared'
import { DiscoWidgetFrame } from '@/components/disco-widgets/disco-widget-frame'

const API_URL = process.env.API_URL ?? 'http://localhost:3001'

async function fetchDiscoverWidgets(): Promise<DiscoWidgetRenderItem[]> {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) return []
  try {
    const res = await fetch(`${API_URL}/api/v1/disco-widgets/discover`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { widgets: DiscoWidgetRenderItem[] }
    return data.widgets
  } catch {
    return []
  }
}

/** Only renders for a logged-in listener with at least one enabled widget —
 * calling cookies() here opts this section (and its ISR-cached siblings on
 * the page) into per-request dynamic rendering, which is the correct
 * trade-off for genuinely personalized content. */
export async function DiscoWidgetsSection() {
  const widgets = await fetchDiscoverWidgets()
  if (widgets.length === 0) return null

  return (
    <section className="listen-section">
      {widgets.map((w) => (
        <DiscoWidgetFrame
          key={w.installId}
          sandboxUrl={w.sandboxUrl}
          name={w.name}
          context={w.context}
          config={w.config}
        />
      ))}
    </section>
  )
}
