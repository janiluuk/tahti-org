// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@/components/admin-shell.css'

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/streams', label: 'Streams' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/financial', label: 'Financial' },
  { href: '/admin/governance', label: 'Governance' },
  { href: '/admin/status', label: 'Status' },
] as const

async function requireBoardSession() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/admin')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/auth/me`, {
    headers: { Cookie: `tahti_session=${sessionCookie.value}` },
    cache: 'no-store',
  })
  if (!res.ok) redirect('/login?next=/admin')

  const me = (await res.json()) as { isBoard: boolean; displayName: string }
  if (!me.isBoard) redirect('/dashboard')
  return me
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireBoardSession()

  return (
    <div data-tahti-ui="studio" className="tahti-studio admin-shell">
      <header className="studio-top-nav">
        <Link href="/admin/dashboard" className="studio-top-nav__logo">
          TAHTI ADMIN
        </Link>
        <div className="studio-top-nav__actions">
          <Link href="/dashboard" className="studio-top-nav__link">
            Artist dashboard
          </Link>
          <Link href="/governance" className="studio-top-nav__link">
            Governance
          </Link>
        </div>
      </header>
      <div className="db-layout">
        <aside className="db-sidebar">
          <nav aria-label="Admin sections">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href} className="db-nav-item">
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="db-main admin-main">{children}</main>
      </div>
    </div>
  )
}
