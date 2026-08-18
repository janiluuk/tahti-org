'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { SidebarNavIconSvg } from './SidebarNav'
import { NotificationBell, type NotificationBellItem } from './NotificationBell'

type StudioTopNavProps = {
  displayName?: string
  isLive?: boolean
  isBoard?: boolean
  hasChannel?: boolean
  channelUrl?: string
  fetchNotifications?: () => Promise<{
    notifications: NotificationBellItem[]
    unreadCount: number
  }>
  markNotificationsRead?: () => Promise<void>
  /** When set and the channel is live, clicking the go-live icon opens the
   * stream manager instead of navigating to /dashboard/broadcast. */
  onGoLiveClick?: () => void
  /** Server action for the "Log out" form. The old hardcoded
   * action="/api/auth/logout" posted to a path that only exists on the API
   * host, not this app — every logout attempt 404'd. */
  logoutAction?: (formData: FormData) => void | Promise<void>
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 11 14 8l-3.5-3M14 8H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconGoLive() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <path
        d="M4.2 4.2a5.4 5.4 0 0 0 0 7.6M11.8 4.2a5.4 5.4 0 0 1 0 7.6M2.3 2.3a8.2 8.2 0 0 0 0 11.4M13.7 2.3a8.2 8.2 0 0 1 0 11.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 10.5V2.5M8 2.5 4.8 5.7M8 2.5l3.2 3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 10.5v1.8A1.7 1.7 0 0 0 4.2 14h7.6a1.7 1.7 0 0 0 1.7-1.7v-1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMessages() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v5A1.5 1.5 0 0 1 12.5 11H6.8L3.6 13.4A.5.5 0 0 1 3 13v-2H3.5A1.5 1.5 0 0 1 2 9.5v-5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSwitch() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 5.5h9.5M8.75 2.75 11.5 5.5 8.75 8.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 10.5H4.5M7.25 7.75 4.5 10.5l2.75 2.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** PLAT-020: dashboard top bar — TAHTI logo + user menu (settings, log out, admin switch). */
export function StudioTopNav({
  displayName,
  isLive,
  isBoard,
  hasChannel,
  channelUrl,
  fetchNotifications,
  markNotificationsRead,
  onGoLiveClick,
  logoutAction,
}: StudioTopNavProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : null

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header className="studio-top-nav">
      {/* Artists always have a channel, so a bare "/" would immediately
       * redirect back to /dashboard (see (marketing)/page.tsx) — this never
       * actually left the studio. ?home=1 tells that redirect to stand down,
       * same escape hatch ChannelHeader's resolveHomeHref() already uses. */}
      <Link href="/?home=1" className="studio-top-nav__logo">
        TAHTI
      </Link>
      <div className="studio-top-nav__actions">
        <div className="studio-top-nav__scroll-links">
          {isBoard && (
            <Link href="/admin" className="studio-top-nav__link studio-top-nav__link--admin">
              <IconSwitch />
              Switch to admin
            </Link>
          )}
        </div>
        {displayName &&
          hasChannel &&
          (isLive && onGoLiveClick ? (
            <button
              type="button"
              className="studio-top-nav__icon-btn studio-top-nav__golive-btn studio-top-nav__golive-btn--live"
              aria-label="Stream manager"
              title="Stream manager"
              onClick={onGoLiveClick}
            >
              <IconGoLive />
            </button>
          ) : (
            <Link
              href="/dashboard/broadcast"
              className="studio-top-nav__icon-btn studio-top-nav__golive-btn"
              aria-label="Go live"
              title="Go live"
            >
              <IconGoLive />
            </Link>
          ))}
        {displayName && hasChannel && (
          <Link
            href="/dashboard/upload"
            className="studio-top-nav__icon-btn"
            aria-label="Upload"
            title="Upload"
          >
            <IconUpload />
          </Link>
        )}
        {displayName && (
          <Link
            href="/dashboard/messages"
            className="studio-top-nav__icon-btn"
            aria-label="Messages"
            title="Messages"
          >
            <IconMessages />
          </Link>
        )}
        {displayName && fetchNotifications && markNotificationsRead && (
          <NotificationBell
            fetchNotifications={fetchNotifications}
            markAllRead={markNotificationsRead}
          />
        )}
        {displayName && (
          <div className="studio-top-nav__user-menu" ref={menuRef}>
            <button
              type="button"
              className="studio-top-nav__user"
              aria-label={`Signed in as ${displayName}`}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {isLive && <span className="signal-dot studio-top-nav__live-dot" aria-hidden />}
              <span className="studio-top-nav__user-avatar" aria-hidden>
                {initial}
              </span>
              <span className="studio-top-nav__user-name">{displayName}</span>
              <span className="studio-top-nav__user-caret" aria-hidden>
                {open ? '▴' : '▾'}
              </span>
            </button>
            {open && (
              <div className="studio-top-nav__menu" role="menu">
                {channelUrl && (
                  <Link
                    href={channelUrl}
                    className="studio-top-nav__menu-item"
                    role="menuitem"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    <SidebarNavIconSvg name="channel" />
                    My channel
                  </Link>
                )}
                <Link
                  href="/dashboard/settings/account"
                  className="studio-top-nav__menu-item"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <SidebarNavIconSvg name="settings" />
                  Settings
                </Link>
                <div className="studio-top-nav__menu-divider" role="separator" />
                <form action={logoutAction} className="studio-top-nav__menu-form">
                  <button
                    type="submit"
                    className="studio-top-nav__menu-item studio-top-nav__menu-item--danger"
                    role="menuitem"
                  >
                    <IconLogout />
                    Log out
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
