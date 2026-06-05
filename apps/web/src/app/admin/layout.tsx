// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@/components/admin-shell.css'
import { AdminNav } from './admin-nav'

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
  const me = await requireBoardSession()
  const initial = me.displayName.trim().charAt(0).toUpperCase()

  return (
    <div data-tahti-ui="studio" className="tahti-studio admin-shell">
      <header className="studio-top-nav">
        <Link href="/admin/dashboard" className="studio-top-nav__logo admin-top-logo">
          TAHTI ADMIN
        </Link>
        <div className="studio-top-nav__actions">
          <div className="studio-top-nav__user" aria-label={`Signed in as ${me.displayName}`}>
            <span className="studio-top-nav__user-avatar admin-user-avatar" aria-hidden>
              {initial}
            </span>
            <span className="studio-top-nav__user-name">{me.displayName}</span>
          </div>
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
          <AdminNav />
        </aside>
        <main className="db-main admin-main">{children}</main>
      </div>
    </div>
  )
}
