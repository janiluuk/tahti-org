// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VisualPresetProps } from './types'

const BAR_COUNT = 64

export function WaveformBarsPreset({ colorScheme }: VisualPresetProps) {
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
    const highlight = new THREE.Color(colorScheme.highlight)

    const barWidth = 1.9 / BAR_COUNT
    const gap = 0.1 / BAR_COUNT
    const bars: THREE.Mesh[] = []
    const heights = new Float32Array(BAR_COUNT)

    for (let i = 0; i < BAR_COUNT; i++) {
      const geo = new THREE.PlaneGeometry(barWidth - gap, 1)
      const mat = new THREE.MeshBasicMaterial({ color: accent })
      const mesh = new THREE.Mesh(geo, mat)
      const x = -0.95 + i * barWidth + barWidth / 2
      mesh.position.set(x, -1, 0)
      scene.add(mesh)
      bars.push(mesh)
    }

    let frame = 0
    let raf: number
    let disposed = false

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      frame++

      for (let i = 0; i < BAR_COUNT; i++) {
        const t = frame * 0.02 + i * 0.15
        const noise = Math.sin(t) * 0.5 + Math.sin(t * 2.3 + 1) * 0.3 + Math.sin(t * 0.7) * 0.2
        heights[i] = 0.08 + Math.abs(noise) * 0.35

        const bar = bars[i]
        bar.scale.set(1, heights[i], 1)
        bar.position.y = -1 + heights[i] / 2

        const lerpT = Math.abs(noise)
        const col = new THREE.Color().lerpColors(accent, highlight, lerpT)
        ;(bar.material as THREE.MeshBasicMaterial).color = col
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
      bars.forEach((b) => {
        b.geometry.dispose()
        ;(b.material as THREE.MeshBasicMaterial).dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.highlight])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
