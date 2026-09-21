// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Field, Input, Stack, Textarea } from '@tahti/ui'
import { completeAvatarUpload, prepareAvatarUpload } from '../channel-identity-actions'
import { saveChannelIdentity } from './setup-channel-actions'
import { wizardStepHref } from './_wizard-steps'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg']
export const DESCRIPTION_MIN = 10
export const DESCRIPTION_MAX = 300

/** Client-side check shared with the form; returns a message or null. */
export function validateIdentity(name: string, description: string): string | null {
  if (!name.trim()) return 'Give your channel a name.'
  const len = description.trim().length
  if (len < DESCRIPTION_MIN || len > DESCRIPTION_MAX) {
    return `Description must be ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} characters.`
  }
  return null
}

async function uploadLogo(file: File): Promise<string | null> {
  const prep = await prepareAvatarUpload({ filename: file.name, contentType: file.type })
  if (prep.error || !prep.uploadUrl || !prep.uploadKey) return prep.error ?? 'Prepare failed'
  const put = await fetch(prep.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!put.ok) return 'Upload failed'
  return (await completeAvatarUpload(prep.uploadKey)).error
}

export function StepIdentity({
  hasChannel,
  initialName,
  initialDescription,
}: {
  hasChannel: boolean
  initialName: string
  initialDescription: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [logo, setLogo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onLogo(file: File | undefined) {
    if (!file) return setLogo(null)
    if (!LOGO_TYPES.includes(file.type)) return setError('Logo must be a PNG or JPG.')
    if (file.size > MAX_LOGO_BYTES) return setError('Logo must be 2 MB or smaller.')
    setError(null)
    setLogo(file)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const invalid = validateIdentity(name, description)
    if (invalid) return setError(invalid)
    setError(null)
    startTransition(async () => {
      const saved = await saveChannelIdentity({
        displayName: name.trim(),
        bio: description.trim(),
        createChannel: !hasChannel,
      })
      if (saved.error) return setError(saved.error)
      if (logo) {
        const logoError = await uploadLogo(logo)
        if (logoError) return setError(`Channel saved, but the logo failed: ${logoError}`)
      }
      router.push(wizardStepHref(2))
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack gap={4}>
        {error && <Alert variant="error">{error}</Alert>}
        <Field label="Station name" htmlFor="setup-name">
          <Input
            id="setup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </Field>
        <Field label="Logo" htmlFor="setup-logo" hint="Optional — PNG or JPG, 2 MB max">
          <Input
            id="setup-logo"
            type="file"
            accept={LOGO_TYPES.join(',')}
            onChange={(e) => onLogo(e.target.files?.[0])}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="setup-description"
          hint={`${description.trim().length}/${DESCRIPTION_MAX} — at least ${DESCRIPTION_MIN}`}
        >
          <Textarea
            id="setup-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            required
          />
        </Field>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Continue'}
        </Button>
      </Stack>
    </form>
  )
}
