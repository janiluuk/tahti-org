// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { readSettings, type VisualPresetProps } from './types'

const ORB_COUNT = 6

interface Orb {
  mesh: THREE.Mesh
  baseX: number
  baseY: number
  baseZ: number
  driftSpeed: number
  phase: number
}

/** Glowing orbs drifting slowly through a selective-bloom post-processing
 * pass (Three.js UnrealBloomPass) — colored from the channel's accent/
 * highlight palette. `speed` drives drift rate, `intensity` drives bloom
 * strength, `scale` drives orb size and bloom radius, `audioReactive` adds a
 * bass-driven pulse to the bloom strength on top of its base intensity. */
export function BloomPreset({ colorScheme, analyser, settingsRef }: VisualPresetProps) {
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
    renderer.toneMapping = THREE.ReinhardToneMapping
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100)
    camera.position.z = 6

    const accent = new THREE.Color(colorScheme.accent)
    const highlight = new THREE.Color(colorScheme.highlight)

    const orbs: Orb[] = []
    for (let i = 0; i < ORB_COUNT; i++) {
      const color = i % 2 === 0 ? accent : highlight
      const mat = new THREE.MeshBasicMaterial({ color })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 24), mat)
      const baseX = (Math.random() - 0.5) * 6
      const baseY = (Math.random() - 0.5) * 3.5
      const baseZ = (Math.random() - 0.5) * 2
      mesh.position.set(baseX, baseY, baseZ)
      scene.add(mesh)
      orbs.push({
        mesh,
        baseX,
        baseY,
        baseZ,
        driftSpeed: 0.15 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
      })
    }

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.2, 0.6, 0.15)
    composer.addPass(bloomPass)
    composer.addPass(new OutputPass())

    let raf: number
    let disposed = false
    let t = 0
    let smoothedBass = 0
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      const { speed, intensity, scale, audioReactive } = readSettings(settingsRef)
      t += 0.01 * speed

      let bass = 0
      if (audioReactive && analyser && freqData) {
        analyser.getByteFrequencyData(freqData)
        const bassEnd = Math.max(1, Math.floor(freqData.length * 0.15))
        for (let i = 0; i < bassEnd; i++) bass += freqData[i]!
        bass = bass / bassEnd / 255
      }
      smoothedBass += (bass - smoothedBass) * 0.06

      for (const orb of orbs) {
        orb.mesh.position.x = orb.baseX + Math.sin(t * orb.driftSpeed + orb.phase) * 0.6
        orb.mesh.position.y = orb.baseY + Math.cos(t * orb.driftSpeed * 0.8 + orb.phase) * 0.4
        const orbScale = scale * (1 + smoothedBass * 0.4)
        orb.mesh.scale.setScalar(orbScale)
      }

      bloomPass.strength = intensity * (0.9 + smoothedBass * 0.8)
      bloomPass.radius = 0.4 + scale * 0.3

      composer.render()
    }

    animate()

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth || 1
      const nh = mount.clientHeight || 1
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh, false)
      composer.setSize(nw, nh)
    })
    ro.observe(mount)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      for (const orb of orbs) {
        orb.mesh.geometry.dispose()
        ;(orb.mesh.material as THREE.Material).dispose()
      }
      composer.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.highlight, analyser])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
