// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ARCHIVE_GENRES } from '@tahti/shared'
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
import { COUNTRY_OPTIONS } from '@/lib/country-options'
import { flagEmoji } from '@/lib/flag-emoji'
import { updateSignupProfile } from '../actions'
import { SignupWizard } from '../signup-wizard'

export function SignupProfileForm({ displayName }: { displayName: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre].slice(0, 6),
    )
  }

  function skip() {
    router.push('/signup/broadcast')
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateSignupProfile({
        displayName: (form.get('displayName') as string).trim(),
        bio: (form.get('bio') as string).trim(),
        avatarUrl: (form.get('avatarUrl') as string).trim(),
        countryCode: (form.get('countryCode') as string) || null,
        genreTags: selectedGenres.join(', '),
        website: (form.get('website') as string).trim(),
        soundcloud: (form.get('soundcloud') as string).trim(),
        bandcamp: (form.get('bandcamp') as string).trim(),
      })

      if (result.error) {
        setError(result.error)
        return
      }

      router.push('/signup/broadcast')
    })
  }

  return (
    <>
      <BgCanvas variant="subtle" />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark auth-card--wide">
          <BrandLogo />
          <SignupWizard current="profile" />
          <Heading level={1}>Set up your profile</Heading>
          <Text tone="muted" size="sm">
            Listeners see this on your public page at your-handle.tahti.live. You can change it
            any time from the dashboard.
          </Text>

          <form onSubmit={onSubmit}>
            <Stack gap={4}>
              {error && <Alert variant="error">{error}</Alert>}

              <Field label="Artist name" htmlFor="signup-profile-name">
                <Input
                  id="signup-profile-name"
                  name="displayName"
                  required
                  maxLength={100}
                  defaultValue={displayName}
                />
              </Field>

              <Field
                label="Avatar image URL"
                htmlFor="signup-profile-avatar"
                hint="Optional — paste a link to a square image (PNG or JPG)"
              >
                <Input
                  id="signup-profile-avatar"
                  name="avatarUrl"
                  type="url"
                  placeholder="https://…"
                />
              </Field>

              <Field label="Bio" htmlFor="signup-profile-bio" hint="Markdown supported">
                <Textarea
                  id="signup-profile-bio"
                  name="bio"
                  rows={4}
                  maxLength={5000}
                  placeholder="Tell listeners about your sound, shows, and releases…"
                />
              </Field>

              <Field label="Country" htmlFor="signup-profile-country">
                <select id="signup-profile-country" name="countryCode" className="ui-input">
                  <option value="">Select country (optional)</option>
                  {COUNTRY_OPTIONS.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {flagEmoji(code)} {label}
                    </option>
                  ))}
                </select>
              </Field>

              <fieldset className="signup-fieldset">
                <legend className="signup-fieldset__legend">Genre tags (up to 6)</legend>
                <div className="signup-genre-grid">
                  {ARCHIVE_GENRES.map((genre) => (
                    <label key={genre} className="signup-genre-chip">
                      <input
                        type="checkbox"
                        checked={selectedGenres.includes(genre)}
                        onChange={() => toggleGenre(genre)}
                      />
                      <span>{genre}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field
                label="Website"
                htmlFor="signup-profile-website"
                hint="Shown as a link on your profile"
              >
                <Input
                  id="signup-profile-website"
                  name="website"
                  type="url"
                  placeholder="https://your-site.com"
                />
              </Field>

              <div className="signup-profile-links">
                <Field label="SoundCloud" htmlFor="signup-profile-soundcloud">
                  <Input
                    id="signup-profile-soundcloud"
                    name="soundcloud"
                    type="url"
                    placeholder="https://soundcloud.com/…"
                  />
                </Field>
                <Field label="Bandcamp" htmlFor="signup-profile-bandcamp">
                  <Input
                    id="signup-profile-bandcamp"
                    name="bandcamp"
                    type="url"
                    placeholder="https://….bandcamp.com"
                  />
                </Field>
              </div>

              <Button type="submit" variant="primary" disabled={isPending}>
                <ButtonIcon name="arrowRight" />
                {isPending ? 'Saving…' : 'Save and continue'}
              </Button>

              <Button type="button" variant="ghost" onClick={skip} disabled={isPending}>
                Skip for now
              </Button>

              <Text tone="muted" size="sm">
                <Link href="/signup/payment">← Back to membership</Link>
              </Text>
            </Stack>
          </form>
        </div>
      </div>
    </>
  )
}
