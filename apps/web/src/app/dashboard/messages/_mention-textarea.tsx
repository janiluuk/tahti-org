'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState } from 'react'
import { searchUsers } from './actions'

type MentionUser = { username: string; displayName: string; avatarUrl: string | null }

/** Finds an in-progress "@partial" token immediately before the cursor, if any. */
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

export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [matches, setMatches] = useState<MentionUser[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)

  useEffect(() => {
    if (mentionStart === null) {
      setMatches([])
      return
    }
    const cursor = textareaRef.current?.selectionStart ?? value.length
    const active = activeMentionQuery(value, cursor)
    if (!active) {
      setMentionStart(null)
      setMatches([])
      return
    }
    const handle = setTimeout(async () => {
      const results = await searchUsers(active.query)
      setMatches(results)
      setActiveIndex(0)
    }, 200)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mentionStart])

  function handleChange(next: string) {
    onChange(next)
    const cursor = textareaRef.current?.selectionStart ?? next.length
    const active = activeMentionQuery(next, cursor)
    setMentionStart(active ? active.start : null)
  }

  function selectMention(user: MentionUser) {
    if (mentionStart === null) return
    const cursor = textareaRef.current?.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(cursor)
    const next = `${before}@${user.username} ${after}`
    onChange(next)
    setMentionStart(null)
    setMatches([])
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMention(matches[activeIndex]!)
        return
      }
      if (e.key === 'Escape') {
        setMentionStart(null)
        setMatches([])
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && matches.length === 0) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="mention-textarea">
      <textarea
        ref={textareaRef}
        className="studio-input mention-textarea__input"
        rows={2}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {matches.length > 0 && (
        <ul className="mention-textarea__dropdown" role="listbox">
          {matches.map((u, i) => (
            <li key={u.username}>
              <button
                type="button"
                className={`mention-textarea__option${i === activeIndex ? ' mention-textarea__option--active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectMention(u)
                }}
              >
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatarUrl} alt="" className="mention-textarea__avatar" />
                ) : (
                  <span
                    className="mention-textarea__avatar mention-textarea__avatar--ph"
                    aria-hidden
                  >
                    {u.displayName.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span>
                  <span className="mention-textarea__name">{u.displayName}</span>
                  <span className="mention-textarea__handle">@{u.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
