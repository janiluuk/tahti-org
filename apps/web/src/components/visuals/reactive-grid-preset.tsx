// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { readSettings, type VisualPresetProps } from './types'
import { isSoftwareWebglRenderer } from '@/lib/webgl-support'

const GRID_W = 24
const GRID_H = 14
const CELL_COUNT = GRID_W * GRID_H
const VERTS_PER_CELL = 6 // two triangles, non-indexed

export function ReactiveGridPreset({ colorScheme, analyser, settingsRef }: VisualPresetProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth || 1
    const h = mount.clientHeight || 1

    // antialias is a real cost on a software (CPU) rasterizer specifically —
    // there's no dedicated MSAA hardware to offload it to there, so it's the
    // renderer doing extra full-resolution sampling work in software.
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })

    // A software rasterizer's cost scales with total pixels touched (fill
    // rate) far more steeply than a real GPU's — confirmed live: disabling
    // this visualizer entirely was the single biggest factor in it feeling
    // fast at all on affected hardware. Rendering at a fraction of the
    // canvas's actual size and letting the browser upscale it via CSS (the
    // `false` below already skips syncing the canvas's CSS size to the
    // drawing buffer, so this only shrinks the internal resolution, not the
    // visible size) cuts that dominant cost directly instead of trading away
    // scene complexity that was already down to a single draw call.
    const softwareRendered = isSoftwareWebglRenderer(renderer.getContext())
    renderer.setPixelRatio(softwareRendered ? 0.4 : Math.min(devicePixelRatio, 2))
    renderer.setSize(w, h, false)
    // setSize's `updateStyle=false` skips touching the canvas's CSS size —
    // it otherwise falls back to the drawing-buffer's own width/height
    // attributes as its layout size, which would make a reduced pixel ratio
    // visibly shrink the canvas instead of just lowering its resolution.
    // Force it to fill the mount div regardless of the buffer size.
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 5

    const accent = new THREE.Color(colorScheme.accent)
    const muted = new THREE.Color(colorScheme.muted)
    const highlight = new THREE.Color(colorScheme.highlight)
    const cellColor = new THREE.Color()

    const cellW = 2 / GRID_W
    const cellH = 2 / GRID_H
    const pad = 0.02
    const hw = (cellW - pad) / 2
    const hh = (cellH - pad) / 2

    // 336 cells used to each be their own Mesh with their own geometry and
    // material — 336 draw calls and 336 material/uniform updates every
    // frame for what's visually just a grid of colored squares. One merged,
    // vertex-colored geometry (same technique as the grid/spectrum lines in
    // bg-canvas.tsx) draws it all in a single call; opacity, which
    // MeshBasicMaterial can't vary per-vertex, is averaged across cells into
    // one material-wide value instead of tracked per-cell.
    const positions = new Float32Array(CELL_COUNT * VERTS_PER_CELL * 3)
    const colors = new Float32Array(CELL_COUNT * VERTS_PER_CELL * 3)
    const phases = new Float32Array(CELL_COUNT)

    let vi = 0
    for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        const cx = -1 + col * cellW + cellW / 2
        const cy = -1 + row * cellH + cellH / 2
        const x0 = cx - hw,
          x1 = cx + hw
        const y0 = cy - hh,
          y1 = cy + hh
        // Two triangles: (x0,y0)-(x1,y0)-(x1,y1) and (x0,y0)-(x1,y1)-(x0,y1)
        const quad = [x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1]
        for (let k = 0; k < VERTS_PER_CELL; k++) {
          positions[vi * 3] = quad[k * 2]!
          positions[vi * 3 + 1] = quad[k * 2 + 1]!
          positions[vi * 3 + 2] = 0
          vi++
        }
        phases[row * GRID_W + col] = Math.random() * Math.PI * 2
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const colorAttr = new THREE.BufferAttribute(colors, 3)
    geo.setAttribute('color', colorAttr)

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    let raf: number
    let disposed = false
    let t = 0
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    // The shared analyser's own smoothingTimeConstant is deliberately low
    // (0.3 — see player-context.tsx) so bass-heavy visualizers don't feel
    // laggy behind the beat, but that leaves genuine frame-to-frame jitter in
    // the raw bytes. A flat exponential blend (same factor rising and
    // falling) traded that flicker for the opposite problem — it visibly
    // lagged behind the beat instead. Real VU meters/spectrum analyzers use
    // a fast attack + slower release envelope instead: jump towards a LOUDER
    // reading almost immediately (stays reactive), but ease down from a
    // quieter one (kills single-frame flicker on decay, which is where the
    // jitter actually reads as flicker — a value climbing is expected motion,
    // one value randomly dropping and popping back up next frame is not).
    const smooth = data ? new Float32Array(data.length) : null
    const ATTACK = 0.65
    const RELEASE = 0.2

    // Now a single draw call (see the merged geometry above) instead of 336,
    // so it can run at full frame rate without the cost that motivated
    // throttling it before.
    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)

      const { speed, intensity } = readSettings(settingsRef)
      t += 0.02 * speed

      if (analyser && data && smooth) {
        analyser.getByteFrequencyData(data)
        for (let i = 0; i < data.length; i++) {
          const target = data[i]! / 255
          const a = target > smooth[i]! ? ATTACK : RELEASE
          smooth[i] = smooth[i]! * (1 - a) + target * a
        }
      }

      let opacitySum = 0
      for (let i = 0; i < CELL_COUNT; i++) {
        let pulse = Math.sin(t + phases[i]!) * 0.5 + 0.5
        if (smooth) {
          const idx = Math.floor((i / CELL_COUNT) * smooth.length)
          pulse = smooth[idx]!
        }
        cellColor.lerpColors(muted, pulse > 0.7 ? highlight : accent, pulse)
        opacitySum += 0.1 + pulse * 0.3 * intensity

        const base = i * VERTS_PER_CELL * 3
        for (let k = 0; k < VERTS_PER_CELL; k++) {
          colors[base + k * 3] = cellColor.r
          colors[base + k * 3 + 1] = cellColor.g
          colors[base + k * 3 + 2] = cellColor.b
        }
      }
      colorAttr.needsUpdate = true
      mat.opacity = opacitySum / CELL_COUNT

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
      geo.dispose()
      mat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.muted, colorScheme.highlight, analyser])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
