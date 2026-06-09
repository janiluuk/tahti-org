// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VisualPresetProps } from './types'

const GRID_W = 24
const GRID_H = 14

export function ReactiveGridPreset({ colorScheme }: VisualPresetProps) {
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

    const accent = new THREE.Color(colorScheme.accent)
    const muted = new THREE.Color(colorScheme.muted)
    const highlight = new THREE.Color(colorScheme.highlight)

    const cellW = 2 / GRID_W
    const cellH = 2 / GRID_H
    const pad = 0.02
    const cells: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[] = []

    for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        const geo = new THREE.PlaneGeometry(cellW - pad, cellH - pad)
        const mat = new THREE.MeshBasicMaterial({ color: muted.clone(), transparent: true, opacity: 0.15 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(
          -1 + col * cellW + cellW / 2,
          -1 + row * cellH + cellH / 2,
          0,
        )
        scene.add(mesh)
        cells.push({ mesh, mat, phase: Math.random() * Math.PI * 2 })
      }
    }

    let raf: number
    let disposed = false
    let t = 0

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      t += 0.02

      for (const { mat, phase } of cells) {
        const pulse = Math.sin(t + phase) * 0.5 + 0.5
        const col = new THREE.Color().lerpColors(muted, pulse > 0.7 ? highlight : accent, pulse)
        mat.color = col
        mat.opacity = 0.1 + pulse * 0.3
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
      cells.forEach(({ mesh, mat }) => {
        mesh.geometry.dispose()
        mat.dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.muted, colorScheme.highlight])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
