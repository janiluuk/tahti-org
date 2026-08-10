'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React, { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '../lib/cn'
import { chatHandleVariant } from '../lib/chat-handle'
import { flagEmoji } from '../lib/flag-emoji'
import { Pill } from './Pill'

export type LiveChatSurface = 'playground' | 'channel'

export interface LiveChatMessage {
  id: string
  handle: string
  text: string
  tone?: 'artist' | 'moderator' | 'self' | 'supporter' | 'default' | 'system'
  countryCode?: string | null
  /** Present on 'system' messages (e.g. "X loved Y") — links to the track. */
  href?: string
  /** Unix ms — shown as a humanized age in the message row's corner. */
  ts?: number
}

/** "just now" / "4m ago" / "2h ago" / "5d ago" / "2mo ago" / "over a year ago". */
export function formatMessageAge(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const month = Math.floor(day / 30.44)
  if (month < 12) return `${month}mo ago`
  return 'over a year ago'
}

export type ChatMentionSuggestion = {
  username: string
  displayName: string
}

export interface LiveChatPanelProps {
  title?: string
  /** Playground card vs production channel rail (`ch-chat-panel`). */
  surface?: LiveChatSurface
  /** Fan chat sub-panel — shorter message area. */
  compact?: boolean
  as?: 'section' | 'aside'
  /** Connected to Centrifugo — shows live badge. */
  connected?: boolean
  /** @deprecated use `connected` on channel surface */
  live?: boolean
  listeners?: number
  listenerCount?: number | null
  /** Distinct listeners so far today (UTC) — shown alongside the live count. */
  dailyListenerCount?: number | null
  /** Extra control rendered in the channel-surface header, e.g. a "love this track" button. */
  headerExtra?: React.ReactNode
  pinned?: React.ReactNode
  messages: LiveChatMessage[]
  messagesRef?: RefObject<HTMLDivElement>
  inputValue?: string
  onInputChange?: (value: string) => void
  onSend?: () => void
  inputPlaceholder?: string
  sendLabel?: string
  /** Join-before-chat flow for public channel chat. 'prompt' (default entry
   * point for a visitor who hasn't joined yet) shows just a single "Join
   * chat" affordance — no handle input, no captcha — until onStartJoin
   * fires, which is when the real 'join' form (and, for anonymous
   * visitors, the captcha widget) actually appears. Skip straight to 'join'
   * (never pass 'prompt') if there's no reason to gate it, e.g. a returning
   * visitor being silently rejoined. */
  authPhase?: 'prompt' | 'join' | 'chat'
  onStartJoin?: () => void
  startJoinLabel?: string
  joinHandle?: string
  onJoinHandleChange?: (value: string) => void
  onJoin?: () => void
  joinLabel?: string
  joinPlaceholder?: string
  inputDisabled?: boolean
  sendDisabled?: boolean
  error?: string | null
  emptyMessage?: string
  readOnly?: boolean
  captchaSlot?: React.ReactNode
  className?: string
  /**
   * When set, typing `@partial` in the chat composer searches for users to tag.
   * Mentions notify the tagged user when the sender is signed in.
   */
  onSearchMentions?: (query: string) => Promise<ChatMentionSuggestion[]>
}

function playgroundHandleClass(message: LiveChatMessage): string {
  if (message.tone === 'artist' || message.tone === 'self') return 'live-chat-msg__handle--artist'
  return `live-chat-msg__handle--${chatHandleVariant(message.handle)}`
}

function playgroundHandleSuffix(message: LiveChatMessage): string | null {
  if (message.tone === 'artist') return '(artist)'
  if (message.tone === 'self') return '(you)'
  return null
}

function activeMentionQuery(
  value: string,
  cursor: number,
): { start: number; query: string } | null {
  const uptoCursor = value.slice(0, cursor)
  const match = /(?:^|\s)@([a-zA-Z0-9_-]{0,30})$/.exec(uptoCursor)
  if (!match) return null
  const start = uptoCursor.length - match[1]!.length - 1
  return { start, query: match[1]! }
}

/** Link @handles in chat text to public profiles. */
export function renderChatMessageText(text: string): React.ReactNode {
  const parts = text.split(/(@[a-zA-Z0-9_-]{2,32})/g)
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9_-]{2,32}$/.test(part)) {
      const username = part.slice(1)
      return (
        <a key={i} href={`/u/${username}`} className="chat-mention">
          {part}
        </a>
      )
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

/** Channel right-rail chat — header, pinned slot, messages, input. */
export function LiveChatPanel({
  title = 'LIVE CHAT',
  surface = 'playground',
  compact = false,
  as: Tag = surface === 'channel' ? 'aside' : 'section',
  connected,
  live = true,
  listeners,
  listenerCount,
  dailyListenerCount,
  headerExtra,
  pinned,
  messages,
  messagesRef,
  inputValue,
  onInputChange,
  onSend,
  inputPlaceholder = 'Say something…',
  sendLabel = 'Send',
  authPhase = 'chat',
  onStartJoin,
  startJoinLabel = 'Join chat',
  joinHandle = '',
  onJoinHandleChange,
  onJoin,
  joinLabel = 'Join',
  joinPlaceholder = 'Your handle',
  inputDisabled = false,
  sendDisabled = false,
  error,
  emptyMessage = 'Be the first to say hi.',
  readOnly = false,
  captchaSlot,
  className,
  onSearchMentions,
}: LiveChatPanelProps) {
  const [internalInput, setInternalInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionMatches, setMentionMatches] = useState<ChatMentionSuggestion[]>([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const isChannel = surface === 'channel'
  const showLive = connected ?? (isChannel ? false : live)
  const count = listenerCount ?? listeners

  const chatValue = inputValue ?? internalInput
  const setChatValue = onInputChange ?? setInternalInput

  useEffect(() => {
    if (!onSearchMentions || mentionStart === null || authPhase !== 'chat') {
      setMentionMatches([])
      return
    }
    const cursor = inputRef.current?.selectionStart ?? chatValue.length
    const active = activeMentionQuery(chatValue, cursor)
    if (!active) {
      setMentionStart(null)
      setMentionMatches([])
      return
    }
    const handle = window.setTimeout(() => {
      void onSearchMentions(active.query).then((results) => {
        setMentionMatches(results)
        setMentionIndex(0)
      })
    }, 180)
    return () => window.clearTimeout(handle)
  }, [authPhase, chatValue, mentionStart, onSearchMentions])

  function handleSend() {
    if (!chatValue.trim()) return
    onSend?.()
    if (!onInputChange) setInternalInput('')
    setMentionStart(null)
    setMentionMatches([])
  }

  function handleJoin() {
    if (!joinHandle.trim()) return
    onJoin?.()
  }

  function updateChatValue(next: string, cursorHint?: number) {
    setChatValue(next)
    const cursor = cursorHint ?? next.length
    const active = onSearchMentions ? activeMentionQuery(next, cursor) : null
    setMentionStart(active ? active.start : null)
  }

  function selectMention(user: ChatMentionSuggestion) {
    if (mentionStart === null) return
    const cursor = inputRef.current?.selectionStart ?? chatValue.length
    const before = chatValue.slice(0, mentionStart)
    const after = chatValue.slice(cursor)
    const next = `${before}@${user.username} ${after}`
    updateChatValue(next, before.length + user.username.length + 2)
    setMentionStart(null)
    setMentionMatches([])
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function handleChatKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % mentionMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMention(mentionMatches[mentionIndex]!)
        return
      }
      if (e.key === 'Escape') {
        setMentionStart(null)
        setMentionMatches([])
        return
      }
    }
    if (e.key === 'Enter') {
      if (authPhase === 'join') handleJoin()
      else handleSend()
    }
  }

  const rootClass = isChannel
    ? cn('ch-chat-panel', compact && 'ch-chat-panel--sub', className)
    : cn('live-chat-panel', className)

  const chatComposer =
    authPhase === 'chat' ? (
      <div className={isChannel ? 'ch-chat-composer' : 'live-chat-panel__composer'}>
        {mentionMatches.length > 0 ? (
          <ul className="ch-chat-mention-menu" role="listbox" aria-label="Mention someone">
            {mentionMatches.map((user, i) => (
              <li key={user.username}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === mentionIndex}
                  className={cn(
                    'ch-chat-mention-menu__item',
                    i === mentionIndex && 'ch-chat-mention-menu__item--active',
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    selectMention(user)
                  }}
                >
                  <span className="ch-chat-mention-menu__name">{user.displayName}</span>
                  <span className="ch-chat-mention-menu__handle">@{user.username}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={isChannel ? 'ch-chat-input-row' : 'live-chat-panel__input-row'}>
          <input
            ref={inputRef}
            type="text"
            value={chatValue}
            onChange={(e) =>
              updateChatValue(e.target.value, e.target.selectionStart ?? e.target.value.length)
            }
            onKeyDown={handleChatKeyDown}
            placeholder={onSearchMentions ? `${inputPlaceholder} (@ to mention)` : inputPlaceholder}
            maxLength={500}
            disabled={inputDisabled}
            aria-label="Chat message"
            aria-autocomplete={onSearchMentions ? 'list' : undefined}
          />
          <button
            type="button"
            className={isChannel ? 'ch-chat-send' : 'live-chat-panel__send'}
            onClick={handleSend}
            disabled={sendDisabled}
          >
            {sendLabel}
          </button>
        </div>
      </div>
    ) : null

  let inputBlock: React.ReactNode = null
  if (!readOnly) {
    if (!isChannel) {
      inputBlock = chatComposer
    } else if (authPhase === 'prompt') {
      inputBlock = (
        <div className="ch-chat-input-row ch-chat-input-row--prompt">
          <button type="button" className="ch-chat-send" onClick={() => onStartJoin?.()}>
            {startJoinLabel}
          </button>
        </div>
      )
    } else if (authPhase === 'join') {
      inputBlock = (
        <>
          <div className="ch-chat-input-row">
            <input
              type="text"
              value={joinHandle}
              onChange={(e) => onJoinHandleChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoin()
              }}
              placeholder={joinPlaceholder}
              maxLength={32}
              aria-label="Chat handle"
              autoFocus
            />
            <button type="button" className="ch-chat-send" onClick={handleJoin}>
              {joinLabel}
            </button>
          </div>
          {captchaSlot ? <div className="ch-chat-captcha">{captchaSlot}</div> : null}
        </>
      )
    } else {
      inputBlock = chatComposer
    }
  }

  return (
    <Tag className={rootClass} aria-label={title}>
      {isChannel ? (
        <div className="ch-chat-panel__head">
          <h4>{title}</h4>
          {showLive ? <span className="ch-chat-live-badge">live</span> : null}
          {typeof count === 'number' && count > 0 ? (
            <span className="ch-chat-listeners">
              {count} {count === 1 ? 'listener' : 'listeners'}
            </span>
          ) : null}
          {typeof dailyListenerCount === 'number' && dailyListenerCount > 0 ? (
            <span className="ch-chat-listeners ch-chat-listeners--daily">
              {dailyListenerCount} today
            </span>
          ) : null}
          {headerExtra ? <span className="ch-chat-panel__head-extra">{headerExtra}</span> : null}
        </div>
      ) : (
        <header className="live-chat-panel__head">
          <h4 className="live-chat-panel__title">{title}</h4>
          {showLive ? <Pill variant="live" /> : null}
          {typeof count === 'number' ? (
            <span className="live-chat-panel__listeners">{count} listening</span>
          ) : null}
        </header>
      )}

      {!isChannel && error ? <div className="live-chat-panel__error">{error}</div> : null}

      {pinned ? (
        <div className={isChannel ? 'ch-chat-announcements' : 'live-chat-panel__pinned'}>
          {pinned}
        </div>
      ) : null}

      <div
        ref={messagesRef}
        className={cn(
          isChannel ? 'ch-chat-messages' : 'live-chat-panel__messages',
          isChannel && compact && 'ch-chat-messages--short',
        )}
      >
        {messages.length === 0 ? (
          <p className={isChannel ? 'ch-chat-empty' : 'live-chat-panel__empty'}>{emptyMessage}</p>
        ) : isChannel ? (
          messages.map((message) =>
            message.tone === 'system' ? (
              <div key={message.id} className="chat-msg chat-msg--system">
                {message.href ? (
                  <a href={message.href} className="chat-msg__system-text">
                    {message.text}
                  </a>
                ) : (
                  <span className="chat-msg__system-text">{message.text}</span>
                )}
              </div>
            ) : (
              <div key={message.id} className="chat-msg">
                {message.countryCode ? (
                  <span
                    className="chat-flag"
                    aria-label={message.countryCode}
                    title={message.countryCode}
                  >
                    {flagEmoji(message.countryCode)}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'handle',
                    message.tone === 'artist'
                      ? 'handle--artist'
                      : message.tone === 'moderator'
                        ? 'handle--moderator'
                        : `handle--${chatHandleVariant(message.handle)}`,
                  )}
                >
                  {message.handle}
                </span>
                {message.tone === 'artist' ? (
                  <span className="chat-role-badge chat-role-badge--owner">owner</span>
                ) : message.tone === 'moderator' ? (
                  <span className="chat-role-badge chat-role-badge--moderator">mod</span>
                ) : message.tone === 'supporter' ? (
                  <span className="chat-supporter-badge">supporter</span>
                ) : null}
                {message.ts != null && (
                  <span className="chat-msg__time">{formatMessageAge(message.ts)}</span>
                )}
                <span className="text">{renderChatMessageText(message.text)}</span>
              </div>
            ),
          )
        ) : (
          messages.map((message) => {
            const suffix = playgroundHandleSuffix(message)
            return (
              <div key={message.id} className="live-chat-msg">
                <span className={cn('live-chat-msg__handle', playgroundHandleClass(message))}>
                  {message.handle}
                  {suffix ? ` ${suffix}` : ''}
                </span>
                <span className="live-chat-msg__text">{renderChatMessageText(message.text)}</span>
              </div>
            )
          })
        )}
      </div>

      {isChannel && error ? <div className="ch-chat-error">{error}</div> : null}

      {inputBlock}
    </Tag>
  )
}
