// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VisualPresetProps } from './types'

const CLOUD_COUNT = 6

/** Soft radial-gradient sprite texture, reused for every cloud and the glow. */
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

/** Slow-drifting clouds over a shimmering water band, with a glow ("light")
 * whose size and the water's shimmer amplitude both pulse subtly with audio —
 * kept deliberately understated (small scale deltas, heavily smoothed) rather
 * than the sharper reactivity of REACTIVE_GRID. */
export function CloudscapePreset({ colorScheme, analyser }: VisualPresetProps) {
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
    const muted = new THREE.Color(colorScheme.muted)

    // Sky — soft vertical gradient wash behind everything.
    const skyGeo = new THREE.PlaneGeometry(2, 2)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: muted }, uBottom: { value: accent } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uBottom; varying vec2 vUv;
        void main() { gl_FragColor = vec4(mix(uBottom, uTop, vUv.y), 0.35); }
      `,
      transparent: true,
      depthWrite: false,
    })
    scene.add(new THREE.Mesh(skyGeo, skyMat))

    // Clouds — soft sprites drifting very slowly left to right, wrapping around.
    const glowTexture = makeGlowTexture()
    const clouds: { sprite: THREE.Sprite; speed: number }[] = []
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.16 + Math.random() * 0.12,
        depthWrite: false,
      })
      const sprite = new THREE.Sprite(mat)
      const scale = 0.6 + Math.random() * 0.9
      sprite.scale.set(scale * 1.8, scale, 1)
      sprite.position.set((Math.random() - 0.5) * 3, 0.2 + Math.random() * 0.7, -1 - Math.random())
      scene.add(sprite)
      // Very slow: full width crossing takes several minutes.
      clouds.push({ sprite, speed: 0.00006 + Math.random() * 0.00008 })
    }

    // Light — a glow whose size subtly breathes with bass energy.
    const lightMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: highlight,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const lightSprite = new THREE.Sprite(lightMat)
    lightSprite.position.set(0.5, 0.55, -0.5)
    const lightBaseScale = 0.5
    lightSprite.scale.set(lightBaseScale, lightBaseScale, 1)
    scene.add(lightSprite)

    // Water — a shimmering band at the bottom whose amplitude subtly reacts to treble.
    const waterGeo = new THREE.PlaneGeometry(2, 0.6, 1, 1)
    const waterMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: accent }, uTime: { value: 0 }, uAmp: { value: 0.02 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uTime; uniform float uAmp; varying vec2 vUv;
        void main() {
          float shimmer = sin(vUv.x * 40.0 + uTime * 0.6) * 0.5 + 0.5;
          float alpha = (0.12 + shimmer * uAmp) * (1.0 - vUv.y);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    })
    const water = new THREE.Mesh(waterGeo, waterMat)
    water.position.set(0, -0.7, -0.2)
    scene.add(water)

    let raf: number
    let disposed = false
    let t = 0
    let smoothedBass = 0
    let smoothedTreble = 0
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      t += 0.016

      for (const { sprite, speed } of clouds) {
        sprite.position.x += speed
        if (sprite.position.x > 1.6) sprite.position.x = -1.6
      }

      let bass = 0
      let treble = 0
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData)
        const bassEnd = Math.max(1, Math.floor(freqData.length * 0.15))
        for (let i = 0; i < bassEnd; i++) bass += freqData[i]!
        bass = bass / bassEnd / 255
        const trebleStart = Math.floor(freqData.length * 0.5)
        const trebleLen = freqData.length - trebleStart
        for (let i = trebleStart; i < freqData.length; i++) treble += freqData[i]!
        treble = trebleLen > 0 ? treble / trebleLen / 255 : 0
      }
      // Heavily smoothed so the size change reads as a slow "breathe", not a jitter.
      smoothedBass += (bass - smoothedBass) * 0.05
      smoothedTreble += (treble - smoothedTreble) * 0.08

      const lightScale = lightBaseScale * (1 + smoothedBass * 0.18)
      lightSprite.scale.set(lightScale, lightScale, 1)

      waterMat.uniforms.uTime!.value = t
      waterMat.uniforms.uAmp!.value = 0.02 + smoothedTreble * 0.06
      water.scale.y = 1 + smoothedBass * 0.08

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
      skyGeo.dispose()
      skyMat.dispose()
      glowTexture.dispose()
      clouds.forEach(({ sprite }) => sprite.material.dispose())
      lightMat.dispose()
      waterGeo.dispose()
      waterMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.highlight, colorScheme.muted, analyser])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
