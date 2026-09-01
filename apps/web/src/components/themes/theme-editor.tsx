// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/* design-token-allow -- user-editable theme palette values, not app styling. */
/* eslint-disable no-restricted-syntax -- this file's whole purpose is a
 * user-editable palette of hex color VALUES (theme data, not this app's own
 * UI chrome) — the repo-wide "no raw hex" rule exists to keep app styling on
 * design tokens, which doesn't apply to a color picker's own seed data. */

'use client'

import { useState } from 'react'
import { Button, Input } from '@tahti/ui'
import { ThemePreviewCard } from './theme-preview-card'

// Same starter keys as the standalone tool this was ported from
// (~/Downloads/nuclear-theme-editor.html) — a full design-token set, not the
// simpler 5-key colorSchemeJson used by the (unrelated) channel visual-preset
// system elsewhere in this app.
export const DEFAULT_THEME_VARS: Record<string, string> = {
  background: '#ffffff',
  foreground: '#111318',
  card: '#f4f5f7',
  cardForeground: '#111318',
  primary: '#7c9eff',
  primaryForeground: '#ffffff',
  secondary: '#eceef2',
  secondaryForeground: '#111318',
  accent: '#7c9eff',
  accentForeground: '#ffffff',
  muted: '#eceef2',
  mutedForeground: '#6b6f7a',
  border: '#e2e4e9',
  destructive: '#e0524a',
  radius: '10px',
}

export const DEFAULT_THEME_DARK: Record<string, string> = {
  background: '#111318',
  foreground: '#e8e9ec',
  card: '#1a1c22',
  cardForeground: '#e8e9ec',
  secondary: '#23262e',
  secondaryForeground: '#e8e9ec',
  muted: '#23262e',
  mutedForeground: '#8b8f9a',
  border: '#2a2d35',
}

function isColor(v: string): boolean {
  return /^#([0-9a-f]{3,8})$/i.test(v.trim())
}

interface VarRowProps {
  varKey: string
  value: string
  onChange: (value: string) => void
  onRemove: () => void
  disabled?: boolean
}

function VarRow({ varKey, value, onChange, onRemove, disabled }: VarRowProps) {
  return (
    <div className="studio-row" style={{ gap: '0.4rem', alignItems: 'center' }}>
      {isColor(value) ? (
        <input
          type="color"
          value={value.length === 7 ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ width: 30, height: 30, padding: 0, flexShrink: 0 }}
        />
      ) : (
        <span style={{ width: 30, flexShrink: 0 }} />
      )}
      <span
        className="studio-text-muted-sm"
        style={{ width: '9rem', flexShrink: 0 }}
        title={varKey}
      >
        {varKey}
      </span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${varKey}`}
        >
          ✕
        </Button>
      )}
    </div>
  )
}

export interface ThemeEditorValue {
  name: string
  vars: Record<string, string>
  dark: Record<string, string>
}

export interface ThemeEditorProps {
  initial?: ThemeEditorValue
  /** Read-only preview mode for the admin review queue — no editing controls. */
  readOnly?: boolean
  onSave?: (value: ThemeEditorValue) => void
  saving?: boolean
}

export function ThemeEditor({ initial, readOnly, onSave, saving }: ThemeEditorProps) {
  const [name, setName] = useState(initial?.name ?? 'My Theme')
  const [vars, setVars] = useState<Record<string, string>>(
    initial?.vars ?? { ...DEFAULT_THEME_VARS },
  )
  const [dark, setDark] = useState<Record<string, string>>(
    initial?.dark ?? { ...DEFAULT_THEME_DARK },
  )
  const [tab, setTab] = useState<'light' | 'dark'>('light')
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light')
  const [newKey, setNewKey] = useState('')

  const activeScope = tab === 'light' ? vars : dark
  const setActiveScope = tab === 'light' ? setVars : setDark

  function updateVar(key: string, value: string) {
    setActiveScope((prev) => ({ ...prev, [key]: value }))
  }
  function removeVar(key: string) {
    setActiveScope((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }
  function addVar() {
    const key = newKey.trim()
    if (!key) return
    setActiveScope((prev) => ({ ...prev, [key]: tab === 'light' ? '#888888' : '' }))
    setNewKey('')
  }

  const previewVars = previewMode === 'dark' ? { ...vars, ...dark } : vars

  return (
    <div
      className="studio-row"
      style={{ alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}
    >
      <div style={{ minWidth: '18rem', flex: 1 }}>
        {!readOnly && (
          <>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Theme name"
              aria-label="Theme name"
            />
            <div className="studio-row studio-mt-sm" style={{ gap: '0.5rem' }}>
              <Button
                type="button"
                variant={tab === 'light' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setTab('light')}
              >
                Light vars
              </Button>
              <Button
                type="button"
                variant={tab === 'dark' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setTab('dark')}
              >
                Dark overrides
              </Button>
            </div>
          </>
        )}

        <div
          className="studio-mt-sm"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
        >
          {Object.entries(activeScope).map(([key, value]) => (
            <VarRow
              key={key}
              varKey={key}
              value={value}
              onChange={(v) => updateVar(key, v)}
              onRemove={() => removeVar(key)}
              disabled={readOnly}
            />
          ))}
        </div>

        {!readOnly && (
          <div className="studio-row studio-mt-sm" style={{ gap: '0.5rem' }}>
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="new-var-name"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addVar}>
              Add
            </Button>
          </div>
        )}

        {!readOnly && onSave && (
          <Button
            type="button"
            variant="primary"
            className="studio-mt-lg"
            disabled={saving}
            onClick={() => onSave({ name, vars, dark })}
          >
            {saving ? 'Saving…' : 'Save theme'}
          </Button>
        )}
      </div>

      <div style={{ minWidth: '18rem', flex: 1 }}>
        <div className="studio-row" style={{ justifyContent: 'space-between' }}>
          <span className="studio-text-muted-sm">Live preview</span>
          <div className="studio-row" style={{ gap: '0.4rem' }}>
            <Button
              type="button"
              variant={previewMode === 'light' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setPreviewMode('light')}
            >
              Light
            </Button>
            <Button
              type="button"
              variant={previewMode === 'dark' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setPreviewMode('dark')}
            >
              Dark
            </Button>
          </div>
        </div>
        <ThemePreviewCard vars={previewVars} />
      </div>
    </div>
  )
}
