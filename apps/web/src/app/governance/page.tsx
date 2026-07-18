// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Link, PublicPageHeader, Text } from '@tahti/ui'
import { type MotionComment, type MotionSummary } from './motion-card'
import MotionsList from './motions-list'
import NewMotionForm from './new-motion-form'
import GrantPreviewPanel from './grant-preview-panel'

interface MeResponse {
  displayName: string
  username: string
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
        <PublicPageHeader
          title="Member governance"
          back={{ href: '/dashboard', label: '← Dashboard' }}
        >
          This area is for Tahti ry members. Activate your membership to take part in motions and
          voting.
        </PublicPageHeader>
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

  // Governance data volume is small (motions capped at 100, a handful open at
  // once in practice) — fetching every motion's discussion thread up front on
  // this already-fully-SSR'd page is simpler than a client-side authenticated
  // fetch-on-expand, and avoids inventing a new auth-forwarding pattern for it.
  const commentLists = await Promise.all(
    motions.map((m) =>
      fetch(`${apiUrl}/api/v1/governance/motions/${m.id}/comments`, {
        headers: { Cookie: cookie },
        cache: 'no-store',
      })
        .then((r) => (r.ok ? (r.json() as Promise<MotionComment[]>) : []))
        .catch(() => []),
    ),
  )
  const motionsWithComments: MotionSummary[] = motions.map((m, i) => ({
    ...m,
    comments: commentLists[i],
  }))

  return (
    <>
      <PublicPageHeader
        title="Member governance"
        back={{ href: '/dashboard', label: '← Dashboard' }}
      >
        Motions and voting for Tahti ry members. Voting is currently <strong>advisory</strong> —
        binding decisions are confirmed at a live AGM until the bylaws authorize electronic voting.
      </PublicPageHeader>

      <Text size="sm">
        <Link href="/governance/feature-requests">Suggest and vote on feature requests →</Link>
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
        {motions.length === 0 ? (
          <div className="public-empty-card">
            <p className="public-empty-card__text">No motions yet.</p>
            <p className="public-empty-card__hint">
              Open motions appear here for member discussion and voting.
            </p>
          </div>
        ) : (
          <MotionsList
            motions={motionsWithComments}
            totalMembers={members.length}
            isBoard={me.isBoard}
          />
        )}
      </section>

      <section className="brand-section">
        <h2 className="brand-section__title brand-section-heading">
          Member directory ({members.length})
        </h2>
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
                    {m.username === me.username && <span className="brand-badge">you</span>}
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
