// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { loadGalleryTextures, textureAspect, createAudioLevelSampler } from '../gallery/shared'
import { readSettings, type VisualPresetProps } from './types'

// Physics runs at a fixed, low resolution regardless of on-screen size — the
// wave equation only needs to look smooth once upscaled through the composite
// pass's bilinear sampling, and a small grid keeps this cheap on any device.
const SIM_RESOLUTION = 160
const MAX_DROPS = 4

const PASSTHROUGH_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// Damped 2D wave equation over a height/velocity state texture (R=height,
// G=velocity): each texel pulls toward its neighbors' average height
// (propagation) and loses a little energy every step (damping), the same
// technique behind most real-time WebGL water-ripple demos.
const SIM_FRAGMENT = `
  varying vec2 vUv;
  uniform sampler2D uPrevState;
  uniform vec2 uTexel;
  uniform float uViscosity;
  uniform float uDamping;
  uniform int uDropCount;
  uniform vec2 uDropPos[${MAX_DROPS}];
  uniform float uDropStrength[${MAX_DROPS}];
  uniform float uDropRadius;

  void main() {
    vec2 state = texture2D(uPrevState, vUv).rg;
    float height = state.x;
    float velocity = state.y;

    float hN = texture2D(uPrevState, vUv + vec2(0.0, uTexel.y)).x;
    float hS = texture2D(uPrevState, vUv - vec2(0.0, uTexel.y)).x;
    float hE = texture2D(uPrevState, vUv + vec2(uTexel.x, 0.0)).x;
    float hW = texture2D(uPrevState, vUv - vec2(uTexel.x, 0.0)).x;

    float laplacian = (hN + hS + hE + hW) * 0.25 - height;
    velocity += laplacian * uViscosity;
    velocity *= uDamping;
    height += velocity;

    for (int i = 0; i < ${MAX_DROPS}; i++) {
      if (i >= uDropCount) break;
      float d = distance(vUv, uDropPos[i]);
      height += uDropStrength[i] * exp(-(d * d) / (uDropRadius * uDropRadius));
    }

    gl_FragColor = vec4(height, velocity, 0.0, 1.0);
  }
`

// Refracts the artwork (or a color-scheme gradient, when there's no artwork)
// by the height field's gradient, plus a cheap specular highlight from the
// same gradient treated as a surface normal — the "sunlit water" look.
const COMPOSITE_FRAGMENT = `
  varying vec2 vUv;
  uniform sampler2D uState;
  uniform sampler2D uArtwork;
  uniform float uHasArtwork;
  uniform vec2 uTexel;
  uniform float uContainerAspect;
  uniform float uArtAspect;
  uniform float uRefraction;
  uniform vec3 uColorBg;
  uniform vec3 uColorAccent;
  uniform vec3 uColorHighlight;

  vec2 coverUv(vec2 uv, float containerAspect, float texAspect) {
    vec2 scale = vec2(1.0);
    if (containerAspect > texAspect) {
      scale.y = texAspect / containerAspect;
    } else {
      scale.x = containerAspect / texAspect;
    }
    vec2 offset = (1.0 - scale) * 0.5;
    return uv * scale + offset;
  }

  void main() {
    float hL = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).x;
    float hR = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).x;
    float hD = texture2D(uState, vUv - vec2(0.0, uTexel.y)).x;
    float hU = texture2D(uState, vUv + vec2(0.0, uTexel.y)).x;
    vec2 gradient = vec2(hR - hL, hU - hD);

    vec2 baseUv = coverUv(vUv, uContainerAspect, uArtAspect);
    vec2 refractedUv = clamp(baseUv + gradient * uRefraction, 0.001, 0.999);

    vec3 color;
    if (uHasArtwork > 0.5) {
      color = texture2D(uArtwork, refractedUv).rgb;
    } else {
      color = mix(uColorBg, uColorAccent, clamp(vUv.y + gradient.y * 2.0, 0.0, 1.0));
    }

    vec3 normal = normalize(vec3(-gradient.x * 12.0, -gradient.y * 12.0, 1.0));
    vec3 lightDir = normalize(vec3(-0.35, 0.55, 0.75));
    float spec = pow(max(dot(normal, lightDir), 0.0), 40.0);
    color += spec * uColorHighlight * 1.4;

    float crest = clamp((abs(gradient.x) + abs(gradient.y)) * 6.0, 0.0, 1.0);
    color = mix(color, uColorAccent, crest * 0.18);

    gl_FragColor = vec4(color, 1.0);
  }
`

function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex)
  return new THREE.Vector3(c.r, c.g, c.b)
}

interface PendingDrop {
  x: number
  y: number
  strength: number
}

/**
 * Bright water-ripple visualizer — the track's cover art (or a color-scheme
 * gradient when there's none) distorted by a real-time height-field wave
 * simulation: two ping-ponged render targets hold a height/velocity state,
 * updated each frame by a damped wave equation, then refract the artwork by
 * that height field's gradient. Ripples drop on an interval that shortens
 * and strengthens with the audio's momentary loudness, plus an extra
 * accented drop on sudden loudness jumps (a cheap onset detector) — reacts
 * to the music rather than just running on a fixed timer.
 */
export function WaterRipplePreset({
  colorScheme,
  analyser,
  settingsRef,
  artworkUrl,
}: VisualPresetProps) {
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

    const rtOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    }
    const targetA = new THREE.WebGLRenderTarget(SIM_RESOLUTION, SIM_RESOLUTION, rtOptions)
    const targetB = new THREE.WebGLRenderTarget(SIM_RESOLUTION, SIM_RESOLUTION, rtOptions)
    renderer.setRenderTarget(targetA)
    renderer.clear()
    renderer.setRenderTarget(targetB)
    renderer.clear()
    renderer.setRenderTarget(null)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new THREE.PlaneGeometry(2, 2)

    const dropPosUniform = Array.from({ length: MAX_DROPS }, () => new THREE.Vector2())
    const dropStrengthUniform = new Float32Array(MAX_DROPS)

    const simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPrevState: { value: null as THREE.Texture | null },
        uTexel: { value: new THREE.Vector2(1 / SIM_RESOLUTION, 1 / SIM_RESOLUTION) },
        uViscosity: { value: 0.5 },
        uDamping: { value: 0.992 },
        uDropCount: { value: 0 },
        uDropPos: { value: dropPosUniform },
        uDropStrength: { value: dropStrengthUniform },
        uDropRadius: { value: 0.055 },
      },
      vertexShader: PASSTHROUGH_VERTEX,
      fragmentShader: SIM_FRAGMENT,
    })

    const compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: null as THREE.Texture | null },
        uArtwork: { value: null as THREE.Texture | null },
        uHasArtwork: { value: 0 },
        uTexel: { value: new THREE.Vector2(1 / SIM_RESOLUTION, 1 / SIM_RESOLUTION) },
        uContainerAspect: { value: w / h },
        uArtAspect: { value: 1 },
        uRefraction: { value: 0.09 },
        uColorBg: { value: hexToVec3(colorScheme.bg) },
        uColorAccent: { value: hexToVec3(colorScheme.accent) },
        uColorHighlight: { value: hexToVec3(colorScheme.highlight) },
      },
      vertexShader: PASSTHROUGH_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
    })

    const mesh = new THREE.Mesh(geometry, simMaterial)
    scene.add(mesh)

    let disposed = false
    let disposeArtwork = () => {}
    if (artworkUrl) {
      const loaded = loadGalleryTextures([artworkUrl])
      disposeArtwork = loaded.dispose
      void loaded.textures.then(([tex]) => {
        if (disposed || !tex) return
        compositeMaterial.uniforms.uArtwork!.value = tex
        compositeMaterial.uniforms.uArtAspect!.value = textureAspect(tex)
        compositeMaterial.uniforms.uHasArtwork!.value = 1
      })
    }

    let read = targetA
    let write = targetB

    const audioSampler = analyser ? createAudioLevelSampler(analyser) : null
    let smoothedLevel = 0
    let lastAmbientDrop = 0
    let raf = 0

    const pending: PendingDrop[] = []
    function queueDrop(strength: number) {
      if (pending.length >= MAX_DROPS) return
      pending.push({ x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.7, strength })
    }

    function animate(now: number) {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      const { speed, intensity } = readSettings(settingsRef)

      let activityLevel = 0
      if (audioSampler) {
        const level = audioSampler()
        // Sudden jump above the recent smoothed level (a kick/hit) — accent drop.
        if (level - smoothedLevel > 0.22) queueDrop(0.35 + level * 0.5)
        smoothedLevel += (level - smoothedLevel) * 0.15
        activityLevel = smoothedLevel
      }

      const ambientInterval =
        (audioSampler ? 1800 - activityLevel * 1500 : 2200) / Math.max(0.4, speed)
      if (now - lastAmbientDrop > ambientInterval) {
        lastAmbientDrop = now
        queueDrop(0.12 + activityLevel * 0.28)
      }

      // --- simulation pass: propagate waves + inject this frame's drops ---
      mesh.material = simMaterial
      simMaterial.uniforms.uPrevState!.value = read.texture
      simMaterial.uniforms.uViscosity!.value = 0.5 * intensity
      const count = Math.min(pending.length, MAX_DROPS)
      simMaterial.uniforms.uDropCount!.value = count
      for (let i = 0; i < count; i++) {
        dropPosUniform[i]!.set(pending[i]!.x, pending[i]!.y)
        dropStrengthUniform[i] = pending[i]!.strength
      }
      pending.length = 0

      renderer.setRenderTarget(write)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      ;[read, write] = [write, read]

      // --- composite pass: refract the artwork by the new height field ---
      mesh.material = compositeMaterial
      compositeMaterial.uniforms.uState!.value = read.texture
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(animate)

    const ro = new ResizeObserver(() => {
      const nw = mount!.clientWidth || 1
      const nh = mount!.clientHeight || 1
      renderer.setSize(nw, nh, false)
      compositeMaterial.uniforms.uContainerAspect!.value = nw / nh
    })
    ro.observe(mount)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      disposeArtwork()
      geometry.dispose()
      simMaterial.dispose()
      compositeMaterial.dispose()
      targetA.dispose()
      targetB.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorScheme.bg, colorScheme.accent, colorScheme.highlight, analyser, artworkUrl])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
