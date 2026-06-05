// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function forceChannelOffline(slug: string): Promise<{ error: string | null }> {
  const res = await fetch(
    `${apiUrl}/api/admin/channels/${encodeURIComponent(slug)}/force-offline`,
    {
      method: 'POST',
      headers: { Cookie: sessionHeader() },
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Force offline failed' }
  }
  revalidatePath('/admin/streams')
  revalidatePath('/admin/dashboard')
  return { error: null }
}

export async function retryFanSubPayout(payoutId: string): Promise<{ error: string | null }> {
  const res = await fetch(
    `${apiUrl}/api/admin/fansubs/payouts/${encodeURIComponent(payoutId)}/retry`,
    {
      method: 'POST',
      headers: { Cookie: sessionHeader() },
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Retry failed' }
  }
  revalidatePath('/admin/financial/fansubs')
  revalidatePath('/admin/dashboard')
  return { error: null }
}

export async function createLedgerEntry(input: {
  category: string
  amountCents: number
  description: string
  periodStart: string
  periodEnd: string
  externalRef?: string
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/ledger`, {
    method: 'POST',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Create failed' }
  }
  revalidatePath('/admin/financial/ledger')
  return { error: null }
}

export async function updateSupportTicket(
  ticketId: string,
  patch: { status?: string; assignedToId?: string | null },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/support/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Update failed' }
  }
  revalidatePath(`/admin/support/${ticketId}`)
  revalidatePath('/admin/support')
  return { error: null }
}

export async function addSupportTicketNote(
  ticketId: string,
  body: string,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/support/tickets/${ticketId}/notes`, {
    method: 'POST',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Note failed' }
  }
  revalidatePath(`/admin/support/${ticketId}`)
  return { error: null }
}

export async function createEngagementAdjustment(input: {
  userId: string
  units: number
  reason: string
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/engagement/adjustment`, {
    method: 'POST',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Adjustment failed' }
  }
  revalidatePath(`/admin/support`)
  return { error: null }
}

export async function createResolution(input: {
  title: string
  body: string
  votedAt: string
  outcome: string
  voteFor: number
  voteAgainst: number
  voteAbstain: number
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/resolutions`, {
    method: 'POST',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      votedAt: new Date(input.votedAt).toISOString(),
    }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Create failed' }
  }
  revalidatePath('/admin/governance/resolutions')
  return { error: null }
}

export async function publishResolution(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/resolutions/${id}`, {
    method: 'PATCH',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishedAt: new Date().toISOString() }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Publish failed' }
  }
  revalidatePath('/admin/governance/resolutions')
  revalidatePath('/transparency')
  return { error: null }
}

export async function generateAnnualReport(year: string): Promise<{
  error: string | null
  markdown?: string
  downloadUrl?: string
}> {
  const res = await fetch(`${apiUrl}/api/admin/reports/annual/${encodeURIComponent(year)}`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Generate failed' }
  }
  const body = (await res.json()) as { markdown: string; downloadUrl: string }
  revalidatePath('/admin/governance/report')
  return { error: null, markdown: body.markdown, downloadUrl: body.downloadUrl }
}
