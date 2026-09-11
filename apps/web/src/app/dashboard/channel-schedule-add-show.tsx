// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { ButtonIcon, Button } from '@tahti/ui'
import { WEEKDAY_LABELS, type LiveShowSeriesView, type ScheduledLiveShowView } from '@tahti/shared'
import { Panel } from '@/components/ui'
import { FREQUENCY_DAY_ORDER } from './channel-schedule-utils'

export function ChannelScheduleAddShow({
  series,
  selectedSeriesId,
  onSelectedSeriesIdChange,
  episodeTitle,
  onEpisodeTitleChange,
  episodeAt,
  onEpisodeAtChange,
  durationHours,
  onDurationHoursChange,
  durationMinutes,
  onDurationMinutesChange,
  frequencyDays,
  onToggleFrequencyDay,
  venue,
  onVenueChange,
  location,
  onLocationChange,
  episodeArtworkUrl,
  onEpisodeArtworkUrlChange,
  selectedSeries,
  isPending,
  onAddShow,
  onStopRecurringSchedule,
  onCancelEpisode,
  scheduledShows,
}: {
  series: LiveShowSeriesView[]
  selectedSeriesId: string
  onSelectedSeriesIdChange: (seriesId: string) => void
  episodeTitle: string
  onEpisodeTitleChange: (title: string) => void
  episodeAt: string
  onEpisodeAtChange: (at: string) => void
  durationHours: number
  onDurationHoursChange: (hours: number) => void
  durationMinutes: number
  onDurationMinutesChange: (minutes: number) => void
  frequencyDays: number[]
  onToggleFrequencyDay: (day: number) => void
  venue: string
  onVenueChange: (venue: string) => void
  location: string
  onLocationChange: (location: string) => void
  episodeArtworkUrl: string
  onEpisodeArtworkUrlChange: (url: string) => void
  selectedSeries: LiveShowSeriesView | undefined
  isPending: boolean
  onAddShow: () => void
  onStopRecurringSchedule: () => void
  onCancelEpisode: (showId: string) => void
  scheduledShows: ScheduledLiveShowView[]
}) {
  return (
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
              onChange={(event) => onSelectedSeriesIdChange(event.target.value)}
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
              onChange={(event) => onEpisodeTitleChange(event.target.value)}
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
                onChange={(event) => onEpisodeAtChange(event.target.value)}
                disabled={isPending}
              />
            </label>
            <span className="studio-add-show__for">for</span>
            <label className="studio-schedule-row__field">
              <span className="studio-label-sm">Hours</span>
              <select
                className="studio-input studio-input--narrow"
                value={durationHours}
                onChange={(event) => onDurationHoursChange(Number(event.target.value))}
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
                onChange={(event) => onDurationMinutesChange(Number(event.target.value))}
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
                  onClick={() => onToggleFrequencyDay(day)}
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
                  {series.find((s) => s.id === selectedSeriesId)?.recurrenceHorizonDays ?? 28} days.
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
                onClick={onStopRecurringSchedule}
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
                  onChange={(event) => onVenueChange(event.target.value)}
                  placeholder="Optional venue"
                  disabled={isPending}
                />
              </label>
              <label className="studio-schedule-row__field">
                <span className="studio-label-sm">Location</span>
                <input
                  className="studio-input"
                  value={location}
                  onChange={(event) => onLocationChange(event.target.value)}
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
                  onChange={(event) => onEpisodeArtworkUrlChange(event.target.value)}
                  placeholder="Leave blank to keep the series artwork"
                  disabled={isPending}
                />
              </label>
            </div>
          </details>

          <div className="studio-add-show__submit-row">
            <Button onClick={onAddShow} disabled={isPending || !episodeAt} variant="primary">
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
                  {new Date(show.startAt).toLocaleString()}
                  {show.endAt
                    ? ` – ${new Date(show.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : ''}{' '}
                  · {show.showType === 'TALK' ? 'Podcast' : 'DJ set'}
                  {show.venue ? ` · ${show.venue}` : ''}
                  {show.location ? `, ${show.location}` : ''}
                </p>
              </div>
              <Button
                onClick={() => onCancelEpisode(show.id)}
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
  )
}
