// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { AgmAgendaBuilder } from './agm-agenda-builder'

interface Motion {
  id: string
  title: string
  state: string
  advisory: boolean
  openAt: string
  closeAt: string
  proposer: string
  totalVotes: number
}

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

async function fetchMotions(): Promise<Motion[]> {
  try {
    const res = await boardFetch('/api/v1/governance/motions')
    if (!res.ok) return []
    return (await res.json()) as Motion[]
  } catch {
    return []
  }
}

function motionStateBadge(state: string) {
  const styles: Record<string, string> = {
    DRAFT: 'var(--muted)',
    OPEN: 'var(--cyan)',
    CLOSED: 'var(--muted)',
    CANCELLED: 'var(--muted)',
  }
  return (
    <span
      style={{
        fontSize: '0.6875rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: styles[state] ?? 'var(--muted)',
      }}
    >
      {state}
    </span>
  )
}

export default async function AdminAgmPage() {
  const motions = await fetchMotions()
  const openMotions = motions.filter((m) => m.state === 'OPEN' || m.state === 'DRAFT')

  return (
    <>
      <h1 className="admin-section-title">Annual General Meeting</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/governance">← Governance</Link>
        {' · '}
        AGM planning tools — agenda, motions, member notice, and minutes.
      </p>

      <AgmAgendaBuilder />

      <section className="admin-card" style={{ marginTop: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2>Motions &amp; proposals</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/governance" className="admin-btn">
              Governance portal →
            </Link>
          </div>
        </div>

        {openMotions.length === 0 ? (
          <p className="admin-stat-sub">
            No open or draft motions.{' '}
            <Link href="/governance" className="admin-inline-link">
              Create one in the governance portal →
            </Link>
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>State</th>
                  <th className="num">Votes</th>
                  <th>Opens</th>
                  <th>Closes</th>
                </tr>
              </thead>
              <tbody>
                {openMotions.map((m) => (
                  <tr key={m.id}>
                    <td>{m.title}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                      {m.advisory ? 'Advisory' : 'Binding'}
                    </td>
                    <td>{motionStateBadge(m.state)}</td>
                    <td className="num">{m.totalVotes}</td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {new Date(m.openAt).toLocaleDateString('fi-FI')}
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {new Date(m.closeAt).toLocaleDateString('fi-FI')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          Note: all AGM decisions are advisory until bylaws authorise asynchronous binding votes.
          Formal binding resolutions must be recorded as{' '}
          <Link href="/admin/governance/resolutions" className="admin-inline-link">
            board resolutions
          </Link>
          .
        </p>
      </section>

      <section className="admin-card" style={{ marginTop: '1.5rem' }}>
        <h2>Member notification</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Finnish association law (yhdistyslaki 24 §) requires written notice to all members at
          least seven days before the AGM. The notice must state the date, venue, and agenda.
        </p>

        <div
          className="admin-card"
          style={{ background: 'rgba(255,255,255,0.03)', marginBottom: '1rem' }}
        >
          <p style={{ fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: 500 }}>
            AGM notice checklist
          </p>
          <ul
            style={{
              fontSize: '0.8125rem',
              color: 'var(--muted)',
              paddingLeft: '1.25rem',
              lineHeight: 2,
            }}
          >
            <li>Date, time, and venue (physical or remote link)</li>
            <li>Agenda (use the builder above)</li>
            <li>Any proposed bylaw changes in full</li>
            <li>Deadline for member motions</li>
            <li>Instructions for remote participation</li>
          </ul>
        </div>

        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Send the notice via the governance email broadcast (see the governance portal) or by
          direct email from the board address. All current members are listed in the{' '}
          <a href="/api/admin/members/export.csv" className="admin-inline-link">
            member register export
          </a>
          .
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/governance" className="admin-btn">
            Governance portal
          </Link>
          <a href="/api/admin/members/export.csv" className="admin-btn">
            Export member register (CSV)
          </a>
        </div>
      </section>

      <section className="admin-card" style={{ marginTop: '1.5rem' }}>
        <h2>Minutes &amp; records</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          AGM minutes must be signed and archived. Board resolutions passed at the AGM should be
          recorded below. The annual report for the calendar year is generated separately.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/admin/governance/resolutions" className="admin-btn">
            Board resolutions →
          </Link>
          <Link href="/admin/governance/report" className="admin-btn">
            Annual report generator →
          </Link>
          <Link href="/admin/governance/audit" className="admin-btn">
            Audit log →
          </Link>
        </div>
      </section>
    </>
  )
}
