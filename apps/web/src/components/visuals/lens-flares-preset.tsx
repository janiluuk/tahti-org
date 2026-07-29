// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VisualPresetProps } from './types'

// Adapted from the three.js "webgpu_lensflares" example's look (bright glow
// + a chain of smaller rings toward frame center, additive-blended) using
// sprites instead of WebGPU TSL nodes. Unlike the original demo's static
// lights, each flare here drifts on its own Lissajous-style path so it keeps
// changing direction — "subtly but swift" per the brief — rather than a slow
// steady wander like CLOUDSCAPE.
const FLARE_COUNT = 3
const RING_FRACTIONS = [0.3, 0.5, 0.7, 1.0]

function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.5)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

function makeRingTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2)
  ctx.stroke()
  return new THREE.CanvasTexture(canvas)
}

interface FlareRig {
  group: THREE.Group
  glow: THREE.Sprite
  freqX: number
  freqY: number
  phaseX: number
  phaseY: number
  ampX: number
  ampY: number
  glowBaseScale: number
}

export function LensFlaresPreset({ colorScheme, analyser }: VisualPresetProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth || 1
    const h = mount.clientHeight || 1

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(w, h, false)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 5

    const palette = [
      new THREE.Color(colorScheme.accent),
      new THREE.Color(colorScheme.highlight),
      new THREE.Color(colorScheme.muted),
    ]

    const glowTexture = makeGlowTexture()
    const ringTexture = makeRingTexture()

    const rigs: FlareRig[] = []
    for (let i = 0; i < FLARE_COUNT; i++) {
      const color = palette[i % palette.length]!
      const group = new THREE.Group()

      const glowBaseScale = 0.55 + Math.random() * 0.2
      const glowMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const glow = new THREE.Sprite(glowMat)
      glow.scale.set(glowBaseScale, glowBaseScale, 1)
      group.add(glow)

      for (const frac of RING_FRACTIONS) {
        const ringMat = new THREE.SpriteMaterial({
          map: ringTexture,
          color,
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const ring = new THREE.Sprite(ringMat)
        const s = 0.06 + frac * 0.1
        ring.scale.set(s, s, 1)
        // positioned toward frame center along this flare's own vector, set per-frame
        ring.userData.frac = frac
        group.add(ring)
      }

      scene.add(group)
      rigs.push({
        group,
        glow,
        // distinct, fairly high frequencies per axis/rig so paths keep
        // changing direction rather than settling into a slow steady drift
        freqX: 0.35 + Math.random() * 0.5,
        freqY: 0.3 + Math.random() * 0.55,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        ampX: 0.45 + Math.random() * 0.35,
        ampY: 0.35 + Math.random() * 0.3,
        glowBaseScale,
      })
    }

    let raf: number
    let disposed = false
    let t = 0
    let smoothedLevel = 0
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      t += 0.016

      let level = 0
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData)
        let sum = 0
        for (let i = 0; i < freqData.length; i++) sum += freqData[i]!
        level = sum / freqData.length / 255
      }
      smoothedLevel += (level - smoothedLevel) * 0.08

      for (const rig of rigs) {
        const x = Math.sin(t * rig.freqX + rig.phaseX) * rig.ampX
        const y = Math.cos(t * rig.freqY + rig.phaseY) * rig.ampY
        rig.group.position.set(x, y, 0)

        const glowScale = rig.glowBaseScale * (1 + smoothedLevel * 0.35)
        rig.glow.scale.set(glowScale, glowScale, 1)

        // chain the rings along the vector back toward frame center
        for (const child of rig.group.children) {
          if (child === rig.glow) continue
          const frac = (child.userData.frac as number) ?? 0.5
          child.position.set(-x * frac, -y * frac, 0)
        }
      }

      renderer.render(scene, camera)
    }

    animate()

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth || 1
      const nh = mount.clientHeight || 1
      renderer.setSize(nw, nh, false)
    })
    ro.observe(mount)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      glowTexture.dispose()
      ringTexture.dispose()
      rigs.forEach((rig) => {
        rig.group.children.forEach((child) => {
          const sprite = child as THREE.Sprite
          sprite.material.dispose()
        })
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.highlight, colorScheme.muted, analyser])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
