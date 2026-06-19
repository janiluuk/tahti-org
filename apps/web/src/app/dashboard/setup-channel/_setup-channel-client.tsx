// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, SidebarNavIconSvg } from '@tahti/ui'
import { provisionChannel } from './setup-channel-actions'

export function SetupChannelClient({ slug }: { slug: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function create() {
    setError(null)
    startTransition(async () => {
      const res = await provisionChannel()
      if (res.error) {
        setError(res.error)
        return
      }
      router.push('/dashboard/broadcast')
      router.refresh()
    })
  }

  return (
    <>
      {error && <Alert variant="error">{error}</Alert>}
      <Button
        type="button"
        onClick={create}
        disabled={isPending}
        className="setup-channel-page__cta"
      >
        <SidebarNavIconSvg name="channel" />
        {isPending ? 'Creating your channel…' : `Create ${slug}.tahti.live`}
      </Button>
    </>
  )
}
