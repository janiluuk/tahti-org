// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  DataRowList,
  DataRowListEmpty,
  DataRowListHeader,
  DataRowListRow,
  fanSubBreakdownLines,
  KpiCard,
  KpiCardRow,
  MoneyBreakdown,
  MoneyCell,
  PageShell,
  StatusPill,
} from '@tahti/ui'
import { ManageStripeAccountLink } from './manage-stripe-account-link'

const PAYOUT_COLUMNS = '80px 1fr 80px 70px'
const ROW_LIMIT = 12

interface FanTier {
  id: string
}

interface FanSubPayout {
  id: string
  state: string
  tierName: string
  netToArtistCents: number
  paidAt: string | null
  createdAt: string
}

interface FanPayoutsDashboard {
  activeSubscribers: number
  thisMonthNetCents: number
  paidYtdNetCents: number
  recent: FanSubPayout[]
}

interface ConnectStatus {
  accountId: string | null
}

interface GrantEstimate {
  year: number
  estimateCents: number
}

interface RevelatorRoyaltyRow {
  id: string
  releaseTitle: string
  periodEnd: string
  amountCents: number
}

async function apiFetch<T>(apiUrl: string, cookie: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

interface PayoutRow {
  date: Date
  description: string
  status: 'PAID' | 'PENDING' | 'FAILED'
  netCents: number
}

export default async function RevenuePage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [tiers, payouts, connect, grantEstimate, royalties] = await Promise.all([
    apiFetch<FanTier[]>(apiUrl, cookie, '/api/me/fan-tiers'),
    apiFetch<FanPayoutsDashboard>(apiUrl, cookie, '/api/me/fan-sub-payouts'),
    apiFetch<ConnectStatus>(apiUrl, cookie, '/api/me/fan-subs/connect'),
    apiFetch<GrantEstimate>(apiUrl, cookie, '/api/me/grants/estimate'),
    apiFetch<{ reports: RevelatorRoyaltyRow[] }>(apiUrl, cookie, '/api/me/revelator/royalties'),
  ])

  const hasFanSubs = (tiers ?? []).length > 0
  const stats = payouts ?? {
    activeSubscribers: 0,
    thisMonthNetCents: 0,
    paidYtdNetCents: 0,
    recent: [],
  }
  const estimate = grantEstimate ?? { year: new Date().getFullYear(), estimateCents: 0 }

  const rows: PayoutRow[] = [
    ...stats.recent.map(
      (p): PayoutRow => ({
        date: new Date(p.paidAt ?? p.createdAt),
        description: `Fan-sub — ${p.tierName}`,
        status: p.state as PayoutRow['status'],
        netCents: p.netToArtistCents,
      }),
    ),
    ...(royalties?.reports ?? []).map(
      (r): PayoutRow => ({
        date: new Date(r.periodEnd),
        description: `Distribution royalties — ${r.releaseTitle}`,
        status: 'PAID',
        netCents: r.amountCents,
      }),
    ),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, ROW_LIMIT)

  return (
    <PageShell size="md">
      <div className="admin-header-row">
        <div>
          <div className="admin-header-row__title-line">
            <h3 className="admin-header-row__title">Revenue</h3>
          </div>
          <p className="admin-header-row__subline">
            Fan-subs flow direct via Stripe Connect — Tahti takes 0% + 2% ops fee
          </p>
        </div>
        {connect?.accountId ? (
          <div className="admin-header-row__actions">
            <ManageStripeAccountLink />
          </div>
        ) : null}
      </div>

      <KpiCardRow aria-label="Revenue summary">
        <KpiCard color="cyan" value={eur(stats.thisMonthNetCents)} label="This month" />
        <KpiCard color="purple" value={stats.activeSubscribers} label="Active fan-subs" />
        <KpiCard color="green" value={eur(stats.paidYtdNetCents)} label="Paid out YTD" />
        <KpiCard
          color="amber"
          value={`~${eur(estimate.estimateCents)}`}
          label={`Grant estimate (Y${estimate.year} pool)`}
        />
      </KpiCardRow>

      {hasFanSubs ? (
        <div className="revenue-grid">
          <div>
            <h4 className="admin-section-label">Payout history</h4>
            <DataRowList>
              <DataRowListHeader columns={PAYOUT_COLUMNS}>
                <span>Date</span>
                <span>Description</span>
                <span>Status</span>
                <span className="num">Net</span>
              </DataRowListHeader>
              {rows.length === 0 ? (
                <DataRowListEmpty>No payouts yet.</DataRowListEmpty>
              ) : (
                rows.map((row, i) => (
                  <DataRowListRow key={i} columns={PAYOUT_COLUMNS}>
                    <span>{row.date.toLocaleDateString('fi-FI')}</span>
                    <span>{row.description}</span>
                    <StatusPill
                      tone={
                        row.status === 'PAID'
                          ? 'green'
                          : row.status === 'PENDING'
                            ? 'amber'
                            : 'coral'
                      }
                    >
                      {row.status}
                    </StatusPill>
                    {row.status === 'PENDING' ? (
                      <span className="num revenue-pending">--</span>
                    ) : (
                      <MoneyCell value={row.netCents} className="num">
                        {eur(row.netCents)}
                      </MoneyCell>
                    )}
                  </DataRowListRow>
                ))
              )}
            </DataRowList>
            <p className="admin-footnote">
              Subscriber CSV export + GDPR tools in{' '}
              <Link href="/dashboard#audience">Settings → Fan subs</Link>.
            </p>
          </div>

          <div>
            <h4 className="admin-section-label">Where €5/mo goes</h4>
            <MoneyBreakdown lines={fanSubBreakdownLines(500)} />
          </div>
        </div>
      ) : (
        <div className="studio-empty-card studio-mt-xl">
          <p className="studio-empty-card__text">No fan subscriptions yet.</p>
          <p className="studio-empty-card__hint">
            Set up subscription tiers so fans can support you directly — head to{' '}
            <Link href="/dashboard#audience">Settings → Fan subs</Link> to enable tiers.
          </p>
        </div>
      )}
    </PageShell>
  )
}
