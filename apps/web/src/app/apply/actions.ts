// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export async function submitBetaApplication(formData: FormData): Promise<{ error: string | null }> {
  const payload = {
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    artistType: String(formData.get('artistType') ?? '').trim(),
    links: String(formData.get('links') ?? '').trim() || undefined,
    message: String(formData.get('message') ?? '').trim() || undefined,
  }

  const res = await fetch(`${apiUrl}/api/beta/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not send application' }
  }

  return { error: null }
}
