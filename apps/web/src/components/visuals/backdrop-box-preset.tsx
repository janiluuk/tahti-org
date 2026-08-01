// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { readSettings, type VisualPresetProps } from './types'

// Adapted from the three.js "webgpu_backdrop_area" example's core idea (a box
// sitting in front of a backdrop, camera framing it) — recreated with the
// standard WebGL renderer this app already uses everywhere else, as a
// translucent glass box rather than the original's render-to-texture blur
// (that's a much heavier technique than an always-on ambient background
// warrants). Zoom (camera FOV), the box's rotation angle, and its size all
// idle-animate on their own, and get an additional subtle nudge from audio
// when an analyser is present.
export function BackdropBoxPreset({ colorScheme, analyser, settingsRef }: VisualPresetProps) {
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
    const baseFov = 50
    const camera = new THREE.PerspectiveCamera(baseFov, w / h, 0.1, 100)
    camera.position.set(2.4, 1.6, 2.4)
    camera.lookAt(0, 0.3, 0)

    const accent = new THREE.Color(colorScheme.accent)
    const highlight = new THREE.Color(colorScheme.highlight)
    const muted = new THREE.Color(colorScheme.muted)

    const group = new THREE.Group()
    scene.add(group)

    const boxGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4)
    const faceMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    })
    const faces = new THREE.Mesh(boxGeo, faceMat)
    group.add(faces)

    const edgesGeo = new THREE.EdgesGeometry(boxGeo)
    const edgeMat = new THREE.LineBasicMaterial({
      color: highlight,
      transparent: true,
      opacity: 0.5,
    })
    const edges = new THREE.LineSegments(edgesGeo, edgeMat)
    group.add(edges)

    // Backdrop — a large translucent floor plane, standing in for the
    // original example's "area" the box sits in front of.
    const floorGeo = new THREE.PlaneGeometry(6, 6)
    const floorMat = new THREE.MeshBasicMaterial({
      color: muted,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.9
    scene.add(floor)

    let raf: number
    let disposed = false
    let t = 0
    let smoothedBass = 0
    let smoothedLevel = 0
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    const baseScale = 1

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      const { speed, intensity } = readSettings(settingsRef)
      t += 0.01 * speed

      let bass = 0
      let level = 0
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData)
        const bassEnd = Math.max(1, Math.floor(freqData.length * 0.15))
        for (let i = 0; i < bassEnd; i++) bass += freqData[i]!
        bass = bass / bassEnd / 255
        let sum = 0
        for (let i = 0; i < freqData.length; i++) sum += freqData[i]!
        level = sum / freqData.length / 255
      }
      smoothedBass += (bass - smoothedBass) * 0.06
      smoothedLevel += (level - smoothedLevel) * 0.04

      // angle: idle slow spin + a gentle wobble, audio adds a little extra speed
      group.rotation.y = t * (0.3 + smoothedLevel * 0.25 * intensity)
      group.rotation.x = Math.sin(t * 0.4) * 0.15 * intensity

      // size: idle breathing, audio bass adds an extra pulse
      const scale =
        baseScale * (1 + Math.sin(t * 0.6) * 0.04 * intensity + smoothedBass * 0.12 * intensity)
      group.scale.setScalar(scale)

      // zoom: idle slow dolly via FOV, audio level adds a subtle extra push
      camera.fov =
        baseFov * (1 + Math.sin(t * 0.25) * 0.03 * intensity - smoothedLevel * 0.05 * intensity)
      camera.updateProjectionMatrix()

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
      boxGeo.dispose()
      faceMat.dispose()
      edgesGeo.dispose()
      edgeMat.dispose()
      floorGeo.dispose()
      floorMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.highlight, colorScheme.muted, analyser])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
