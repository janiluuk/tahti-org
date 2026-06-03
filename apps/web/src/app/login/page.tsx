// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PublicBrandShell } from '@/components/public-brand-shell'
import { Button, Callout, FormField, Input } from '@/components/ui/from-tahti-ui'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const result = await login({
      email: form.get('email') as string,
      password: form.get('password') as string,
    })

    if (result.error) {
      setError(result.error)
      setPending(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <PublicBrandShell center>
      <h1>Log in</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {error && <Callout label="Error">{error}</Callout>}

        <FormField label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </FormField>

        <FormField label="Password">
          <Input name="password" type="password" required autoComplete="current-password" />
        </FormField>

        <Button type="submit" disabled={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="brand-muted" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
        No account? <Link href="/join">Join Tahti</Link>
      </p>
    </PublicBrandShell>
  )
}
