import Link from 'next/link'
import { Heading, PageShell, Panel, SidebarNavIconSvg } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import { fetchRecentBroadcasts } from '../upload/upload-actions'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export default async function RecordingsPage() {
  const [shows, user] = await Promise.all([fetchRecentBroadcasts(500, false), getDashboardUser()])

  return (
    <PageShell size="lg">
      <div className="studio-page-header">
        <Heading level={1}>Recordings</Heading>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel={Boolean(user?.channel)}
            isLive={user?.channel?.state === 'LIVE'}
            channelSlug={user?.channel?.slug}
            showBack
          />
        </div>
      </div>

      <Panel
        title={`Recorded shows (${shows.length})`}
        description="Every completed show recording, newest first."
      >
        {shows.length === 0 ? (
          <div className="studio-empty-card studio-mt-sm studio-mb-0">
            <p className="studio-empty-card__text">No recorded shows yet.</p>
            <p className="studio-empty-card__hint">
              Enable recording when you go live and completed shows will appear here.
            </p>
            <Link href="/dashboard/broadcast" className="ui-btn ui-btn--primary ui-btn--sm">
              <SidebarNavIconSvg name="distribution" />
              Open broadcast studio
            </Link>
          </div>
        ) : (
          <ol className="import-page__broadcast-list studio-mt-sm">
            {shows.map((show) => {
              const title =
                show.title || show.archiveItemTitle || `Show ${formatDate(show.startedAt)}`
              const href = show.archiveItemId
                ? `/dashboard/archive/${show.archiveItemId}`
                : `/dashboard/upload/from-broadcast?id=${show.id}`
              return (
                <li key={show.id} className="import-page__broadcast-row">
                  <div className="import-page__broadcast-info">
                    <span className="import-page__broadcast-name">{title}</span>
                    <span className="import-page__broadcast-meta">
                      {formatDate(show.startedAt)}
                      {show.durationSec ? ` · ${formatDuration(show.durationSec)}` : ''}
                      {show.source ? ` · ${show.source.toLowerCase().replace('_', ' ')}` : ''}
                    </span>
                  </div>
                  <span className="import-page__broadcast-status import-page__broadcast-status--ready">
                    {show.archiveItemStatus === 'READY' ? 'Published' : 'Recorded'}
                  </span>
                  <Link href={href} className="ui-btn ui-btn--ghost ui-btn--sm">
                    {show.archiveItemId ? 'Open' : 'Edit & publish'}
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>
    </PageShell>
  )
}
