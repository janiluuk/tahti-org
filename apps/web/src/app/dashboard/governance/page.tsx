// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Link, PublicPageHeader, Text } from '@tahti/ui'
import MotionCard, { type MotionComment, type MotionSummary } from '@/app/governance/motion-card'
import FeatureRequestsList from '@/app/governance/feature-requests/feature-requests-list'
import type { FeatureRequestRef } from '@/app/governance/feature-requests/actions'

interface MeResponse {
  isMember: boolean
  isBoard: boolean
}

interface Member {
  username: string
}

interface GovernanceMeeting {
  id: string
  title: string
  type: string
  state: string
  scheduledAt: string | null
  location: string | null
  attendanceCount: number
  presentCount: number
  quorumMet: boolean | null
}

interface GovernanceDocument {
  id: string
  title: string
  type: string
  version: number
  effectiveAt: string | null
  downloadUrl: string | null
  externalUrl: string | null
}

const TOP_TOPICS_COUNT = 5

export default async function DashboardGovernancePage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

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
      <PublicPageHeader title="Governance">
        This area is for Tahti ry members. Activate your membership to take part in motions, voting,
        and topic discussions.
      </PublicPageHeader>
    )
  }

  const [motionsRes, membersRes, featureRequestsRes, meetingsRes, documentsRes] = await Promise.all(
    [
      fetch(`${apiUrl}/api/v1/governance/motions`, {
        headers: { Cookie: cookie },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/v1/governance/members`, {
        headers: { Cookie: cookie },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/v1/governance/feature-requests`, {
        headers: { Cookie: cookie },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/v1/governance/meetings`, {
        headers: { Cookie: cookie },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/v1/governance/documents`, {
        headers: { Cookie: cookie },
        cache: 'no-store',
      }),
    ],
  )

  const allMotions: MotionSummary[] = motionsRes.ok
    ? ((await motionsRes.json()) as MotionSummary[])
    : []
  const members: Member[] = membersRes.ok ? ((await membersRes.json()) as Member[]) : []
  const allFeatureRequests: FeatureRequestRef[] = featureRequestsRes.ok
    ? ((await featureRequestsRes.json()) as FeatureRequestRef[])
    : []
  const meetings: GovernanceMeeting[] = meetingsRes.ok
    ? ((await meetingsRes.json()) as GovernanceMeeting[])
    : []
  const documents: GovernanceDocument[] = documentsRes.ok
    ? ((await documentsRes.json()) as GovernanceDocument[])
    : []

  // "Needs your attention" — everything you can still act on, unvoted first so
  // the thing most worth your two minutes right now is at the top.
  const openMotions = allMotions
    .filter((m) => m.state === 'OPEN' || m.state === 'DRAFT')
    .sort((a, b) => Number(a.youVoted) - Number(b.youVoted))

  const commentsByMotion: Record<string, MotionComment[]> =
    openMotions.length === 0
      ? {}
      : await fetch(
          `${apiUrl}/api/v1/governance/motions/comments?ids=${openMotions.map((m) => m.id).join(',')}`,
          { headers: { Cookie: cookie }, cache: 'no-store' },
        )
          .then((r) => (r.ok ? (r.json() as Promise<Record<string, MotionComment[]>>) : {}))
          .catch(() => ({}))
  const openMotionsWithComments: MotionSummary[] = openMotions.map((m) => ({
    ...m,
    comments: commentsByMotion[m.id] ?? [],
  }))

  // Already sorted by vote count desc, then recency, by the API.
  const topFeatureRequests = allFeatureRequests
    .filter((r) => r.status !== 'DUPLICATE' && r.status !== 'DONE' && r.status !== 'DECLINED')
    .slice(0, TOP_TOPICS_COUNT)

  return (
    <>
      <PublicPageHeader title="Governance">
        Tahti is member-owned — this is where that actually happens. Vote on open motions, weigh in
        on topics other artists have proposed, or post your own suggestion below.
      </PublicPageHeader>

      <section className="brand-section">
        <div className="gov-header-row">
          <div>
            <h2 className="brand-section__title brand-section-heading">Needs your attention</h2>
            <p className="gov-header-row__subline">
              {openMotionsWithComments.length === 0
                ? 'No motions open right now.'
                : `${openMotionsWithComments.filter((m) => !m.youVoted).length} of ${openMotionsWithComments.length} open motion${openMotionsWithComments.length === 1 ? '' : 's'} still need your vote.`}
            </p>
          </div>
          <Link
            href="/dashboard/governance/motions"
            className="ui-btn ui-btn--secondary ui-btn--sm"
          >
            All motions →
          </Link>
        </div>

        {openMotionsWithComments.length === 0 ? (
          <div className="public-empty-card">
            <p className="public-empty-card__text">Nothing open to vote on right now.</p>
            <p className="public-empty-card__hint">
              Closed motions and full history live on the Motions page.
            </p>
          </div>
        ) : (
          <div className="gov-motion-list">
            {openMotionsWithComments.map((m) => (
              <MotionCard
                key={m.id}
                motion={m}
                motionRef={m.id}
                totalMembers={members.length}
                isBoard={me.isBoard}
              />
            ))}
          </div>
        )}
      </section>

      <section className="brand-section">
        <div className="gov-header-row">
          <div>
            <h2 className="brand-section__title brand-section-heading">Top topics</h2>
            <p className="gov-header-row__subline">
              What other members want built next — vote for what matters to you, or post your own.
            </p>
          </div>
          <Link href="/dashboard/governance/topics" className="ui-btn ui-btn--secondary ui-btn--sm">
            All topics →
          </Link>
        </div>

        <FeatureRequestsList initialRequests={topFeatureRequests} />

        {allFeatureRequests.length > TOP_TOPICS_COUNT && (
          <Text size="sm" tone="muted" className="studio-mt-sm">
            <Link href="/dashboard/governance/topics">
              +{allFeatureRequests.length - TOP_TOPICS_COUNT} more topic
              {allFeatureRequests.length - TOP_TOPICS_COUNT === 1 ? '' : 's'} →
            </Link>
          </Text>
        )}
      </section>

      <section className="brand-section governance-sound-section">
        <div className="gov-header-row">
          <div>
            <h2 className="brand-section__title brand-section-heading">Association records</h2>
            <p className="gov-header-row__subline">
              Published meetings, documents, and the current record of quorum information.
            </p>
          </div>
          <Link
            href="/transparency#member-motion-history"
            className="ui-btn ui-btn--secondary ui-btn--sm"
          >
            Public history →
          </Link>
        </div>
        <div className="governance-sound-grid">
          <div className="brand-card governance-sound-card">
            <h3>Meetings</h3>
            {meetings.length === 0 ? (
              <p className="brand-muted">No meetings published yet.</p>
            ) : (
              meetings.slice(0, 5).map((meeting) => (
                <div key={meeting.id} className="governance-sound-row">
                  <strong>{meeting.title}</strong>
                  <span className="brand-muted">
                    {meeting.state.toLowerCase().replace('_', ' ')}
                    {meeting.scheduledAt &&
                      ` · ${new Date(meeting.scheduledAt).toLocaleDateString()}`}
                    {meeting.quorumMet !== null &&
                      ` · quorum ${meeting.quorumMet ? 'met' : 'not met'}`}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="brand-card governance-sound-card">
            <h3>Documents</h3>
            {documents.length === 0 ? (
              <p className="brand-muted">No documents published yet.</p>
            ) : (
              documents.slice(0, 5).map((document) => (
                <div key={document.id} className="governance-sound-row">
                  {document.downloadUrl || document.externalUrl ? (
                    <a href={document.downloadUrl ?? document.externalUrl ?? '#'}>
                      {document.title}
                    </a>
                  ) : (
                    <strong>{document.title}</strong>
                  )}
                  <span className="brand-muted">
                    {document.type} · v{document.version}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  )
}
