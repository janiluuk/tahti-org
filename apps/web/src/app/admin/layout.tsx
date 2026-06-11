// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { AdminShell, AdminShellHeader } from '@tahti/ui'
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

  const me = (await res.json()) as { isBoard: boolean; displayName: string; username: string }
  if (!me.isBoard) redirect('/dashboard')
  return me
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireBoardSession()
  const initial = me.displayName.trim().charAt(0).toUpperCase()

  return (
    <AdminShell
      variant="studio"
      displayName={me.displayName}
      sidebar={<AdminNav />}
      header={
        <AdminShellHeader
          displayName={me.displayName}
          username={me.username}
          userInitial={initial}
        />
      }
    >
      {children}
    </AdminShell>
  )
}
