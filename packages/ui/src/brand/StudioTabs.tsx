'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'

type TabsContextValue = {
  active: string
  setActive: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('StudioTabs subcomponents must be used within StudioTabs')
  return ctx
}

export type StudioTabsProps = {
  defaultTab: string
  /** Sync active tab with `window.location.hash` (without #). */
  syncHash?: boolean
  /** Map legacy or alias hash values to tab ids. */
  hashAliases?: Record<string, string>
  children: ReactNode
  className?: string
}

export function StudioTabs({
  defaultTab,
  syncHash,
  hashAliases,
  children,
  className,
}: StudioTabsProps) {
  const [active, setActiveState] = useState(defaultTab)

  const resolveHash = useCallback(
    (raw: string) => {
      const key = raw.replace(/^#/, '')
      if (!key) return defaultTab
      return hashAliases?.[key] ?? key
    },
    [defaultTab, hashAliases],
  )

  const setActive = useCallback(
    (value: string) => {
      setActiveState(value)
      if (syncHash && typeof window !== 'undefined') {
        const next = `#${value}`
        if (window.location.hash !== next) {
          window.history.replaceState(null, '', next)
        }
      }
    },
    [syncHash],
  )

  useEffect(() => {
    if (!syncHash) return
    const sync = () => setActiveState(resolveHash(window.location.hash))
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [syncHash, resolveHash])

  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={cn('studio-tabs', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export type StudioTabsListProps = {
  children: ReactNode
  className?: string
  'aria-label'?: string
}

function StudioTabsList({
  children,
  className,
  'aria-label': ariaLabel = 'Dashboard sections',
}: StudioTabsListProps) {
  return (
    <div className={cn('studio-tabs__list', className)} role="tablist" aria-label={ariaLabel}>
      {children}
    </div>
  )
}

export type StudioTabsTriggerProps = {
  value: string
  children: ReactNode
  className?: string
}

function StudioTabsTrigger({ value, children, className }: StudioTabsTriggerProps) {
  const { active, setActive } = useTabs()
  const isActive = active === value
  return (
    <button
      type="button"
      role="tab"
      id={`studio-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`studio-tabpanel-${value}`}
      tabIndex={isActive ? 0 : -1}
      className={cn('studio-tabs__trigger', isActive && 'studio-tabs__trigger--active', className)}
      onClick={() => setActive(value)}
    >
      {children}
    </button>
  )
}

export type StudioTabsPanelProps = {
  value: string
  children: ReactNode
  className?: string
}

function StudioTabsPanel({ value, children, className }: StudioTabsPanelProps) {
  const { active } = useTabs()
  if (active !== value) return null
  return (
    <div
      className={cn('studio-tabs__panel', className)}
      role="tabpanel"
      id={`studio-tabpanel-${value}`}
      aria-labelledby={`studio-tab-${value}`}
    >
      {children}
    </div>
  )
}

StudioTabs.List = StudioTabsList
StudioTabs.Trigger = StudioTabsTrigger
StudioTabs.Panel = StudioTabsPanel
