// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VisualPresetProps } from './types'

// Adapted from the three.js "webgpu_lights_ies_spotlight" example's look (a
// few real SpotLights carving cones of light onto a floor) using the
// standard WebGL renderer's built-in spotlight + shadow support instead of
// an actual IES photometric profile texture (that's a lighting-authoring
// detail the original demo showcases, not something an always-on ambient
// background needs). The camera drifts in a small, slow orbit that always
// keeps the light pool centered in frame ("hover around the center"), with
// a gentle FOV breathing zoom. Light intensity and color temperature pulse
// with the music.
const LIGHT_COUNT = 3

export function IesSpotlightPreset({ colorScheme, analyser }: VisualPresetProps) {
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
    const baseFov = 42
    const camera = new THREE.PerspectiveCamera(baseFov, w / h, 0.1, 100)

    const accent = new THREE.Color(colorScheme.accent)
    const highlight = new THREE.Color(colorScheme.highlight)
    const muted = new THREE.Color(colorScheme.muted)
    const palette = [accent, highlight, muted]

    const ambient = new THREE.AmbientLight(muted, 0.12)
    scene.add(ambient)

    const floorGeo = new THREE.PlaneGeometry(10, 10)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.85 })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.2
    scene.add(floor)

    interface Rig {
      light: THREE.SpotLight
      fixture: THREE.Sprite
      baseIntensity: number
      angle: number
      radius: number
      speed: number
      phase: number
    }

    function makeGlowTexture(): THREE.CanvasTexture {
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      gradient.addColorStop(0, 'rgba(255,255,255,1)')
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
      return new THREE.CanvasTexture(canvas)
    }

    const glowTexture = makeGlowTexture()
    const rigs: Rig[] = []
    for (let i = 0; i < LIGHT_COUNT; i++) {
      const color = palette[i % palette.length]!
      const baseIntensity = 8 + Math.random() * 3

      const light = new THREE.SpotLight(color, baseIntensity, 12, Math.PI / 7, 0.4, 1.4)
      light.target.position.set(0, -1.2, 0)
      scene.add(light)
      scene.add(light.target)

      const fixtureMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const fixture = new THREE.Sprite(fixtureMat)
      fixture.scale.set(0.28, 0.28, 1)
      scene.add(fixture)

      rigs.push({
        light,
        fixture,
        baseIntensity,
        angle: (i / LIGHT_COUNT) * Math.PI * 2,
        radius: 1.6 + Math.random() * 0.6,
        speed: 0.08 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2,
      })
    }

    let raf: number
    let disposed = false
    let t = 0
    let smoothedBass = 0
    let smoothedLevel = 0
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      t += 0.01

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
      smoothedBass += (bass - smoothedBass) * 0.05
      smoothedLevel += (level - smoothedLevel) * 0.04

      for (const rig of rigs) {
        const a = rig.angle + t * rig.speed
        const x = Math.cos(a) * rig.radius
        const z = Math.sin(a) * rig.radius
        const y = 2.2 + Math.sin(t * 0.3 + rig.phase) * 0.2
        rig.light.position.set(x, y, z)
        rig.fixture.position.set(x, y, z)

        rig.light.intensity = rig.baseIntensity * (1 + smoothedBass * 0.9 + smoothedLevel * 0.3)
        const fixtureScale = 0.28 * (1 + smoothedBass * 0.5)
        rig.fixture.scale.set(fixtureScale, fixtureScale, 1)
      }

      // Camera hovers around the center — a small, slow orbit that never
      // strays far, plus a gentle FOV breathing zoom.
      const orbitRadius = 3.4
      camera.position.set(
        Math.sin(t * 0.12) * orbitRadius * 0.35,
        0.6 + Math.sin(t * 0.2) * 0.15,
        orbitRadius + Math.cos(t * 0.09) * 0.4,
      )
      camera.lookAt(0, -0.2, 0)
      camera.fov = baseFov * (1 + Math.sin(t * 0.18) * 0.04 - smoothedLevel * 0.03)
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
      glowTexture.dispose()
      floorGeo.dispose()
      floorMat.dispose()
      rigs.forEach((rig) => {
        rig.fixture.material.dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.highlight, colorScheme.muted, analyser])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
