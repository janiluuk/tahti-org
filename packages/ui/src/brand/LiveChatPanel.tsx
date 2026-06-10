'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React, { useState, type RefObject } from 'react'
import { cn } from '../lib/cn'
import { chatHandleVariant } from '../lib/chat-handle'
import { flagEmoji } from '../lib/flag-emoji'
import { Pill } from './Pill'

export type LiveChatSurface = 'playground' | 'channel'

export interface LiveChatMessage {
  id: string
  handle: string
  text: string
  tone?: 'artist' | 'self' | 'supporter' | 'default'
  countryCode?: string | null
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
  pinned?: React.ReactNode
  messages: LiveChatMessage[]
  messagesRef?: RefObject<HTMLDivElement>
  inputValue?: string
  onInputChange?: (value: string) => void
  onSend?: () => void
  inputPlaceholder?: string
  sendLabel?: string
  /** Join-before-chat flow for public channel chat. */
  authPhase?: 'join' | 'chat'
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
  className?: string
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
  pinned,
  messages,
  messagesRef,
  inputValue,
  onInputChange,
  onSend,
  inputPlaceholder = 'Say something…',
  sendLabel = 'Send',
  authPhase = 'chat',
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
  className,
}: LiveChatPanelProps) {
  const [internalInput, setInternalInput] = useState('')
  const isChannel = surface === 'channel'
  const showLive = connected ?? (isChannel ? false : live)
  const count = listenerCount ?? listeners

  const chatValue = inputValue ?? internalInput
  const setChatValue = onInputChange ?? setInternalInput

  function handleSend() {
    if (!chatValue.trim()) return
    onSend?.()
    if (!onInputChange) setInternalInput('')
  }

  function handleJoin() {
    if (!joinHandle.trim()) return
    onJoin?.()
  }

  const rootClass = isChannel
    ? cn('ch-chat-panel', compact && 'ch-chat-panel--sub', className)
    : cn('live-chat-panel', className)

  const inputBlock =
    !readOnly && (authPhase === 'join' || authPhase === 'chat') ? (
      isChannel ? (
        <div className="ch-chat-input-row">
          <input
            type="text"
            value={authPhase === 'join' ? joinHandle : chatValue}
            onChange={(e) =>
              authPhase === 'join'
                ? onJoinHandleChange?.(e.target.value)
                : setChatValue(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              if (authPhase === 'join') handleJoin()
              else handleSend()
            }}
            placeholder={authPhase === 'join' ? joinPlaceholder : inputPlaceholder}
            maxLength={authPhase === 'join' ? 32 : 500}
            disabled={authPhase === 'chat' ? inputDisabled : false}
            aria-label={authPhase === 'join' ? 'Chat handle' : 'Chat message'}
          />
          <button
            type="button"
            className="ch-chat-send"
            onClick={authPhase === 'join' ? handleJoin : handleSend}
            disabled={authPhase === 'chat' ? sendDisabled : false}
          >
            {authPhase === 'join' ? joinLabel : sendLabel}
          </button>
        </div>
      ) : (
        <div className="live-chat-panel__input-row">
          <input
            type="text"
            value={chatValue}
            onChange={(e) => setChatValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={inputPlaceholder}
            maxLength={500}
            disabled={inputDisabled}
            aria-label="Chat message"
          />
          <button
            type="button"
            className="live-chat-panel__send"
            onClick={handleSend}
            disabled={sendDisabled}
          >
            {sendLabel}
          </button>
        </div>
      )
    ) : null

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
          messages.map((message) => (
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
                  (message.tone === 'supporter' || message.tone === 'artist') && 'supporter',
                )}
              >
                {message.handle}
              </span>
              {message.tone === 'supporter' ? (
                <span className="chat-supporter-badge">supporter</span>
              ) : null}
              <span className="text">{message.text}</span>
            </div>
          ))
        ) : (
          messages.map((message) => {
            const suffix = playgroundHandleSuffix(message)
            return (
              <div key={message.id} className="live-chat-msg">
                <span className={cn('live-chat-msg__handle', playgroundHandleClass(message))}>
                  {message.handle}
                  {suffix ? ` ${suffix}` : ''}
                </span>
                <span className="live-chat-msg__text">{message.text}</span>
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
