// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { TicketAdminPanel } from './ticket-admin-panel'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

export default async function AdminSupportTicketPage({ params }: { params: { id: string } }) {
  const res = await boardFetch(`/api/admin/support/tickets/${params.id}`)
  if (res.status === 404) notFound()
  if (!res.ok) {
    return <p className="admin-err">Could not load ticket.</p>
  }

  const ticket = (await res.json()) as {
    id: string
    subject: string
    message: string
    category: string
    status: string
    artistId: string | null
    artistUsername: string | null
    contactEmail: string | null
    createdAt: string
    notes: Array<{ body: string; authorDisplayName: string | null; createdAt: string }>
  }

  type EngagementSummary = {
    totalUnits: number
    adjustments: Array<{ units: number; reason: string }>
  }
  let engagement: EngagementSummary | null = null
  if (ticket.artistId) {
    const engRes = await boardFetch(`/api/admin/users/${ticket.artistId}/engagement`)
    if (engRes.ok) {
      engagement = (await engRes.json()) as EngagementSummary
    }
  }

  return (
    <>
      <h1 className="admin-section-title">Ticket #{ticket.id}</h1>
      <p className="admin-stat-sub">
        <Link href="/admin/support">← Support queue</Link>
      </p>

      <section className="admin-card" style={{ marginBottom: '1rem' }}>
        <h2>{ticket.subject}</h2>
        <p className="admin-stat-sub">
          {ticket.category} · {ticket.status} ·{' '}
          {ticket.artistUsername ?? ticket.contactEmail ?? 'Anonymous'} ·{' '}
          {new Date(ticket.createdAt).toLocaleString()}
        </p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.message}</p>
      </section>

      {engagement ? (
        <section className="admin-card" style={{ marginBottom: '1rem' }}>
          <h2>Engagement (YTD)</h2>
          <p className="admin-stat">{engagement.totalUnits}</p>
          {engagement.adjustments.length > 0 ? (
            <ul className="admin-stat-sub">
              {engagement.adjustments.map((a, i) => (
                <li key={i}>
                  {a.units > 0 ? '+' : ''}
                  {a.units}: {a.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <TicketAdminPanel
        ticketId={ticket.id}
        artistId={ticket.artistId}
        status={ticket.status}
        subject={ticket.subject}
      />

      <section className="admin-card">
        <h2>Timeline</h2>
        {ticket.notes.length === 0 ? (
          <p className="admin-stat-sub">No notes yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {ticket.notes.map((n, i) => (
              <li key={i} style={{ marginBottom: '0.75rem' }}>
                <strong>{n.authorDisplayName ?? 'Staff'}</strong>{' '}
                <span className="admin-stat-sub">{new Date(n.createdAt).toLocaleString()}</span>
                <p style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
