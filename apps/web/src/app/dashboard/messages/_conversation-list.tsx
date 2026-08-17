'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@tahti/ui'
import {
  searchUsers,
  startConversation,
  type ConversationSummary,
  type MessageContact,
} from './actions'

type SearchResult = { username: string; displayName: string; avatarUrl: string | null }

function fmtTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function NewMessageBox() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onQueryChange(next: string) {
    setQuery(next)
    if (next.trim().length < 2) {
      setResults([])
      return
    }
    setResults(await searchUsers(next))
  }

  async function pick(username: string) {
    setStarting(true)
    setError(null)
    const res = await startConversation(username)
    if (res.error || !res.conversationId) {
      setError(res.error ?? 'Failed to start conversation')
      setStarting(false)
      return
    }
    router.push(`/dashboard/messages/${res.conversationId}`)
  }

  return (
    <div className="dm-new-message">
      <input
        type="text"
        className="studio-input"
        placeholder="Search for an artist to message…"
        value={query}
        disabled={starting}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="dm-new-message__results">
          {results.map((u) => (
            <li key={u.username}>
              <button
                type="button"
                className="dm-new-message__result"
                onClick={() => pick(u.username)}
                disabled={starting}
              >
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatarUrl} alt="" className="dm-new-message__avatar" />
                ) : (
                  <span className="dm-new-message__avatar dm-new-message__avatar--ph" aria-hidden>
                    {u.displayName.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span>
                  <span className="dm-new-message__name">{u.displayName}</span>
                  <span className="dm-new-message__handle">@{u.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="studio-notice studio-notice--error studio-mt-xs">{error}</p>}
    </div>
  )
}

export function MessageContacts({ contacts }: { contacts: MessageContact[] }) {
  const router = useRouter()
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function openContact(username: string) {
    setStarting(username)
    setError(null)
    const result = await startConversation(username)
    if (!result.conversationId) {
      setError(result.error ?? 'Failed to open conversation')
      setStarting(null)
      return
    }
    router.push(`/dashboard/messages/${result.conversationId}`)
  }

  return (
    <aside className="dm-contacts" aria-label="Message contacts">
      <div className="dm-contacts__head">
        <h2>Contacts</h2>
        <span>{contacts.length}</span>
      </div>
      {contacts.length === 0 ? (
        <p className="dm-contacts__empty">Follow artists to keep them close at hand.</p>
      ) : (
        <ul className="dm-contacts__list">
          {contacts.map((contact) => (
            <li key={contact.username}>
              <button
                type="button"
                className="dm-contact"
                disabled={starting !== null}
                onClick={() => void openContact(contact.username)}
              >
                {contact.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={contact.avatarUrl} alt="" className="dm-contact__avatar" />
                ) : (
                  <span className="dm-contact__avatar dm-contact__avatar--ph" aria-hidden>
                    {contact.displayName.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="dm-contact__identity">
                  <span className="dm-contact__name">{contact.displayName}</span>
                  <span className="dm-contact__relation">
                    {contact.followsYou && contact.followedByYou
                      ? 'Mutual'
                      : contact.followedByYou
                        ? 'Following'
                        : 'Follows you'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="studio-notice studio-notice--error studio-mt-xs">{error}</p>}
    </aside>
  )
}

export function ConversationList({
  conversations,
  activeId,
  className,
}: {
  conversations: ConversationSummary[]
  /** Highlights the conversation currently open in the thread view, if any. */
  activeId?: string
  className?: string
}) {
  const [showNew, setShowNew] = useState(false)

  return (
    <div className={className ? `dm-inbox ${className}` : 'dm-inbox'}>
      <div className="studio-row studio-row--between studio-mb-sm">
        <span />
        <Button onClick={() => setShowNew((v) => !v)} variant="primary" size="sm">
          {showNew ? 'Cancel' : 'New message'}
        </Button>
      </div>

      {showNew && <NewMessageBox />}

      {conversations.length === 0 ? (
        <p className="studio-empty studio-mt-sm">
          No conversations yet — start one with &quot;New message&quot; above.
        </p>
      ) : (
        <ul className="dm-conversation-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/messages/${c.id}`}
                className={`dm-conversation-row${c.id === activeId ? ' dm-conversation-row--active' : ''}`}
              >
                {c.otherUser.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.otherUser.avatarUrl} alt="" className="dm-conversation-row__avatar" />
                ) : (
                  <span
                    className="dm-conversation-row__avatar dm-conversation-row__avatar--ph"
                    aria-hidden
                  >
                    {c.otherUser.displayName.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="dm-conversation-row__body">
                  <span className="dm-conversation-row__name">
                    {c.otherUser.displayName}
                    {c.otherUser.channelRole === 'owner' ? (
                      <span className="dm-role-badge dm-role-badge--owner">Owner</span>
                    ) : c.otherUser.channelRole === 'moderator' ? (
                      <span className="dm-role-badge dm-role-badge--moderator">Mod</span>
                    ) : null}
                  </span>
                  {c.lastMessage && (
                    <span className="dm-conversation-row__preview">{c.lastMessage.body}</span>
                  )}
                </span>
                <span className="dm-conversation-row__meta">
                  <span className="studio-text-muted-sm">{fmtTime(c.updatedAt)}</span>
                  {c.unreadCount > 0 && (
                    <span className="dm-conversation-row__badge">{c.unreadCount}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
