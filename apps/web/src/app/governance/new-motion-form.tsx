// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Alert, Button, Field, Heading, Input, Row, Stack, Textarea } from '@tahti/ui'
import { createMotion } from './actions'

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 16)
}

export default function NewMotionForm() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [openAt, setOpenAt] = useState(isoDaysFromNow(0))
  const [closeAt, setCloseAt] = useState(isoDaysFromNow(14))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createMotion({
        title,
        description,
        openAt: new Date(openAt).toISOString(),
        closeAt: new Date(closeAt).toISOString(),
      })
      if (res.error) {
        setError(res.error)
      } else {
        setTitle('')
        setDescription('')
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <div className="brand-section">
        <Button variant="ghost" onClick={() => setOpen(true)}>
          + New motion
        </Button>
      </div>
    )
  }

  return (
    <div className="brand-card brand-section">
      <Heading level={3}>New motion (saved as draft)</Heading>
      <Stack gap={4}>
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Motion title"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the motion…"
            rows={4}
          />
        </Field>
        <div className="brand-form-row">
          <Field label="Opens">
            <Input
              type="datetime-local"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
            />
          </Field>
          <Field label="Closes">
            <Input
              type="datetime-local"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
            />
          </Field>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <Row gap={2}>
          <Button
            variant="primary"
            onClick={submit}
            disabled={pending || !title.trim() || !description.trim()}
          >
            {pending ? 'Saving…' : 'Create draft'}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </div>
  )
}
