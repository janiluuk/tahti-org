// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { WEBGL_SLIDESHOW_PRESETS, type SlideshowPreset } from '@tahti/shared'
import { WebglSlideshowTransition } from './slideshow-transitions/webgl-slideshow-transition'

function supportsWebGL(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

interface Props {
  images: string[]
  preset: SlideshowPreset
  intervalSeconds: number
  transitionMs: number
  autoplay: boolean
}

type State = { current: number; next: number | null; transitioning: boolean }
type Action = { type: 'START'; next: number } | { type: 'END' }

function reducer(state: State, action: Action): State {
  if (action.type === 'START') return { ...state, next: action.next, transitioning: true }
  if (action.type === 'END')
    return { current: state.next ?? state.current, next: null, transitioning: false }
  return state
}

type CssPreset = 'FADE' | 'ZOOM' | 'PAN' | 'BLUR_CROSS'

// CSS keyframes injected once per preset
const KEYFRAMES: Record<CssPreset, string> = {
  FADE: `
    @keyframes ch-slide-fade-in  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes ch-slide-fade-out { from { opacity: 1 } to { opacity: 0 } }
  `,
  ZOOM: `
    @keyframes ch-slide-zoom-in  { from { opacity: 0; transform: scale(1.08) } to { opacity: 1; transform: scale(1) } }
    @keyframes ch-slide-zoom-out { from { opacity: 1; transform: scale(1)    } to { opacity: 0; transform: scale(0.93) } }
  `,
  PAN: `
    @keyframes ch-slide-pan-in  { from { opacity: 0; transform: translateX(60px) } to { opacity: 1; transform: translateX(0) } }
    @keyframes ch-slide-pan-out { from { opacity: 1; transform: translateX(0)     } to { opacity: 0; transform: translateX(-60px) } }
  `,
  BLUR_CROSS: `
    @keyframes ch-slide-blur-in  { from { opacity: 0; filter: blur(12px) } to { opacity: 1; filter: blur(0) } }
    @keyframes ch-slide-blur-out { from { opacity: 1; filter: blur(0)     } to { opacity: 0; filter: blur(12px) } }
  `,
}

const ANIM_IN: Record<CssPreset, string> = {
  FADE: 'ch-slide-fade-in',
  ZOOM: 'ch-slide-zoom-in',
  PAN: 'ch-slide-pan-in',
  BLUR_CROSS: 'ch-slide-blur-in',
}
const ANIM_OUT: Record<CssPreset, string> = {
  FADE: 'ch-slide-fade-out',
  ZOOM: 'ch-slide-zoom-out',
  PAN: 'ch-slide-pan-out',
  BLUR_CROSS: 'ch-slide-blur-out',
}

function useInjectKeyframes(preset: CssPreset) {
  useEffect(() => {
    const id = `ch-slide-kf-${preset}`
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = KEYFRAMES[preset]
    document.head.appendChild(style)
  }, [preset])
}

export function ChannelSlideshow({
  images,
  preset,
  intervalSeconds,
  transitionMs,
  autoplay,
}: Props) {
  const [state, dispatch] = useReducer(reducer, { current: 0, next: null, transitioning: false })
  const [reduceMotion, setReduceMotion] = useState(false)
  const [webglReady, setWebglReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentRef = useRef(state.current)
  currentRef.current = state.current

  const isWebglPreset = WEBGL_SLIDESHOW_PRESETS.has(preset)
  // Falls back to a plain CSS fade when WebGL isn't available (checked client-side
  // below) or the visitor prefers reduced motion — never a hard, jarring cut.
  const cssPreset: CssPreset = isWebglPreset ? 'FADE' : (preset as CssPreset)
  const useWebgl = isWebglPreset && webglReady && !reduceMotion

  useInjectKeyframes(cssPreset)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const onChange = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', onChange)
    setWebglReady(supportsWebGL())
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const effectiveAutoplay = autoplay && !reduceMotion
  const effectiveTransitionMs = reduceMotion ? 0 : transitionMs

  useEffect(() => {
    if (!effectiveAutoplay || images.length < 2) return

    function advance() {
      const nextIdx = (currentRef.current + 1) % images.length
      dispatch({ type: 'START', next: nextIdx })
      transitionRef.current = setTimeout(() => {
        dispatch({ type: 'END' })
      }, effectiveTransitionMs)
    }

    timerRef.current = setTimeout(advance, intervalSeconds * 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (transitionRef.current) clearTimeout(transitionRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.current, effectiveAutoplay, images.length, intervalSeconds, effectiveTransitionMs])

  const dur = reduceMotion ? undefined : `${effectiveTransitionMs}ms`
  const ease = 'cubic-bezier(0.4,0,0.2,1)'

  return (
    <div
      className="ch-channel-slideshow"
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        borderRadius: 8,
        aspectRatio: '16/7',
      }}
    >
      {/* Current image — the static base. During a WebGL transition it stays put,
          unanimated, underneath the WebGL overlay, which loads both images itself
          and drives the whole visual transition; during a CSS transition it animates
          out per the preset's keyframes, same as before. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={`cur-${state.current}`}
        src={images[state.current]}
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          animation:
            state.transitioning && !reduceMotion && !useWebgl
              ? `${ANIM_OUT[cssPreset]} ${dur} ${ease} forwards`
              : undefined,
        }}
      />

      {/* Next image — CSS presets animate it in as an overlay; WebGL presets skip
          this entirely (the WebGL overlay below renders both images itself) to
          avoid it popping in before the WebGL canvas has loaded its textures. */}
      {state.transitioning && state.next !== null && !reduceMotion && !useWebgl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`next-${state.next}`}
          src={images[state.next]}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            animation: `${ANIM_IN[cssPreset]} ${dur} ${ease} forwards`,
          }}
        />
      )}

      {useWebgl && state.transitioning && state.next !== null && (
        <WebglSlideshowTransition
          key={`webgl-${state.current}-${state.next}`}
          preset={preset}
          fromUrl={images[state.current]!}
          toUrl={images[state.next]!}
          durationMs={effectiveTransitionMs}
          onComplete={() => {
            // The existing setTimeout in the advance effect above already dispatches
            // END at the same effectiveTransitionMs — this is a no-op in the normal
            // case, just a safety net if this callback ever fires first.
            dispatch({ type: 'END' })
          }}
        />
      )}
    </div>
  )
}
