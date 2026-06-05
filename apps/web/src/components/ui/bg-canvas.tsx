// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function BgCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)
    camera.position.z = 400

    const palette: [number, number, number][] = [
      [0.94, 0.65, 0.0],
      [0.0, 0.74, 0.83],
      [0.49, 0.3, 1.0],
      [0.0, 0.9, 0.46],
      [1.0, 0.42, 0.42],
    ]

    // Gradient orbs
    const gradientColors = [
      {
        color: new THREE.Color(0.94, 0.65, 0.0),
        pos: [-200, 100, -200] as [number, number, number],
        scale: 300,
      },
      {
        color: new THREE.Color(0.0, 0.74, 0.83),
        pos: [200, -80, -250] as [number, number, number],
        scale: 350,
      },
      {
        color: new THREE.Color(0.49, 0.3, 1.0),
        pos: [0, 150, -300] as [number, number, number],
        scale: 280,
      },
      {
        color: new THREE.Color(0.0, 0.9, 0.46),
        pos: [-150, -120, -180] as [number, number, number],
        scale: 260,
      },
      {
        color: new THREE.Color(1.0, 0.42, 0.42),
        pos: [180, 120, -220] as [number, number, number],
        scale: 240,
      },
    ]
    const gradientMeshes = gradientColors.map((cfg) => {
      const geo = new THREE.SphereGeometry(1, 32, 32)
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(...cfg.pos)
      mesh.scale.setScalar(cfg.scale)
      scene.add(mesh)
      return {
        mesh,
        basePos: cfg.pos,
        baseScale: cfg.scale,
        speed: 0.3 + Math.random() * 0.4,
        radius: 40 + Math.random() * 60,
        phase: Math.random() * Math.PI * 2,
      }
    })

    // Floating rings
    const ringObjs: {
      mesh: THREE.Mesh
      rotSpeed: [number, number, number]
      drift: number
      phase: number
    }[] = []
    const ringPalette = [
      [0.94, 0.65, 0.0],
      [0.0, 0.74, 0.83],
      [0.49, 0.3, 1.0],
      [0.0, 0.9, 0.46],
    ]
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.TorusGeometry(30 + Math.random() * 50, 1.5, 8, 64)
      const c = ringPalette[i % ringPalette.length]
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(c[0], c[1], c[2]),
        transparent: true,
        opacity: 0.25 + Math.random() * 0.15,
        wireframe: true,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        (Math.random() - 0.5) * 700,
        (Math.random() - 0.5) * 400,
        -100 - Math.random() * 200
      )
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      scene.add(mesh)
      ringObjs.push({
        mesh,
        rotSpeed: [
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.1,
        ],
        drift: (Math.random() - 0.5) * 0.15,
        phase: Math.random() * Math.PI * 2,
      })
    }

    // Shooting stars
    const STAR_COUNT = 40
    const starPos = new Float32Array(STAR_COUNT * 3)
    const starCol = new Float32Array(STAR_COUNT * 3)
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
    const starMat = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    })
    scene.add(new THREE.Points(starGeo, starMat))
    const starData: {
      active: boolean
      life: number
      maxLife: number
      vx: number
      vy: number
    }[] = []
    for (let i = 0; i < STAR_COUNT; i++) {
      starData.push({ active: false, life: 0, maxLife: 0, vx: 0, vy: 0 })
      starPos[i * 3 + 1] = -9999
    }
    let lastStarTime = 0

    // Grid lines
    const gridLines: { line: THREE.Line }[] = []
    const gridSpacing = 80
    const gridExtent = 600
    for (let x = -gridExtent; x <= gridExtent; x += gridSpacing) {
      const pts = [
        new THREE.Vector3(x, -gridExtent, -300),
        new THREE.Vector3(x, gridExtent, -300),
      ]
      const g = new THREE.BufferGeometry().setFromPoints(pts)
      const m = new THREE.LineBasicMaterial({
        color: new THREE.Color(0.0, 0.74, 0.83),
        transparent: true,
        opacity: 0.07,
      })
      const line = new THREE.Line(g, m)
      scene.add(line)
      gridLines.push({ line })
    }
    for (let y = -gridExtent; y <= gridExtent; y += gridSpacing) {
      const pts = [
        new THREE.Vector3(-gridExtent, y, -300),
        new THREE.Vector3(gridExtent, y, -300),
      ]
      const g = new THREE.BufferGeometry().setFromPoints(pts)
      const m = new THREE.LineBasicMaterial({
        color: new THREE.Color(0.49, 0.3, 1.0),
        transparent: true,
        opacity: 0.07,
      })
      const line = new THREE.Line(g, m)
      scene.add(line)
      gridLines.push({ line })
    }

    // Floating diamonds
    const diamondObjs: {
      mesh: THREE.Mesh
      rotSpeed: number
      drift: number
      phase: number
      bobAmp: number
    }[] = []
    for (let i = 0; i < 15; i++) {
      const geo = new THREE.OctahedronGeometry(4 + Math.random() * 8, 0)
      const c = palette[Math.floor(Math.random() * palette.length)]
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(c[0], c[1], c[2]),
        transparent: true,
        opacity: 0.22 + Math.random() * 0.2,
        wireframe: true,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        (Math.random() - 0.5) * 800,
        (Math.random() - 0.5) * 500,
        -50 - Math.random() * 150
      )
      scene.add(mesh)
      diamondObjs.push({
        mesh,
        rotSpeed: 0.5 + Math.random() * 1.5,
        drift: (Math.random() - 0.5) * 0.2,
        phase: Math.random() * Math.PI * 2,
        bobAmp: 15 + Math.random() * 25,
      })
    }

    // Background particles
    const N = 1800
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const vels = new Float32Array(N * 2)
    const phases = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 900
      pos[i * 3 + 1] = (Math.random() - 0.5) * 500
      pos[i * 3 + 2] = (Math.random() - 0.5) * 300 - 80
      vels[i * 2] = (Math.random() - 0.5) * 0.08
      vels[i * 2 + 1] = (Math.random() - 0.5) * 0.04
      phases[i] = Math.random() * Math.PI * 2
      const c = palette[Math.floor(Math.random() * palette.length)]
      const bright = 0.15 + Math.random() * 0.35
      col[i * 3] = c[0] * bright
      col[i * 3 + 1] = c[1] * bright
      col[i * 3 + 2] = c[2] * bright
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    scene.add(
      new THREE.Points(
        pGeo,
        new THREE.PointsMaterial({
          size: 2,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          sizeAttenuation: true,
        })
      )
    )

    // Waveform layers
    const WAVES = 3
    const WN = 400
    const waveColors: [number, number, number, number][] = [
      [0.0, 0.74, 0.83, 0.8],
      [0.94, 0.65, 0.0, 0.5],
      [0.49, 0.3, 1.0, 0.4],
    ]
    const waveFreqs = [0.018, 0.012, 0.025]
    const waveSpeeds = [2.0, 1.3, 2.8]
    const waveAmps = [28, 18, 14]
    const waveZ = [-40, -60, -80]
    const waveObjs: {
      geo: THREE.BufferGeometry
      freq: number
      speed: number
      amp: number
    }[] = []
    for (let w = 0; w < WAVES; w++) {
      const wPos = new Float32Array(WN * 3)
      const wCol = new Float32Array(WN * 3)
      const wc = waveColors[w]
      for (let i = 0; i < WN; i++) {
        const t = i / (WN - 1)
        wPos[i * 3] = (t - 0.5) * 900
        wPos[i * 3 + 1] = 0
        wPos[i * 3 + 2] = waveZ[w]
        wCol[i * 3] = wc[0] * wc[3]
        wCol[i * 3 + 1] = wc[1] * wc[3]
        wCol[i * 3 + 2] = wc[2] * wc[3]
      }
      const wg = new THREE.BufferGeometry()
      wg.setAttribute('position', new THREE.BufferAttribute(wPos, 3))
      wg.setAttribute('color', new THREE.BufferAttribute(wCol, 3))
      scene.add(
        new THREE.Points(
          wg,
          new THREE.PointsMaterial({
            size: 4,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
          })
        )
      )
      waveObjs.push({
        geo: wg,
        freq: waveFreqs[w],
        speed: waveSpeeds[w],
        amp: waveAmps[w],
      })
    }

    // Bass-pulse spheres
    const pulseSphere = new THREE.Mesh(
      new THREE.SphereGeometry(55, 24, 24),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.94, 0.65, 0.0),
        transparent: true,
        opacity: 0.0,
        wireframe: true,
      })
    )
    pulseSphere.position.z = -30
    scene.add(pulseSphere)
    const pulseSphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(80, 20, 20),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.0, 0.74, 0.83),
        transparent: true,
        opacity: 0.0,
        wireframe: true,
      })
    )
    pulseSphere2.position.z = -40
    scene.add(pulseSphere2)

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    let frameId: number
    function animate() {
      frameId = requestAnimationFrame(animate)
      const t = Date.now() * 0.001

      // Gradient orbs
      gradientMeshes.forEach((g, i) => {
        const { mesh, basePos, speed, radius, phase } = g
        mesh.position.x = basePos[0] + Math.sin(t * speed + phase) * radius
        mesh.position.y = basePos[1] + Math.cos(t * speed * 0.7 + phase) * radius * 0.6
        mesh.position.z = basePos[2] + Math.sin(t * speed * 0.5 + phase * 1.3) * radius * 0.4
        const s = g.baseScale + Math.sin(t * speed * 0.8 + phase) * 30
        mesh.scale.setScalar(s)
        mesh.material.opacity = 0.14 + Math.sin(t * speed * 0.6 + phase * 0.5) * 0.06
        void i
      })

      // Rings
      ringObjs.forEach((r) => {
        const { mesh, rotSpeed, drift, phase } = r
        mesh.rotation.x += rotSpeed[0] * 0.01
        mesh.rotation.y += rotSpeed[1] * 0.01
        mesh.rotation.z += rotSpeed[2] * 0.01
        mesh.position.y += Math.sin(t * 0.5 + phase) * drift * 0.1
        mesh.position.x += Math.cos(t * 0.3 + phase) * drift * 0.05
        const rMat = mesh.material as THREE.MeshBasicMaterial
        rMat.opacity = Math.min(0.55, (rMat.opacity || 0.28) * 0.9 + 0.28 * 0.1)
      })

      // Shooting stars
      if (t - lastStarTime > 2.5 + Math.random() * 3) {
        lastStarTime = t
        for (let i = 0; i < STAR_COUNT; i++) {
          if (!starData[i].active) {
            starData[i].active = true
            starData[i].life = 0
            starData[i].maxLife = 0.8 + Math.random() * 1.2
            starPos[i * 3] = (Math.random() - 0.5) * 800
            starPos[i * 3 + 1] = 250 + Math.random() * 100
            starPos[i * 3 + 2] = -50 - Math.random() * 150
            starData[i].vx = (Math.random() - 0.5) * 8
            starData[i].vy = -(6 + Math.random() * 8)
            const c = palette[Math.floor(Math.random() * palette.length)]
            starCol[i * 3] = c[0]
            starCol[i * 3 + 1] = c[1]
            starCol[i * 3 + 2] = c[2]
            break
          }
        }
      }
      for (let i = 0; i < STAR_COUNT; i++) {
        if (starData[i].active) {
          starData[i].life += 0.016
          starPos[i * 3] += starData[i].vx
          starPos[i * 3 + 1] += starData[i].vy
          starCol[i * 3] *= 0.98
          starCol[i * 3 + 1] *= 0.98
          starCol[i * 3 + 2] *= 0.98
          if (starData[i].life / starData[i].maxLife >= 1) {
            starData[i].active = false
            starPos[i * 3 + 1] = -9999
          }
        }
      }
      starGeo.attributes.position.needsUpdate = true
      starGeo.attributes.color.needsUpdate = true

      // Grid
      gridLines.forEach((g, i) => {
        const pulse = 0.05 + Math.sin(t * 0.8 + i * 0.15) * 0.04
        ;(g.line.material as THREE.LineBasicMaterial).opacity = Math.max(0.005, pulse)
      })

      // Diamonds
      diamondObjs.forEach((d) => {
        const { mesh, rotSpeed, drift, phase } = d
        mesh.rotation.x += rotSpeed * 0.005
        mesh.rotation.y += rotSpeed * 0.008
        mesh.position.y += Math.sin(t * 0.4 + phase) * drift * 0.05
        mesh.position.x += Math.cos(t * 0.3 + phase) * drift * 0.03
        const s = 1 + Math.sin(t * rotSpeed + phase) * 0.3
        mesh.scale.setScalar(s)
        const dMat = mesh.material as THREE.MeshBasicMaterial
        dMat.opacity = Math.min(0.45, dMat.opacity * 0.92 + 0.22 * 0.08)
      })

      // Drift particles
      for (let i = 0; i < N; i++) {
        pos[i * 3] += vels[i * 2]
        pos[i * 3 + 1] += vels[i * 2 + 1] + Math.sin(t * 0.3 + phases[i]) * 0.03
        if (pos[i * 3] > 450) pos[i * 3] = -450
        if (pos[i * 3] < -450) pos[i * 3] = 450
        if (pos[i * 3 + 1] > 250) pos[i * 3 + 1] = -250
        if (pos[i * 3 + 1] < -250) pos[i * 3 + 1] = 250
      }
      pGeo.attributes.position.needsUpdate = true

      // Waves
      waveObjs.forEach(({ geo: wg, freq, speed, amp }) => {
        const wPos = wg.attributes.position.array as Float32Array
        for (let i = 0; i < WN; i++) {
          const x = wPos[i * 3]
          wPos[i * 3 + 1] =
            Math.sin(x * freq + t * speed) * amp * 0.6 +
            Math.sin(x * freq * 2.3 + t * speed * 1.4) * amp * 0.25 +
            Math.sin(x * freq * 0.4 + t * speed * 0.7) * amp * 0.4
        }
        wg.attributes.position.needsUpdate = true
      })

      // Pulse spheres (idle oscillation)
      const ps = 1 + Math.sin(t * 1.2) * 0.05
      pulseSphere.scale.setScalar(ps)
      pulseSphere.material.opacity = 0.03 + Math.sin(t * 1.2) * 0.02
      pulseSphere.rotation.x += 0.006
      pulseSphere.rotation.y += 0.004
      const ps2 = 1 + Math.sin(t * 0.9 + 1) * 0.04
      pulseSphere2.scale.setScalar(ps2)
      pulseSphere2.material.opacity = 0.02 + Math.sin(t * 0.9) * 0.015
      pulseSphere2.rotation.x -= 0.004
      pulseSphere2.rotation.y += 0.007

      camera.position.x = Math.sin(t * 0.15) * 15
      camera.rotation.z = Math.sin(t * 0.1) * 0.005
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        background: '#0a0f1e',
        display: 'block',
      }}
    />
  )
}
