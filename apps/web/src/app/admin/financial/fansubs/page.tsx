// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { RetryPayoutButton } from './retry-payout-button'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

function formatEur(cents: number): string {
  return `€${(cents / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2 })}`
}

export default async function AdminFanSubsPage() {
  const [overviewRes, payoutsRes, artistsRes] = await Promise.all([
    boardFetch('/api/admin/fansubs/overview'),
    boardFetch('/api/admin/fansubs/payouts?limit=50'),
    boardFetch('/api/admin/fansubs/by-artist'),
  ])

  const overview = overviewRes.ok
    ? ((await overviewRes.json()) as {
        activeFanSubCount: number
        mrrCents: number
        artistsWithSubscribers: number
        pendingPayouts: { count: number; totalNetCents: number }
        failedPayouts: { count: number; totalNetCents: number }
      })
    : {
        activeFanSubCount: 0,
        mrrCents: 0,
        artistsWithSubscribers: 0,
        pendingPayouts: { count: 0, totalNetCents: 0 },
        failedPayouts: { count: 0, totalNetCents: 0 },
      }

  const payouts = payoutsRes.ok
    ? ((await payoutsRes.json()) as {
        payouts: Array<{
          id: string
          state: string
          artistDisplayName: string
          artistUsername: string
          subscriberDisplayName: string
          netToArtistCents: number
          forPeriodStart: string
          stripeTransferId: string | null
        }>
      })
    : { payouts: [] }

  const artists = artistsRes.ok
    ? ((await artistsRes.json()) as Array<{
        displayName: string
        username: string
        activeSubscriberCount: number
        mrrCents: number
        totalPaidCents: number
        stripeConnectChargesEnabled: boolean
      }>)
    : []

  return (
    <>
      <h1 className="admin-section-title">Fan subscriptions</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/financial">← Financial</Link>
      </p>

      <div className="admin-panel-grid">
        <section className="admin-card">
          <h2>Active subs</h2>
          <p className="admin-stat">{overview.activeFanSubCount}</p>
          <p className="admin-stat-sub">MRR {formatEur(overview.mrrCents)}</p>
        </section>
        <section className="admin-card">
          <h2>Artists</h2>
          <p className="admin-stat">{overview.artistsWithSubscribers}</p>
          <p className="admin-stat-sub">with at least one subscriber</p>
        </section>
        <section className="admin-card">
          <h2>Pending payouts</h2>
          <p className="admin-stat">{overview.pendingPayouts.count}</p>
          <p className="admin-stat-sub">{formatEur(overview.pendingPayouts.totalNetCents)} net</p>
        </section>
        <section className="admin-card">
          <h2>Failed payouts</h2>
          <p className={`admin-stat ${overview.failedPayouts.count > 0 ? 'admin-warn' : ''}`}>
            {overview.failedPayouts.count}
          </p>
          <p className="admin-stat-sub">{formatEur(overview.failedPayouts.totalNetCents)} net</p>
        </section>
      </div>

      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <h2>Payout queue</h2>
        {payouts.payouts.length === 0 ? (
          <p className="admin-stat-sub">No pending or failed payouts.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Artist</th>
                  <th>Subscriber</th>
                  <th>Period</th>
                  <th>Net</th>
                  <th>State</th>
                  <th>Transfer</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payouts.payouts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/u/${p.artistUsername}`}>{p.artistDisplayName}</Link>
                    </td>
                    <td>{p.subscriberDisplayName}</td>
                    <td>{new Date(p.forPeriodStart).toLocaleDateString()}</td>
                    <td>{formatEur(p.netToArtistCents)}</td>
                    <td className={p.state === 'FAILED' ? 'admin-err' : ''}>{p.state}</td>
                    <td>{p.stripeTransferId ?? '—'}</td>
                    <td>{p.state === 'FAILED' ? <RetryPayoutButton payoutId={p.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-card">
        <h2>By artist</h2>
        {artists.length === 0 ? (
          <p className="admin-stat-sub">No active fan subscriptions.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Artist</th>
                  <th>Subs</th>
                  <th>MRR</th>
                  <th>Total paid</th>
                  <th>Stripe Connect</th>
                </tr>
              </thead>
              <tbody>
                {artists.map((a) => (
                  <tr key={a.username}>
                    <td>
                      <Link href={`/u/${a.username}`}>{a.displayName}</Link>
                    </td>
                    <td>{a.activeSubscriberCount}</td>
                    <td>{formatEur(a.mrrCents)}</td>
                    <td>{formatEur(a.totalPaidCents)}</td>
                    <td className={a.stripeConnectChargesEnabled ? 'admin-ok' : 'admin-warn'}>
                      {a.stripeConnectChargesEnabled ? 'Enabled' : 'Not connected'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
