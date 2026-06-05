// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Heading, Link, Text } from '@tahti/ui'
import MotionCard, { type MotionSummary } from './motion-card'
import NewMotionForm from './new-motion-form'
import GrantPreviewPanel from './grant-preview-panel'

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
      <>
        <Heading level={1}>Member governance</Heading>
        <Text tone="muted">
          This area is for Tahti ry members. Activate your membership to take part in motions and
          voting.
        </Text>
      </>
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
    <>
      <Heading level={1}>Member governance</Heading>
      <Text tone="muted">
        Motions and voting for Tahti ry members. Voting is currently <strong>advisory</strong> —
        binding decisions are confirmed at a live AGM until the bylaws authorize electronic voting.
      </Text>

      {me.isBoard && <NewMotionForm />}

      {me.isBoard && (
        <>
          <GrantPreviewPanel />
          <Text size="sm">
            <Link href="/governance/venues">Venue verification (board) →</Link>
          </Text>
        </>
      )}

      <section className="brand-section">
        <h2 className="brand-section__title">Motions</h2>
        {motions.length === 0 ? (
          <p className="brand-empty">No motions yet.</p>
        ) : (
          motions.map((m) => <MotionCard key={m.id} motion={m} isBoard={me.isBoard} />)
        )}
      </section>

      <section className="brand-section">
        <h2 className="brand-section__title">Member directory ({members.length})</h2>
        <div className="brand-table-wrap">
          <table className="brand-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Member</th>
                <th>Channel</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.username}>
                  <td className="brand-muted">{m.memberNumber ?? '—'}</td>
                  <td>
                    {m.displayName}
                    {m.isBoard && <span className="brand-badge">board</span>}
                  </td>
                  <td>
                    {m.channelSlug ? (
                      <Link href={`/c/${m.channelSlug}`}>{m.channelSlug}</Link>
                    ) : (
                      <span className="brand-empty">—</span>
                    )}
                  </td>
                  <td className="brand-muted">
                    {m.memberSince ? new Date(m.memberSince).toLocaleDateString('fi-FI') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
