// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BETA_APPLY_MAX_LINKS } from '@tahti/shared'
import {
  Alert,
  BrandLogo,
  Button,
  ButtonIcon,
  Field,
  Heading,
  Input,
  Stack,
  Text,
  Textarea,
} from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { submitBetaApplication } from './actions'

export function BetaApplyForm() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [linkRows, setLinkRows] = useState([0])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const { error: err } = await submitBetaApplication(new FormData(e.currentTarget))
    setPending(false)
    if (err) {
      setError(err)
      return
    }
    setSent(true)
  }

  function addLinkRow() {
    setLinkRows((rows) => (rows.length >= BETA_APPLY_MAX_LINKS ? rows : [...rows, rows.length]))
  }

  function removeLinkRow(index: number) {
    setLinkRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)))
  }

  if (sent) {
    return (
      <>
        <BgCanvas variant="subtle" />
        <div className="auth-shell">
          <div className="auth-card auth-card--dark auth-card--wide">
            <BrandLogo />
            <Heading level={1}>Application received</Heading>
            <Text tone="muted">
              We&apos;ll reply personally at the email you provided. Already invited?{' '}
              <Link href="/login?register">Create your artist account</Link>.
            </Text>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <BgCanvas variant="subtle" />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark auth-card--wide">
          <BrandLogo />
          <Heading level={1}>Apply for the private beta</Heading>
          <Text tone="muted">
            We&apos;re inviting 30–50 working artists from EU electronic scenes. All applications
            are reviewed personally.
          </Text>

          <form onSubmit={onSubmit}>
            <Stack gap={4}>
              {error && (
                <Alert variant="error">
                  {error}. You can also email{' '}
                  <a href="mailto:support@tahti.live">support@tahti.live</a>.
                </Alert>
              )}

              <Field label="Your name">
                <Input name="name" required maxLength={120} placeholder="DJ Moonrise" />
              </Field>

              <Field label="Email address">
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>

              <Field label="What kind of artist are you?">
                <Input
                  name="artistType"
                  required
                  maxLength={200}
                  placeholder="DJ / producer / live electronics / experimental…"
                />
              </Field>

              <Field label="Links to your music (optional)">
                <div className="auth-link-rows">
                  {linkRows.map((rowId, index) => (
                    <div className="auth-link-row" key={rowId}>
                      <Input
                        name="links"
                        inputMode="url"
                        maxLength={500}
                        placeholder={
                          index === 0
                            ? 'SoundCloud, Mixcloud, Bandcamp, personal site…'
                            : 'Another link…'
                        }
                      />
                      {linkRows.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="auth-link-row-btn"
                          aria-label="Remove link"
                          onClick={() => removeLinkRow(index)}
                        >
                          −
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {linkRows.length < BETA_APPLY_MAX_LINKS ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="auth-link-row-add"
                      onClick={addLinkRow}
                    >
                      + Add another link
                    </Button>
                  ) : null}
                </div>
              </Field>

              <Field label="Anything else?">
                <Textarea
                  name="message"
                  rows={3}
                  maxLength={5000}
                  placeholder="Your setup, what you broadcast, what frustrates you about existing platforms…"
                />
              </Field>

              <Button variant="primary" size="lg" type="submit" disabled={pending}>
                <ButtonIcon name="send" />
                {pending ? 'Sending…' : 'Apply for beta'}
              </Button>

              <Text size="sm" tone="muted">
                Already have an invite? <Link href="/login?register">Create an artist account</Link>
              </Text>
            </Stack>
          </form>
        </div>
      </div>
    </>
  )
}
