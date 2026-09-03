// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Panel } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { MembershipStatusStrip } from '../_membership-status-strip'

interface MembershipInfo {
  status: string
  isMember: boolean
  memberNumber: number | null
}

interface Invoice {
  id: string
  number: string | null
  status: string | null
  amountPaidCents: number
  currency: string
  created: string
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
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

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function InvoicesSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [user, membershipInfo, invoicesRes] = await Promise.all([
    getDashboardUser(),
    apiFetch<MembershipInfo>(apiUrl, cookie, '/api/me/membership'),
    apiFetch<{ invoices: Invoice[] }>(apiUrl, cookie, '/api/me/invoices'),
  ])
  if (!user) redirect('/login')

  const invoices = invoicesRes?.invoices ?? []

  return (
    <div className="studio-settings-stack">
      <h1 className="ui-heading ui-heading--2">Invoices</h1>
      <MembershipStatusStrip
        isMember={membershipInfo?.isMember ?? false}
        memberNumber={membershipInfo?.memberNumber ?? null}
        status={membershipInfo?.status ?? 'PENDING_EMAIL'}
      />
      <Panel title="Invoice history" headerTight>
        {invoices.length === 0 ? (
          <p className="studio-help">
            No invoices yet. Membership receipts appear here once you&apos;ve paid via Stripe.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="studio-table studio-table--sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{formatDate(inv.created)}</td>
                    <td>{formatAmount(inv.amountPaidCents, inv.currency)}</td>
                    <td>{inv.status ?? '—'}</td>
                    <td>
                      {inv.hostedInvoiceUrl && (
                        <a
                          href={inv.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="studio-link"
                        >
                          View
                        </a>
                      )}
                      {inv.invoicePdf && (
                        <>
                          {' · '}
                          <a
                            href={inv.invoicePdf}
                            target="_blank"
                            rel="noreferrer"
                            className="studio-link"
                          >
                            PDF
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
