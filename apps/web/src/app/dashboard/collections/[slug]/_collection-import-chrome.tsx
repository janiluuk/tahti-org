// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ButtonIcon, Button } from '@tahti/ui'
import { LibraryBrowser } from '@/components/library/library-browser'
import { addCollectionItem } from '../../collection-actions'
import { listMyIntegrations } from '../../integrations-actions'
import { SpotifyImportModal } from './_spotify-import-modal'
import { MixcloudImportModal } from './_mixcloud-import-modal'
import { HearthisImportModal } from './_hearthis-import-modal'

type LibraryItem = {
  id: string
  title: string
  kind: 'sound' | 'release'
  status?: string
  state?: string
}

export type ImportAddedPayload = {
  soundId: string
  collectionItemId: string
  track: {
    title: string
    durationSec: number
    coverUrl: string | null
  }
  source: 'SPOTIFY_EMBED' | 'MIXCLOUD_EMBED' | 'HEARTHIS_EMBED'
}

type ImportChromeContextValue = {
  header: ReactNode
  panels: ReactNode
}

const ImportChromeContext = createContext<ImportChromeContextValue | null>(null)

function useImportChromeContext() {
  const ctx = useContext(ImportChromeContext)
  if (!ctx) {
    throw new Error(
      'CollectionImportChrome subcomponents must be used within CollectionImportChrome',
    )
  }
  return ctx
}

export function CollectionImportChromeHeader() {
  return useImportChromeContext().header
}

export function CollectionImportChromePanels() {
  return useImportChromeContext().panels
}

export function CollectionImportChrome({
  collectionId,
  collectionSlug,
  collectionTitle,
  availableLibraryItems,
  onImportAdded,
  children,
}: {
  collectionId: string
  collectionSlug: string
  collectionTitle: string
  availableLibraryItems: LibraryItem[]
  onImportAdded: (payload: ImportAddedPayload) => void
  children: ReactNode
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [spotifyModalOpen, setSpotifyModalOpen] = useState(false)
  const [mixcloudModalOpen, setMixcloudModalOpen] = useState(false)
  const [hearthisModalOpen, setHearthisModalOpen] = useState(false)
  const [installedProviders, setInstalledProviders] = useState<Record<string, boolean> | null>(null)
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const [libraryPick, setLibraryPick] = useState('')
  const [libraryAdding, setLibraryAdding] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listMyIntegrations().then((result) => {
      if (cancelled) return
      const map: Record<string, boolean> = {}
      for (const i of result.integrations) map[i.slug] = i.installed || i.connected
      setInstalledProviders(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const isProviderReady = useCallback(
    (slug: string) => installedProviders === null || (installedProviders[slug] ?? true),
    [installedProviders],
  )

  const addFromLibrary = useCallback(
    async (selectedPick = libraryPick) => {
      if (!selectedPick) return
      setLibraryAdding(true)
      setLibraryError(null)
      const [kind, id] = selectedPick.split(':')
      const { error } = await addCollectionItem(
        collectionSlug,
        kind === 'sound' ? { soundId: id } : { releaseId: id },
      )
      setLibraryAdding(false)
      if (error) {
        setLibraryError(error)
        return
      }
      setLibraryPick('')
      setLibraryPickerOpen(false)
      startTransition(() => router.refresh())
    },
    [collectionSlug, libraryPick, router],
  )

  const handleImportAdded = useCallback(
    (result: Omit<ImportAddedPayload, 'source'>, source: ImportAddedPayload['source']) => {
      onImportAdded({ ...result, source })
    },
    [onImportAdded],
  )

  const header = (
    <>
      <div className="collection-editor__add-buttons">
        <Button onClick={() => setLibraryPickerOpen((v) => !v)} variant="ghost" size="sm">
          + Tahti library
        </Button>
        <Button
          onClick={() => setSpotifyModalOpen(true)}
          variant="ghost"
          size="sm"
          className="collection-editor__add-btn--spotify"
          disabled={!isProviderReady('spotify')}
          title={
            isProviderReady('spotify')
              ? undefined
              : 'Install the Spotify integration in Settings → Integrations first'
          }
        >
          + Spotify
        </Button>
        <Button
          onClick={() => setMixcloudModalOpen(true)}
          variant="ghost"
          size="sm"
          className="collection-editor__add-btn--mixcloud"
          disabled={!isProviderReady('mixcloud-import')}
          title={
            isProviderReady('mixcloud-import')
              ? undefined
              : 'Install the Mixcloud integration in Settings → Integrations first'
          }
        >
          + Mixcloud
        </Button>
        <Button
          onClick={() => setHearthisModalOpen(true)}
          variant="ghost"
          size="sm"
          className="collection-editor__add-btn--hearthis"
          disabled={!isProviderReady('hearthis-import')}
          title={
            isProviderReady('hearthis-import')
              ? undefined
              : 'Install the hearthis.at integration in Settings → Integrations first'
          }
        >
          + hearthis.at
        </Button>
      </div>
      {(!isProviderReady('spotify') ||
        !isProviderReady('mixcloud-import') ||
        !isProviderReady('hearthis-import')) && (
        <p className="studio-text-muted-sm studio-mt-xs">
          Some import sources need installing first —{' '}
          <Link href="/dashboard/settings/integrations">Settings → Integrations</Link>.
        </p>
      )}
    </>
  )

  const panels = (
    <>
      {libraryPickerOpen ? (
        <div className="collection-editor__library-picker studio-mt-sm">
          <LibraryBrowser
            items={availableLibraryItems}
            getTitle={(item) => item.title}
            showStatusFilters={false}
            searchPlaceholder="Search your library…"
            emptyMessage="No unused library items available."
            noMatchMessage="No unused library items match."
          >
            {(visible) => (
              <ul className="studio-list studio-mt-sm">
                {visible.map((item) => {
                  const value = `${item.kind}:${item.id}`
                  const selected = libraryPick === value
                  return (
                    <li key={value} className="studio-programme-row">
                      <button
                        type="button"
                        className="studio-programme-label"
                        aria-pressed={selected}
                        onClick={() => setLibraryPick(selected ? '' : value)}
                      >
                        <span>{item.title}</span>
                        <span className="studio-text-muted-sm">
                          {item.kind === 'sound' ? 'Sound item' : `Release · ${item.state}`}
                        </span>
                      </button>
                      <Button
                        onClick={() => {
                          setLibraryPick(value)
                          void addFromLibrary(value)
                        }}
                        disabled={libraryAdding}
                        variant={selected ? 'primary' : 'secondary'}
                        size="sm"
                      >
                        <ButtonIcon name="plus" />
                        {libraryAdding && selected ? 'Adding…' : 'Add'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </LibraryBrowser>
          {libraryError && <p className="studio-text-error studio-text-sm">{libraryError}</p>}
        </div>
      ) : null}

      {spotifyModalOpen ? (
        <SpotifyImportModal
          collectionId={collectionId}
          collectionTitle={collectionTitle}
          onClose={() => setSpotifyModalOpen(false)}
          onAdded={(result) => handleImportAdded(result, 'SPOTIFY_EMBED')}
        />
      ) : null}

      {mixcloudModalOpen ? (
        <MixcloudImportModal
          collectionId={collectionId}
          collectionTitle={collectionTitle}
          onClose={() => setMixcloudModalOpen(false)}
          onAdded={(result) => handleImportAdded(result, 'MIXCLOUD_EMBED')}
        />
      ) : null}

      {hearthisModalOpen ? (
        <HearthisImportModal
          collectionId={collectionId}
          collectionTitle={collectionTitle}
          onClose={() => setHearthisModalOpen(false)}
          onAdded={(result) => handleImportAdded(result, 'HEARTHIS_EMBED')}
        />
      ) : null}
    </>
  )

  return (
    <ImportChromeContext.Provider value={{ header, panels }}>
      {children}
    </ImportChromeContext.Provider>
  )
}
