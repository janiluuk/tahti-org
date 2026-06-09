// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VisualPresetProps } from './types'

const PARTICLE_COUNT = 300

export function ParticleFieldPreset({ colorScheme }: VisualPresetProps) {
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

    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const vels = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const accent = new THREE.Color(colorScheme.accent)
    const highlight = new THREE.Color(colorScheme.highlight)
    const muted = new THREE.Color(colorScheme.muted)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4
      vels[i * 3] = (Math.random() - 0.5) * 0.003
      vels[i * 3 + 1] = (Math.random() - 0.5) * 0.003 + 0.001
      vels[i * 3 + 2] = 0
      const t = Math.random()
      const c = t < 0.33 ? accent : t < 0.66 ? highlight : muted
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
    })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    let raf: number
    let disposed = false

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      const pos = geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos.array[i * 3] += vels[i * 3]
        pos.array[i * 3 + 1] += vels[i * 3 + 1]
        if ((pos.array as Float32Array)[i * 3 + 1] > 4) (pos.array as Float32Array)[i * 3 + 1] = -4
        if ((pos.array as Float32Array)[i * 3] > 4) (pos.array as Float32Array)[i * 3] = -4
        if ((pos.array as Float32Array)[i * 3] < -4) (pos.array as Float32Array)[i * 3] = 4
      }
      pos.needsUpdate = true
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
  }, [colorScheme.accent, colorScheme.highlight, colorScheme.muted])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
