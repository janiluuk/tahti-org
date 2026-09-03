// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Badge, Button, Field, FileDropzone, Input, Panel, Select } from '@tahti/ui'
import type {
  AddonAdminItem,
  AddonInstallView,
  AddonScopeInput,
  AddonStoreItem,
} from '@tahti/shared'
import { ADDON_SCOPES, ADDON_SUGGESTED_CATEGORIES } from '@tahti/shared'
import { AddonManagerPanel } from '@/components/addons/addon-manager-panel'
import {
  approveAddon,
  disableAddon,
  installHomepageAddon,
  patchHomepageAddonInstall,
  prepareAddonUpload,
  publishAddonVersion,
  registerAddon,
  rejectAddon,
  removeHomepageAddonInstall,
  saveAddonDefaultConfig,
} from './actions'

function toStoreItem(w: AddonAdminItem): AddonStoreItem {
  return {
    id: w.id,
    slug: w.slug,
    name: w.name,
    description: w.description,
    authorName: w.authorName,
    categories: w.categories,
    iconUrl: w.iconUrl,
    currentVersion: w.currentVersion,
  }
}

function RegisterWidgetForm({ onRegistered }: { onRegistered: (w: AddonAdminItem) => void }) {
  const [slug, setSlug] = useState('')
  const [scope, setScope] = useState<AddonScopeInput>('ARTIST')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [categories, setCategories] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setPending(true)
    const result = await registerAddon({
      slug,
      scope,
      name,
      description,
      authorName,
      categories: categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    })
    setPending(false)
    if (result.error || !result.widget) {
      setError(result.error ?? 'Failed to register')
      return
    }
    onRegistered(result.widget)
    setSlug('')
    setName('')
    setDescription('')
    setAuthorName('')
    setCategories('')
  }

  return (
    <Panel title="Register a new widget">
      <Field label="Slug" hint="lowercase-with-hyphens, used in storage keys">
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="live-status" />
      </Field>
      <Field label="Scope">
        <Select value={scope} onChange={(e) => setScope(e.target.value as AddonScopeInput)}>
          {ADDON_SCOPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Live status" />
      </Field>
      <Field label="Description">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Shows whether the channel is live right now."
        />
      </Field>
      <Field label="Author name">
        <Input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Tahti"
        />
      </Field>
      <Field
        label="Categories"
        hint={`Comma-separated, e.g. ${ADDON_SUGGESTED_CATEGORIES.slice(0, 3).join(', ')}`}
      >
        <Input value={categories} onChange={(e) => setCategories(e.target.value)} />
      </Field>
      <Button
        variant="primary"
        disabled={pending || !slug || !name || !description || !authorName || !categories}
        onClick={() => void handleSubmit()}
      >
        {pending ? 'Registering…' : 'Register'}
      </Button>
      {error && <p className="admin-form-error">{error}</p>}
    </Panel>
  )
}

function PublishVersionForm({
  widget,
  onPublished,
}: {
  widget: AddonAdminItem
  onPublished: (w: AddonAdminItem) => void
}) {
  const [version, setVersion] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File) {
    setError(null)
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      setError('Enter a semver version first, e.g. 1.0.1')
      return
    }
    setUploading(true)
    try {
      const prep = await prepareAddonUpload(widget.id, version, file.size)
      if (prep.error || !prep.uploadUrl) {
        setError(prep.error ?? 'Could not start upload')
        return
      }
      const put = await fetch(prep.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/javascript' },
        body: file,
      })
      if (!put.ok) {
        setError('Upload failed')
        return
      }
      const published = await publishAddonVersion(widget.id, version)
      if (published.error || !published.widget) {
        setError(published.error ?? 'Could not publish version')
        return
      }
      onPublished(published.widget)
      setVersion('')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="admin-row" style={{ gap: '0.5rem', alignItems: 'center' }}>
      <Input
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        placeholder="1.0.1"
        style={{ maxWidth: '7rem' }}
        disabled={uploading}
      />
      <FileDropzone
        label="Choose widget script"
        hint="JavaScript (.js)"
        accept=".js"
        disabled={uploading}
        onFiles={([file]) => {
          if (file) void onFile(file)
        }}
      />
      {error && <span className="admin-form-error">{error}</span>}
    </div>
  )
}

function CatalogRow({
  widget,
  onChange,
}: {
  widget: AddonAdminItem
  onChange: (w: AddonAdminItem) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  async function handleApprove() {
    setPending(true)
    setError(null)
    const result = await approveAddon(widget.id)
    setPending(false)
    if (result.error || !result.widget) {
      setError(result.error ?? 'Failed to approve')
      return
    }
    onChange(result.widget)
  }

  async function handleReject() {
    if (!rejectNote.trim()) {
      setError('A reason is required to reject')
      return
    }
    setPending(true)
    setError(null)
    const result = await rejectAddon(widget.id, rejectNote.trim())
    setPending(false)
    if (result.error || !result.widget) {
      setError(result.error ?? 'Failed to reject')
      return
    }
    onChange(result.widget)
  }

  async function handleDisable() {
    setPending(true)
    setError(null)
    const result = await disableAddon(widget.id)
    setPending(false)
    if (result.error || !result.widget) {
      setError(result.error ?? 'Failed to disable')
      return
    }
    onChange(result.widget)
  }

  return (
    <div className="ui-panel studio-mt-sm">
      <div className="admin-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{widget.name}</strong> <span className="admin-text-muted">({widget.slug})</span>{' '}
          <Badge variant="neutral">{widget.scope}</Badge>{' '}
          <Badge variant={widget.status === 'APPROVED' ? 'success' : 'neutral'}>
            {widget.status}
          </Badge>{' '}
          <Badge variant="neutral">v{widget.currentVersion}</Badge>
          <p className="admin-text-muted">{widget.description}</p>
          {widget.moderationNote && (
            <p className="admin-text-muted">Note: {widget.moderationNote}</p>
          )}
        </div>
      </div>

      <PublishVersionForm widget={widget} onPublished={onChange} />

      {widget.status === 'PENDING' && (
        <div className="admin-row studio-mt-sm" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <Button
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() => void handleApprove()}
          >
            Approve
          </Button>
          <Input
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Reason for rejecting"
            style={{ maxWidth: '16rem' }}
          />
          <Button variant="danger" size="sm" disabled={pending} onClick={() => void handleReject()}>
            Reject
          </Button>
        </div>
      )}
      {widget.status === 'APPROVED' && (
        <div className="studio-mt-sm">
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => void handleDisable()}
          >
            Disable
          </Button>
        </div>
      )}
      {error && <p className="admin-form-error">{error}</p>}
    </div>
  )
}

export function AdminAddonsPanel({
  initialCatalog,
  initialHomepageStore,
  initialHomepageInstalls,
}: {
  initialCatalog: AddonAdminItem[]
  initialHomepageStore: AddonAdminItem[]
  initialHomepageInstalls: AddonInstallView[]
}) {
  const [catalog, setCatalog] = useState(initialCatalog)

  function upsert(widget: AddonAdminItem) {
    setCatalog((prev) => {
      const exists = prev.some((w) => w.id === widget.id)
      return exists ? prev.map((w) => (w.id === widget.id ? widget : w)) : [widget, ...prev]
    })
  }

  const homepageStoreItems = (
    catalog.length > 0
      ? catalog.filter((w) => w.scope === 'ADMIN' && w.status === 'APPROVED')
      : initialHomepageStore
  ).map(toStoreItem)

  return (
    <div>
      <RegisterWidgetForm onRegistered={upsert} />

      <h2 className="studio-mt-lg">Catalog</h2>
      {catalog.length === 0 ? (
        <p className="admin-text-muted">No widgets registered yet.</p>
      ) : (
        catalog.map((w) => <CatalogRow key={w.id} widget={w} onChange={upsert} />)
      )}

      <Panel title="Homepage widgets" className="studio-mt-lg">
        <AddonManagerPanel
          initialWidgets={homepageStoreItems}
          initialInstalls={initialHomepageInstalls}
          actions={{
            install: installHomepageAddon,
            patch: patchHomepageAddonInstall,
            remove: removeHomepageAddonInstall,
            saveAsDefault: async (widgetId, configJson) => {
              const result = await saveAddonDefaultConfig(widgetId, configJson)
              return { error: result.error }
            },
          }}
        />
      </Panel>
    </div>
  )
}
