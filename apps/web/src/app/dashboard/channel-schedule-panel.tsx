// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ButtonIcon, Button } from '@tahti/ui'
import { WEEKDAY_LABELS, type LiveShowSeriesView, type ScheduledLiveShowView } from '@tahti/shared'
import { Panel } from '@/components/ui'
import {
  cancelScheduledLiveShow,
  createLiveShowSeries,
  scheduleLiveShowEpisode,
  updateChannelSchedule,
  updateLiveShowSeriesRecurrence,
} from './channel-schedule-actions'

// Sun(0)..Sat(6) order to match WEEKDAY_LABELS/JS Date#getDay, but the button
// row itself reads left-to-right starting Monday — how artists actually think
// about a weekly show schedule.
const FREQUENCY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default function ChannelSchedulePanel({
  initialAt,
  initialNote,
  initialSeries,
  initialScheduledShows,
  isLive = false,
}: {
  initialAt: string | null
  initialNote: string | null
  initialSeries: LiveShowSeriesView[]
  initialScheduledShows: ScheduledLiveShowView[]
  isLive?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [at, setAt] = useState(initialAt ? new Date(initialAt).toISOString().slice(0, 16) : '')
  const [note, setNote] = useState(initialNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [series, setSeries] = useState(initialSeries)
  const [scheduledShows, setScheduledShows] = useState(initialScheduledShows)
  const [selectedSeriesId, setSelectedSeriesId] = useState(initialSeries[0]?.id ?? '')
  const [episodeAt, setEpisodeAt] = useState('')
  const [episodeTitle, setEpisodeTitle] = useState('')
  const [durationHours, setDurationHours] = useState(1)
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [frequencyDays, setFrequencyDays] = useState<number[]>([])
  const [seriesName, setSeriesName] = useState(searchParams.get('seriesName') ?? '')
  const [description, setDescription] = useState('')
  const [tagline, setTagline] = useState('')
  const [showType, setShowType] = useState<'LIVE_SET' | 'TALK'>(
    searchParams.get('format') === 'TALK' ? 'TALK' : 'LIVE_SET',
  )
  const [artworkUrl, setArtworkUrl] = useState(searchParams.get('artwork') ?? '')
  const [episodeArtworkUrl, setEpisodeArtworkUrl] = useState('')
  const [venue, setVenue] = useState('')
  const [location, setLocation] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FAN_ONLY'>('PUBLIC')
  const [autoPublish, setAutoPublish] = useState(true)
  const [episodeNumberEnabled, setEpisodeNumberEnabled] = useState(true)
  const [nextEpisodeNumber, setNextEpisodeNumber] = useState(1)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await updateChannelSchedule({
        nextBroadcastAt: at ? new Date(at).toISOString() : null,
        nextBroadcastNote: note.trim() || null,
      })
      if (res.error) setError(res.error)
    })
  }

  function clear() {
    setAt('')
    setNote('')
    startTransition(async () => {
      const res = await updateChannelSchedule({
        nextBroadcastAt: null,
        nextBroadcastNote: null,
      })
      if (res.error) setError(res.error)
    })
  }

  function createSeries() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await createLiveShowSeries({
        name: seriesName,
        description: description.trim() || null,
        tagline: tagline.trim() || null,
        artworkUrl: artworkUrl.trim() || null,
        showType,
        visibility,
        autoPublish,
        episodeNumberEnabled,
        nextEpisodeNumber,
      })
      if (result.error || !result.data) {
        setError(result.error ?? 'Could not create series')
        return
      }
      setSeries((current) => [result.data!, ...current])
      setSelectedSeriesId(result.data.id)
      setSeriesName('')
      setDescription('')
      setTagline('')
      setMessage('Show series created. Pick a date to schedule its next episode.')
    })
  }

  function toggleFrequencyDay(day: number) {
    setFrequencyDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    )
  }

  function scheduleOneOffEpisode() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await scheduleLiveShowEpisode(
        selectedSeriesId,
        new Date(episodeAt).toISOString(),
        {
          title: episodeTitle.trim() || null,
          venue: venue.trim() || null,
          location: location.trim() || null,
          artworkUrl: episodeArtworkUrl.trim() || null,
        },
      )
      if (result.error || !result.data) {
        setError(result.error ?? 'Could not schedule show')
        return
      }
      setScheduledShows((current) => [...current, result.data!].sort(sortShows))
      setSeries((current) =>
        current.map((item) =>
          item.id === selectedSeriesId && item.episodeNumberEnabled
            ? { ...item, nextEpisodeNumber: item.nextEpisodeNumber + 1 }
            : item,
        ),
      )
      setAt(episodeAt)
      setNote(result.data.title)
      setEpisodeAt('')
      setEpisodeTitle('')
      setEpisodeArtworkUrl('')
      setVenue('')
      setLocation('')
      setMessage(`${result.data.title} scheduled.`)
    })
  }

  function saveRecurringSchedule() {
    setError(null)
    setMessage(null)
    const timeOfDay = episodeAt.slice(11, 16)
    const durationMin = durationHours * 60 + durationMinutes
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    startTransition(async () => {
      const result = await updateLiveShowSeriesRecurrence(selectedSeriesId, {
        recurrenceEnabled: true,
        recurrenceDays: frequencyDays,
        recurrenceTimeOfDay: timeOfDay,
        recurrenceDurationMin: durationMin > 0 ? durationMin : null,
        recurrenceTimezone: timezone,
      })
      if (result.error || !result.data) {
        setError(result.error ?? 'Could not save the recurring schedule')
        return
      }
      setSeries((current) =>
        current.map((item) => (item.id === selectedSeriesId ? result.data! : item)),
      )
      setEpisodeAt('')
      setEpisodeTitle('')
      setFrequencyDays([])
      setMessage('Recurring schedule saved — upcoming shows are being generated.')
      // The server just created ScheduledLiveShow rows synchronously
      // (apps/api's generateRecurringEpisodes) — refresh to pull them into
      // initialScheduledShows rather than re-deriving generation client-side.
      router.refresh()
    })
  }

  function addShow() {
    if (!selectedSeriesId || !episodeAt) {
      setError('Choose a series and date first.')
      return
    }
    if (frequencyDays.length > 0) {
      saveRecurringSchedule()
    } else {
      scheduleOneOffEpisode()
    }
  }

  function stopRecurringSchedule() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await updateLiveShowSeriesRecurrence(selectedSeriesId, {
        recurrenceEnabled: false,
        recurrenceDays: [],
        recurrenceTimeOfDay: null,
        recurrenceDurationMin: null,
        recurrenceTimezone: null,
      })
      if (result.error || !result.data) {
        setError(result.error ?? 'Could not stop the recurring schedule')
        return
      }
      setSeries((current) =>
        current.map((item) => (item.id === selectedSeriesId ? result.data! : item)),
      )
      setMessage('Recurring schedule stopped. Already-generated upcoming shows stay put.')
    })
  }

  function cancelEpisode(showId: string) {
    setError(null)
    startTransition(async () => {
      const result = await cancelScheduledLiveShow(showId)
      if (result.error) {
        setError(result.error)
        return
      }
      setScheduledShows((current) => current.filter((show) => show.id !== showId))
      setMessage('Scheduled show canceled.')
    })
  }

  const selectedSeries = series.find((item) => item.id === selectedSeriesId)
  const previewAtIso = at ? new Date(at).toISOString() : null
  const previewNote = note.trim() || null

  const previewLabel = [
    previewNote,
    previewAtIso
      ? new Date(previewAtIso).toLocaleString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="studio-settings-stack studio-mt-lg">
      <Panel
        title="Live show series"
        description="Save the details once, then schedule each episode in a few clicks."
      >
        <div className="studio-show-series-grid">
          <label className="studio-schedule-row__field studio-flex-1">
            <span className="studio-label-sm">Series name</span>
            <input
              className="studio-input"
              value={seriesName}
              onChange={(event) => setSeriesName(event.target.value)}
              placeholder="e.g. Midnight Signals"
              disabled={isPending}
            />
          </label>
          <label className="studio-schedule-row__field">
            <span className="studio-label-sm">Format</span>
            <select
              className="studio-input"
              value={showType}
              onChange={(event) => setShowType(event.target.value as 'LIVE_SET' | 'TALK')}
              disabled={isPending}
            >
              <option value="LIVE_SET">DJ set series</option>
              <option value="TALK">Podcast</option>
            </select>
          </label>
          <label className="studio-schedule-row__field">
            <span className="studio-label-sm">Visibility</span>
            <select
              className="studio-input"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as 'PUBLIC' | 'FAN_ONLY')}
              disabled={isPending}
            >
              <option value="PUBLIC">Public</option>
              <option value="FAN_ONLY">Fans only</option>
            </select>
          </label>
          <label className="studio-schedule-row__field studio-flex-1">
            <span className="studio-label-sm">Default tagline</span>
            <input
              className="studio-input"
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              placeholder="Optional subtitle"
              disabled={isPending}
            />
          </label>
          <label className="studio-schedule-row__field studio-show-series-grid__wide">
            <span className="studio-label-sm">Sound description</span>
            <textarea
              className="studio-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Copied to every recording; tracklists can be completed later."
              disabled={isPending}
              rows={2}
            />
          </label>
          <label className="studio-schedule-row__field studio-show-series-grid__wide">
            <span className="studio-label-sm">Show artwork URL</span>
            <input
              className="studio-input"
              type="url"
              value={artworkUrl}
              onChange={(event) => setArtworkUrl(event.target.value)}
              placeholder="Keeps this artwork for every episode"
              disabled={isPending}
            />
          </label>
        </div>
        <div className="studio-schedule-row studio-mt-sm">
          <label className="studio-checkbox-label">
            <input
              type="checkbox"
              checked={episodeNumberEnabled}
              onChange={(event) => setEpisodeNumberEnabled(event.target.checked)}
              disabled={isPending}
            />
            Increment episode number automatically
          </label>
          {episodeNumberEnabled && (
            <label className="studio-schedule-row__field">
              <span className="studio-label-sm">Start at</span>
              <input
                type="number"
                min={1}
                className="studio-input studio-input--narrow"
                value={nextEpisodeNumber}
                onChange={(event) => setNextEpisodeNumber(Number(event.target.value))}
                disabled={isPending}
              />
            </label>
          )}
          <label className="studio-checkbox-label">
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={(event) => setAutoPublish(event.target.checked)}
              disabled={isPending}
            />
            Publish recording automatically
          </label>
          <Button
            onClick={createSeries}
            disabled={isPending || !seriesName.trim()}
            variant="primary"
          >
            <ButtonIcon name="plus" />
            Create series
          </Button>
        </div>
      </Panel>

      <Panel
        title="Add a show"
        description="Set a one-off date, or pick days below to make it a weekly show — either way, the title and series details fill in automatically."
      >
        {series.length === 0 ? (
          <p className="studio-text-muted-sm">Create a show series first.</p>
        ) : (
          <div className="studio-add-show">
            <label className="studio-schedule-row__field studio-flex-1">
              <span className="studio-label-sm">Series</span>
              <select
                className="studio-input"
                value={selectedSeriesId}
                onChange={(event) => setSelectedSeriesId(event.target.value)}
                disabled={isPending}
              >
                {series.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.episodeNumberEnabled ? ` — next #${item.nextEpisodeNumber}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="studio-schedule-row__field studio-flex-1">
              <span className="studio-label-sm">Title</span>
              <input
                className="studio-input"
                value={episodeTitle}
                onChange={(event) => setEpisodeTitle(event.target.value)}
                placeholder="Tell your listeners what they're in for (optional)"
                maxLength={200}
                disabled={isPending}
              />
              <span className="studio-add-show__hint">
                Leave blank to use the series name
                {selectedSeries?.episodeNumberEnabled ? ' + episode number' : ''}.
              </span>
            </label>

            <div className="studio-add-show__time-row">
              <label className="studio-schedule-row__field">
                <span className="studio-label-sm">Date &amp; time</span>
                <input
                  type="datetime-local"
                  className="studio-input"
                  value={episodeAt}
                  onChange={(event) => setEpisodeAt(event.target.value)}
                  disabled={isPending}
                />
              </label>
              <span className="studio-add-show__for">for</span>
              <label className="studio-schedule-row__field">
                <span className="studio-label-sm">Hours</span>
                <select
                  className="studio-input studio-input--narrow"
                  value={durationHours}
                  onChange={(event) => setDurationHours(Number(event.target.value))}
                  disabled={isPending}
                >
                  {Array.from({ length: 13 }, (_, h) => h).map((h) => (
                    <option key={h} value={h}>
                      {h} hours
                    </option>
                  ))}
                </select>
              </label>
              <label className="studio-schedule-row__field">
                <span className="studio-label-sm">Minutes</span>
                <select
                  className="studio-input studio-input--narrow"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  disabled={isPending}
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <span className="studio-label-sm">Frequency</span>
              <div className="studio-add-show__frequency">
                {FREQUENCY_DAY_ORDER.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`studio-add-show__day${frequencyDays.includes(day) ? ' studio-add-show__day--active' : ''}`}
                    onClick={() => toggleFrequencyDay(day)}
                    disabled={isPending}
                  >
                    Every {WEEKDAY_LABELS[day]}
                  </button>
                ))}
              </div>
              <span className="studio-add-show__hint">
                {frequencyDays.length > 0
                  ? 'Weekly show — episodes are generated automatically on the selected days, this far ahead: '
                  : 'No day selected — this is a one-off show at the date and time above.'}
                {frequencyDays.length > 0 && (
                  <>
                    {series.find((s) => s.id === selectedSeriesId)?.recurrenceHorizonDays ?? 28}{' '}
                    days.
                  </>
                )}
              </span>
            </div>

            {selectedSeries?.recurrenceEnabled && (
              <div className="studio-add-show__recurrence-status">
                <span>
                  Currently repeating every{' '}
                  {selectedSeries.recurrenceDays
                    .slice()
                    .sort((a, b) => a - b)
                    .map((d) => WEEKDAY_LABELS[d])
                    .join(', ')}
                  {selectedSeries.recurrenceTimeOfDay
                    ? ` at ${selectedSeries.recurrenceTimeOfDay}`
                    : ''}
                  .
                </span>
                <Button
                  onClick={stopRecurringSchedule}
                  disabled={isPending}
                  variant="ghost"
                  size="sm"
                >
                  Stop recurring
                </Button>
              </div>
            )}

            <details className="studio-add-show__more">
              <summary>More details (venue, location, artwork)</summary>
              <div className="studio-schedule-row studio-row--wrap studio-mt-sm">
                <label className="studio-schedule-row__field">
                  <span className="studio-label-sm">Venue</span>
                  <input
                    className="studio-input"
                    value={venue}
                    onChange={(event) => setVenue(event.target.value)}
                    placeholder="Optional venue"
                    disabled={isPending}
                  />
                </label>
                <label className="studio-schedule-row__field">
                  <span className="studio-label-sm">Location</span>
                  <input
                    className="studio-input"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="City, country, or online"
                    disabled={isPending}
                  />
                </label>
                <label className="studio-schedule-row__field studio-flex-1">
                  <span className="studio-label-sm">Different artwork for this episode</span>
                  <input
                    type="url"
                    className="studio-input"
                    value={episodeArtworkUrl}
                    onChange={(event) => setEpisodeArtworkUrl(event.target.value)}
                    placeholder="Leave blank to keep the series artwork"
                    disabled={isPending}
                  />
                </label>
              </div>
            </details>

            <div className="studio-add-show__submit-row">
              <Button onClick={addShow} disabled={isPending || !episodeAt} variant="primary">
                <ButtonIcon name="plus" />
                {frequencyDays.length > 0 ? 'Save weekly show' : 'Schedule show'}
              </Button>
            </div>
          </div>
        )}
        {scheduledShows.length > 0 && (
          <div className="studio-show-series-list studio-mt-md">
            {scheduledShows.map((show) => (
              <div className="studio-show-series-list__item" key={show.id}>
                <div>
                  <strong>{show.title}</strong>
                  <p className="studio-text-muted-sm">
                    {new Date(show.startAt).toLocaleString()} ·{' '}
                    {show.showType === 'TALK' ? 'Podcast' : 'DJ set'}
                    {show.venue ? ` · ${show.venue}` : ''}
                    {show.location ? `, ${show.location}` : ''}
                  </p>
                </div>
                <Button
                  onClick={() => cancelEpisode(show.id)}
                  disabled={isPending}
                  variant="ghost"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Next broadcast"
        headerTight
        description="One-off announcement shown to listeners when you're offline. Series episodes update this automatically."
      >
        <div className="studio-schedule-row">
          <label className="studio-schedule-row__field">
            <span className="studio-label-sm">Date &amp; time</span>
            <input
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              disabled={isPending}
              className="studio-input"
            />
          </label>
          <label className="studio-schedule-row__field studio-flex-1">
            <span className="studio-label-sm">Note</span>
            <input
              type="text"
              value={note}
              placeholder="e.g. Weekly — Thursdays 22:00 EET"
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
              className="studio-input"
            />
          </label>
          <Button onClick={save} disabled={isPending} variant="primary">
            <ButtonIcon name="save" />
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button onClick={clear} disabled={isPending} variant="ghost" size="sm">
            Clear
          </Button>
        </div>
        {error && <p className="studio-text-error studio-mt-xs">{error}</p>}
        {message && <p className="studio-notice studio-notice--success studio-mt-sm">{message}</p>}
        {!isLive && previewLabel && (
          <p className="studio-text-muted-sm studio-mt-sm" aria-live="polite">
            Listener preview: {previewLabel}
          </p>
        )}
      </Panel>
    </div>
  )
}

function sortShows(left: ScheduledLiveShowView, right: ScheduledLiveShowView) {
  return new Date(left.startAt).getTime() - new Date(right.startAt).getTime()
}
