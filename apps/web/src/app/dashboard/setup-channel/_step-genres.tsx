// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { SOUND_GENRES } from '@tahti/shared'
import { Alert, Button, Stack } from '@tahti/ui'
import { MAX_GENRES, toggleGenre } from './_genres'
import { saveChannelGenresAndListing } from './setup-channel-actions'
import { wizardStepHref } from './_wizard-steps'

export function StepGenres({
  initialGenres,
  initialListed,
}: {
  initialGenres: string[]
  initialListed: boolean
}) {
  const router = useRouter()
  const [genres, setGenres] = useState(initialGenres)
  const [listed, setListed] = useState(initialListed)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await saveChannelGenresAndListing({ genres, listed })
      if (res.error) return setError(res.error)
      router.push(wizardStepHref(3))
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack gap={4}>
        {error && <Alert variant="error">{error}</Alert>}
        <fieldset className="signup-fieldset">
          <legend className="signup-fieldset__legend">
            Genres — {genres.length}/{MAX_GENRES} selected
          </legend>
          <div className="signup-genre-grid">
            {SOUND_GENRES.map((genre) => (
              <label key={genre} className="signup-genre-chip">
                <input
                  type="checkbox"
                  checked={genres.includes(genre)}
                  onChange={() => setGenres((prev) => toggleGenre(prev, genre))}
                />
                <span>{genre}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="signup-genre-chip">
          <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} />
          <span>List my channel and new tracks in public directories and top lists</span>
        </label>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Continue'}
        </Button>
      </Stack>
    </form>
  )
}
