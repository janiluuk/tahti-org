'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'

import type { PlayerTrack } from './player-types'

type LoadFn = (track: PlayerTrack, opts?: { autoplay?: boolean; queue?: PlayerTrack[] }) => void

export function usePlayerQueue(opts: {
  getLoad: () => LoadFn
  currentTrack: PlayerTrack | null
  currentTrackIdRef: MutableRefObject<string | null>
  currentTrackRef: MutableRefObject<PlayerTrack | null>
}) {
  const { getLoad, currentTrack, currentTrackIdRef, currentTrackRef } = opts

  const [queue, setQueue] = useState<PlayerTrack[]>([])
  const [queueFlashSignal, setQueueFlashSignal] = useState(0)
  const [history, setHistory] = useState<PlayerTrack[]>([])
  const [repeat, setRepeat] = useState(false)
  const [shuffle, setShuffle] = useState(false)

  /** The ordered list the current track belongs to, for auto-advance + loop on 'ended'.
   * Mirrored into `queue` state below for rendering — this ref is what `onEnded` reads,
   * since its listener closure would otherwise see a stale queue. */
  const queueRef = useRef<PlayerTrack[] | null>(null)
  const repeatRef = useRef(false)
  const shuffleRef = useRef(false)
  /** Track ids already advanced past while shuffle is on — so random next drains the
   * playlist before wrapping (only when repeat is also on). */
  const shufflePlayedRef = useRef<Set<string>>(new Set())

  /** Returns whether it actually advanced to another track — onEnded uses this to
   * know whether to fall back to radioResumeRef instead of just going silent. */
  const playNext = useCallback((): boolean => {
    const q = queueRef.current
    const currentId = currentTrackIdRef.current
    if (!q || q.length < 2 || !currentId) return false
    const idx = q.findIndex((t) => t.id === currentId)
    if (idx === -1) return false

    const load = getLoad()

    if (shuffleRef.current) {
      shufflePlayedRef.current.add(currentId)
      const others = q.filter((t) => t.id !== currentId)
      const unplayed = others.filter((t) => !shufflePlayedRef.current.has(t.id))
      let pool = unplayed
      if (pool.length === 0) {
        if (!repeatRef.current) return false
        shufflePlayedRef.current = new Set([currentId])
        pool = others
      }
      const next = pool[Math.floor(Math.random() * pool.length)]!
      load(next, { autoplay: true, queue: q })
      return true
    }

    const isLast = idx === q.length - 1
    if (isLast && !repeatRef.current) return false
    load(q[(idx + 1) % q.length]!, { autoplay: true, queue: q })
    return true
  }, [currentTrackIdRef, getLoad])

  const playPrevious = useCallback(() => {
    const q = queueRef.current
    const currentId = currentTrackIdRef.current
    if (!q || q.length < 2 || !currentId) return
    const idx = q.findIndex((t) => t.id === currentId)
    if (idx === -1) return
    const prevIdx = idx === 0 ? q.length - 1 : idx - 1
    getLoad()(q[prevIdx]!, { autoplay: true, queue: q })
  }, [currentTrackIdRef, getLoad])

  const toggleRepeat = useCallback(() => {
    setRepeat((prev) => !prev)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const next = !prev
      if (next) {
        shufflePlayedRef.current = new Set(
          currentTrackIdRef.current ? [currentTrackIdRef.current] : [],
        )
        // Shuffle the visible Up Next order so the queue panel matches random mode.
        const base = queueRef.current
        if (base && base.length > 1) {
          const currentIdx = base.findIndex((t) => t.id === currentTrackIdRef.current)
          const head = currentIdx === -1 ? [] : base.slice(0, currentIdx + 1)
          const rest = currentIdx === -1 ? [...base] : base.slice(currentIdx + 1)
          for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[rest[i], rest[j]] = [rest[j]!, rest[i]!]
          }
          const reordered = [...head, ...rest]
          queueRef.current = reordered
          setQueue(reordered)
        }
      } else {
        shufflePlayedRef.current = new Set()
      }
      return next
    })
  }, [currentTrackIdRef])

  const clearQueue = useCallback(() => {
    const current = currentTrackRef.current
    const next = current ? [current] : []
    queueRef.current = next
    setQueue(next)
  }, [currentTrackRef])

  const reorderUpNext = useCallback(
    (newUpNext: PlayerTrack[]) => {
      const base = queueRef.current
      if (!base) return
      const currentIdx = base.findIndex((t) => t.id === currentTrackIdRef.current)
      const head = currentIdx === -1 ? base : base.slice(0, currentIdx + 1)
      const next = [...head, ...newUpNext]
      queueRef.current = next
      setQueue(next)
    },
    [currentTrackIdRef],
  )

  /** Appends to the queue — starts one from the current track if none exists yet. */
  const addToQueue = useCallback(
    (track: PlayerTrack) => {
      const base = queueRef.current ?? (currentTrack ? [currentTrack] : [])
      if (base.some((t) => t.id === track.id)) return false
      const next = [...base, track]
      queueRef.current = next
      setQueue(next)
      setQueueFlashSignal((n) => n + 1)
      return true
    },
    [currentTrack],
  )

  const removeFromQueue = useCallback((trackId: string) => {
    const base = queueRef.current
    if (!base) return
    const next = base.filter((t) => t.id !== trackId)
    queueRef.current = next
    setQueue(next)
  }, [])

  const resetQueueState = useCallback(() => {
    queueRef.current = null
    shufflePlayedRef.current = new Set()
    setQueue([])
  }, [])

  // Kept in sync so onEnded's listener closure (registered once, below) always reads
  // the current value rather than the one captured when the listener was attached.
  useEffect(() => {
    repeatRef.current = repeat
  }, [repeat])

  useEffect(() => {
    shuffleRef.current = shuffle
  }, [shuffle])

  const upNext = useMemo(() => {
    if (!currentTrack) return queue
    const idx = queue.findIndex((t) => t.id === currentTrack.id)
    return idx === -1 ? queue : queue.slice(idx + 1)
  }, [queue, currentTrack])

  return {
    queue,
    setQueue,
    queueFlashSignal,
    history,
    setHistory,
    repeat,
    shuffle,
    queueRef,
    shufflePlayedRef,
    playNext,
    playPrevious,
    toggleRepeat,
    toggleShuffle,
    addToQueue,
    removeFromQueue,
    clearQueue,
    reorderUpNext,
    resetQueueState,
    upNext,
  }
}
