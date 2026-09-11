'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react'

import { ensureHlsScriptLoading, type HlsInstance } from './player-hls'
import type { PlayerState, PlayerTrack } from './player-types'
import { DEFAULT_LIVE_STREAM_QUALITY, qualityLabelForBitrate } from './player-utils'

const HISTORY_LIMIT = 50

export function useTeardownHls(hlsRef: MutableRefObject<HlsInstance | null>) {
  return useCallback(() => {
    hlsRef.current?.destroy()
    hlsRef.current = null
  }, [hlsRef])
}

export function usePlayerLoad(opts: {
  audioRef: RefObject<HTMLAudioElement | null>
  hlsRef: MutableRefObject<HlsInstance | null>
  currentTrackIdRef: MutableRefObject<string | null>
  currentTrackRef: MutableRefObject<PlayerTrack | null>
  queueRef: MutableRefObject<PlayerTrack[] | null>
  shufflePlayedRef: MutableRefObject<Set<string>>
  radioResumeRef: MutableRefObject<PlayerTrack | null>
  embedTimerRef: MutableRefObject<number | null>
  setState: Dispatch<SetStateAction<PlayerState>>
  setQueue: Dispatch<SetStateAction<PlayerTrack[]>>
  setHistory: Dispatch<SetStateAction<PlayerTrack[]>>
  teardownHls: () => void
}) {
  const {
    audioRef,
    hlsRef,
    currentTrackIdRef,
    currentTrackRef,
    queueRef,
    shufflePlayedRef,
    radioResumeRef,
    embedTimerRef,
    setState,
    setQueue,
    setHistory,
    teardownHls,
  } = opts

  const load = useCallback(
    (track: PlayerTrack, loadOpts?: { autoplay?: boolean; queue?: PlayerTrack[] }) => {
      const audio = audioRef.current
      if (!audio) return

      const nextQueue = loadOpts?.queue ?? null
      const prevQueueIds = (queueRef.current ?? []).map((t) => t.id).join('\0')
      const nextQueueIds = (nextQueue ?? []).map((t) => t.id).join('\0')
      queueRef.current = nextQueue
      setQueue(nextQueue ?? [])
      // New playlist identity — restart the shuffle drain so random next can visit
      // every track before wrapping again.
      if (prevQueueIds !== nextQueueIds) {
        shufflePlayedRef.current = new Set()
      }

      if (currentTrackIdRef.current === track.id) {
        if (loadOpts?.autoplay !== false) {
          audio.play().catch((e) => console.warn('[player] play() rejected', e))
        }
        return
      }

      const prevTrack = currentTrackRef.current
      if (embedTimerRef.current != null) {
        window.clearTimeout(embedTimerRef.current)
        embedTimerRef.current = null
      }
      // Recorded the moment a track STARTS, not when it's superseded — otherwise a
      // session that only ever plays one track (e.g. tunes into radio and leaves it
      // running) never gets an entry, since nothing ever displaces it to trigger the
      // old "archive prevTrack on switch" write. Later re-loads of the same track just
      // dedupe back to the top instead of piling up duplicates.
      setHistory((h) => [track, ...h.filter((t) => t.id !== track.id)].slice(0, HISTORY_LIMIT))
      // Diverting from a live stream to a one-off track — remember the stream so
      // onEnded can hand playback back to it. Starting a live stream directly (the
      // listener picked a new one on purpose) clears any stale resume target.
      if (prevTrack && prevTrack.kind === 'live' && track.kind !== 'live') {
        radioResumeRef.current = prevTrack
      } else if (track.kind === 'live') {
        radioResumeRef.current = null
      }
      currentTrackIdRef.current = track.id
      currentTrackRef.current = track

      setState((prev) => ({
        ...prev,
        track,
        playing: false,
        buffering: false,
        error: false,
        currentTime: 0,
        duration: 0,
        streamQuality: null,
      }))

      teardownHls()

      // Embed tracks (hearthis.at, etc.) have no file for the shared <audio>
      // element to play — silence it so a previous native track doesn't keep
      // running underneath the embed widget, and skip straight past the HLS/
      // native-audio branches below. `playing` is set optimistically off the
      // requested autoplay intent, since there's no <audio> 'play'/'pause'
      // event to derive it from for an embed track.
      if (track.embed) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        const autoplay = loadOpts?.autoplay !== false
        setState((prev) => ({
          ...prev,
          playing: autoplay,
          duration: track.durationSec ?? 0,
        }))
        return
      }

      const playWhenReady = () => {
        if (loadOpts?.autoplay !== false) {
          audio.play().catch((e) => console.warn('[player] play() rejected', e))
        }
      }

      // 'live' tracks are usually an HLS (.m3u8) playlist, but can also be a plain
      // audio file standing in for a stream (e.g. a looping demo track) — only take
      // the hls.js path for an actual playlist URL.
      const isHlsUrl = track.url.split(/[#?]/)[0]!.toLowerCase().endsWith('.m3u8')
      // A 'live' track that isn't an HLS playlist is a stand-in file for a stream
      // (e.g. a demo loop) — it should never audibly "end". Set unconditionally so
      // switching away from such a track doesn't leave loop=true behind on the
      // shared <audio> element.
      audio.loop = track.kind === 'live' && !isHlsUrl

      if (
        track.kind === 'live' &&
        isHlsUrl &&
        !audio.canPlayType('application/vnd.apple.mpegurl')
      ) {
        const init = () => {
          const Hls = window.Hls
          if (Hls?.isSupported()) {
            // hls.js defaults liveDurationInfinity to false, which sets the
            // MediaSource's actual duration to "end of the last fragment"
            // instead of Infinity for a live stream — confirmed live in
            // production: Firefox reported audio.duration as the buffered
            // window size (~16s) instead of Infinity/NaN like Chromium,
            // which made the UI think this open-ended stream was a short,
            // finite, seekable track once currentTime caught up to it, and
            // caused real MSE stalling/rebuffering as more segments arrived
            // past that stale ceiling. This is hls.js's own documented flag
            // for exactly this case, not a workaround.
            const hls = new Hls({ liveDurationInfinity: true })
            hlsRef.current = hls
            hls.on(Hls.Events.ERROR, (_event, data) => {
              console.error('[player] hls.js error', data.type, data.details, data)
              if (data.fatal) setState((prev) => ({ ...prev, error: true, buffering: false }))
            })
            hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
              const bitrate = hls.levels[data.level]?.bitrate
              if (!bitrate) return
              setState((prev) => ({ ...prev, streamQuality: qualityLabelForBitrate(bitrate) }))
            })
            setState((prev) => ({ ...prev, streamQuality: DEFAULT_LIVE_STREAM_QUALITY }))
            hls.loadSource(track.url)
            hls.attachMedia(audio)
            playWhenReady()
          }
        }
        ensureHlsScriptLoading(init)
      } else {
        // Safari plays the .m3u8 natively (no hls.js, so no LEVEL_SWITCHED to
        // report a measured bitrate) — same fixed 192kbps rendition applies.
        if (track.kind === 'live' && isHlsUrl) {
          setState((prev) => ({ ...prev, streamQuality: DEFAULT_LIVE_STREAM_QUALITY }))
        }
        audio.src = track.url
        audio.load()
        playWhenReady()
      }
    },
    [
      audioRef,
      hlsRef,
      currentTrackIdRef,
      currentTrackRef,
      queueRef,
      shufflePlayedRef,
      radioResumeRef,
      embedTimerRef,
      setState,
      setQueue,
      setHistory,
      teardownHls,
    ],
  )

  return { load }
}
