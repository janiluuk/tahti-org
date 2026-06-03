// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import MotionCard, { type MotionSummary } from './motion-card'
import NewMotionForm from './new-motion-form'

interface MeResponse {
  displayName: string
  isMember: boolean
  isBoard: boolean
}

interface Member {
  memberNumber: number | null
  displayName: string
  username: string
  memberSince: string | null
  isBoard: boolean
  channelSlug: string | null
}

export default async function GovernancePage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie!.value}`

  let me: MeResponse
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) redirect('/login')
    me = (await res.json()) as MeResponse
  } catch {
    redirect('/login')
  }

  if (!me.isMember) {
    return (
      <div style={{ maxWidth: 700, margin: '3rem auto', padding: '0 1rem' }}>
        <h1>Member governance</h1>
        <p style={{ color: '#666' }}>
          This area is for Tahti ry members. Activate your membership to take part in motions and
          voting.
        </p>
      </div>
    )
  }

  const [motionsRes, membersRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/governance/motions`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/api/v1/governance/members`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    }),
  ])

  const motions: MotionSummary[] = motionsRes.ok
    ? ((await motionsRes.json()) as MotionSummary[])
    : []
  const members: Member[] = membersRes.ok ? ((await membersRes.json()) as Member[]) : []

  return (
    <div
      style={{
        maxWidth: 820,
        margin: '3rem auto',
        padding: '0 1rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ marginBottom: '0.25rem' }}>Member governance</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Motions and voting for Tahti ry members. Voting is currently <strong>advisory</strong> —
        binding decisions are confirmed at a live AGM until the bylaws authorize electronic voting.
      </p>

      {me.isBoard && <NewMotionForm />}

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1rem', color: '#444', marginBottom: '1rem' }}>Motions</h2>
        {motions.length === 0 ? (
          <p style={{ color: '#aaa' }}>No motions yet.</p>
        ) : (
          motions.map((m) => <MotionCard key={m.id} motion={m} isBoard={me.isBoard} />)
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', color: '#444', marginBottom: '1rem' }}>
          Member directory ({members.length})
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem', color: '#666' }}>#</th>
                <th style={{ padding: '0.5rem 0.75rem', color: '#666' }}>Member</th>
                <th style={{ padding: '0.5rem 0.75rem', color: '#666' }}>Channel</th>
                <th style={{ padding: '0.5rem 0.75rem', color: '#666' }}>Since</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.username} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#999' }}>
                    {m.memberNumber ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {m.displayName}
                    {m.isBoard && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#2563eb' }}>
                        board
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {m.channelSlug ? (
                      <a href={`/c/${m.channelSlug}`}>{m.channelSlug}</a>
                    ) : (
                      <span style={{ color: '#ccc' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#888' }}>
                    {m.memberSince ? new Date(m.memberSince).toLocaleDateString('fi-FI') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
