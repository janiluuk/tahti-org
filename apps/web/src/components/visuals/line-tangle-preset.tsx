// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VisualPresetProps } from './types'

// Adapted from the three.js "webgl_buffergeometry_lines" example: a big tangle
// of randomly-placed line segments, rotating slowly. Segment count is a small
// fraction of the original demo's 10,000 — this runs continuously as an
// ambient background, not a one-off showcase, and colors come from the
// channel's own palette (lerped by position) rather than raw axis-mapped RGB.
const SEGMENTS = 1500
const RADIUS = 3

export function LineTanglePreset({ colorScheme, analyser }: VisualPresetProps) {
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
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100)
    camera.position.z = 4

    const accent = new THREE.Color(colorScheme.accent)
    const highlight = new THREE.Color(colorScheme.highlight)
    const muted = new THREE.Color(colorScheme.muted)

    const positions = new Float32Array(SEGMENTS * 6)
    const colors = new Float32Array(SEGMENTS * 6)

    let x = 0
    let y = 0
    let z = 0
    const tmp = new THREE.Color()
    for (let i = 0; i < SEGMENTS; i++) {
      const i6 = i * 6
      positions[i6] = x
      positions[i6 + 1] = y
      positions[i6 + 2] = z

      x += (Math.random() - 0.5) * 0.4
      y += (Math.random() - 0.5) * 0.4
      z += (Math.random() - 0.5) * 0.4

      positions[i6 + 3] = x
      positions[i6 + 4] = y
      positions[i6 + 5] = z

      // blend the three palette colors by normalized position, so the tangle
      // reads as "on brand" rather than a raw axis-mapped RGB rainbow
      const u = THREE.MathUtils.clamp(x / RADIUS + 0.5, 0, 1)
      const v = THREE.MathUtils.clamp(y / RADIUS + 0.5, 0, 1)
      tmp
        .copy(muted)
        .lerp(accent, u)
        .lerp(highlight, v * 0.6)
      colors[i6] = tmp.r
      colors[i6 + 1] = tmp.g
      colors[i6 + 2] = tmp.b
      colors[i6 + 3] = tmp.r
      colors[i6 + 4] = tmp.g
      colors[i6 + 5] = tmp.b

      // random-walk that wanders too far off-center: pull back toward origin
      if (Math.abs(x) > RADIUS) x *= 0.5
      if (Math.abs(y) > RADIUS) y *= 0.5
      if (Math.abs(z) > RADIUS) z *= 0.5
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
    })
    const lines = new THREE.LineSegments(geo, mat)
    scene.add(lines)

    let raf: number
    let disposed = false
    let t = 0
    let smoothedBass = 0
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      t += 0.0025

      let bass = 0
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData)
        const bassEnd = Math.max(1, Math.floor(freqData.length * 0.15))
        for (let i = 0; i < bassEnd; i++) bass += freqData[i]!
        bass = bass / bassEnd / 255
      }
      // subtle: audio only ever nudges the rotation a little faster, never dominates it
      smoothedBass += (bass - smoothedBass) * 0.04

      lines.rotation.x = t * 0.25
      lines.rotation.y = t * 0.5 * (1 + smoothedBass * 0.4)

      renderer.render(scene, camera)
    }

    animate()

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth || 1
      const nh = mount.clientHeight || 1
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh, false)
    })
    ro.observe(mount)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      geo.dispose()
      mat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.highlight, colorScheme.muted, analyser])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
