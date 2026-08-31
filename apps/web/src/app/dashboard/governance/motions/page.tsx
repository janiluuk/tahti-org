// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Link, PublicPageHeader, StatCard, StatCardGrid, Text } from '@tahti/ui'
import { type MotionComment, type MotionSummary } from '@/app/governance/motion-card'
import MotionsList from '@/app/governance/motions-list'
import NewMotionForm from '@/app/governance/new-motion-form'
import GrantPreviewPanel from '@/app/governance/grant-preview-panel'
import { resolveChannelUrl } from '@/lib/app-url'

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

interface BoardResolution {
  id: string
  title: string
  votedAt: string
  outcome: 'PASSED' | 'FAILED' | 'DEFERRED'
  voteFor: number
  voteAgainst: number
  voteAbstain: number
}

interface QuarterlyReport {
  id: string
  year: number
  quarter: number
  generatedAt: string
  generatedByDisplayName: string
  downloadUrl: string | null
}

export default async function DashboardMotionsPage() {
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
      <PublicPageHeader
        title="Member governance"
        back={{ href: '/dashboard/governance', label: '← Governance' }}
      >
        This area is for Tahti ry members. Activate your membership to take part in motions and
        voting.
      </PublicPageHeader>
    )
  }

  const [motionsRes, membersRes, resolutionsRes, quarterlyReportsRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/governance/motions`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/api/v1/governance/members`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/api/v1/transparency/resolutions`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/v1/governance/quarterly-reports`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    }),
  ])

  const motions: MotionSummary[] = motionsRes.ok
    ? ((await motionsRes.json()) as MotionSummary[])
    : []
  const members: Member[] = membersRes.ok ? ((await membersRes.json()) as Member[]) : []
  const resolutions: BoardResolution[] = resolutionsRes.ok
    ? ((await resolutionsRes.json()) as BoardResolution[])
    : []
  const quarterlyReports: QuarterlyReport[] = quarterlyReportsRes.ok
    ? ((await quarterlyReportsRes.json()) as QuarterlyReport[])
    : []

  const closedMotions = motions.filter((m) => m.state === 'CLOSED' && m.tally)
  const decidedCount = closedMotions.length
  const passedCount = closedMotions.filter((m) => (m.tally!.YES ?? 0) > (m.tally!.NO ?? 0)).length
  const totalVotesCast = closedMotions.reduce(
    (sum, m) => sum + m.tally!.YES + m.tally!.NO + m.tally!.ABSTAIN,
    0,
  )
  const avgTurnoutPct =
    decidedCount > 0 && members.length > 0
      ? Math.round((totalVotesCast / (decidedCount * members.length)) * 100)
      : 0

  const commentsByMotion: Record<string, MotionComment[]> =
    motions.length === 0
      ? {}
      : await fetch(
          `${apiUrl}/api/v1/governance/motions/comments?ids=${motions.map((m) => m.id).join(',')}`,
          { headers: { Cookie: cookie }, cache: 'no-store' },
        )
          .then((r) => (r.ok ? (r.json() as Promise<Record<string, MotionComment[]>>) : {}))
          .catch(() => ({}))
  const motionsWithComments: MotionSummary[] = motions.map((m) => ({
    ...m,
    comments: commentsByMotion[m.id] ?? [],
  }))

  return (
    <>
      <PublicPageHeader
        title="Motions & voting"
        back={{ href: '/dashboard/governance', label: '← Governance' }}
      >
        Motions and voting for Tahti ry members. Voting is currently <strong>advisory</strong> —
        binding decisions are confirmed at a live AGM until the bylaws authorize electronic voting.
      </PublicPageHeader>

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
        <h2 className="brand-section__title brand-section-heading">Statistics</h2>

        <StatCardGrid cols={3} aria-label="Motion voting statistics">
          <StatCard variant="neutral" value={String(decidedCount)} label="Motions decided" />
          <StatCard
            variant="fans"
            value={String(passedCount)}
            label="Passed"
            subtitle={decidedCount > 0 ? `of ${decidedCount}` : undefined}
          />
          <StatCard variant="neutral" value={`${avgTurnoutPct}%`} label="Avg. member turnout" />
        </StatCardGrid>

        <div className="gov-stats-columns">
          <div>
            <h3 className="gov-stats-columns__title">
              Board resolutions ({new Date().getFullYear()})
            </h3>
            {resolutions.length === 0 ? (
              <Text size="sm" tone="muted">
                No resolutions published for this year yet.
              </Text>
            ) : (
              <ul className="gov-stats-list">
                {resolutions.slice(0, 8).map((r) => (
                  <li key={r.id} className="gov-stats-list__item">
                    <span>{r.title}</span>
                    <span className="brand-muted">
                      {r.outcome === 'PASSED'
                        ? `Passed · ${r.voteFor}–${r.voteAgainst}`
                        : r.outcome === 'FAILED'
                          ? `Failed · ${r.voteFor}–${r.voteAgainst}`
                          : 'Deferred'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Text size="sm">
              <Link href="/transparency">Full resolution history →</Link>
            </Text>
          </div>

          <div>
            <h3 className="gov-stats-columns__title">Quarterly topic reports</h3>
            {quarterlyReports.length === 0 ? (
              <Text size="sm" tone="muted">
                No quarterly reports published yet.
              </Text>
            ) : (
              <ul className="gov-stats-list">
                {quarterlyReports.map((r) => (
                  <li key={r.id} className="gov-stats-list__item">
                    <span>
                      Q{r.quarter} {r.year}
                    </span>
                    {r.downloadUrl ? (
                      <a href={r.downloadUrl} className="brand-muted">
                        Download →
                      </a>
                    ) : (
                      <span className="brand-empty">unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
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
                      <Link href={resolveChannelUrl(m.channelSlug)}>{m.channelSlug}</Link>
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
