// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import * as THREE from 'three'

/** Tahti brand dark — gallery canvas background */
export const GALLERY_BG = 0x0a0f1e
export const GALLERY_HEIGHT_PX = 360

export function createGalleryRenderer(host: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  host.appendChild(renderer.domElement)
  return renderer
}

export function resizeGalleryRenderer(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  host: HTMLElement,
) {
  const w = host.clientWidth
  const h = host.clientHeight
  if (w === 0 || h === 0) return
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}

export function loadGalleryTextures(
  urls: string[],
  onEach?: () => void,
): { textures: Promise<THREE.Texture[]>; dispose: () => void } {
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  const loaded: THREE.Texture[] = []
  let cancelled = false

  const promise = Promise.all(
    urls.map(
      (url) =>
        new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(
            url,
            (tex) => {
              if (cancelled) {
                tex.dispose()
                reject(new Error('cancelled'))
                return
              }
              tex.colorSpace = THREE.SRGBColorSpace
              loaded.push(tex)
              onEach?.()
              resolve(tex)
            },
            undefined,
            () => reject(new Error(`Failed to load ${url}`)),
          )
        }),
    ),
  ).catch(() => [] as THREE.Texture[])

  return {
    textures: promise,
    dispose: () => {
      cancelled = true
      for (const t of loaded) t.dispose()
    },
  }
}

export function textureAspect(texture: THREE.Texture): number {
  const img = texture.image as { width: number; height: number }
  return img.width / img.height
}

export function bindPointerUniforms(
  canvas: HTMLCanvasElement,
  uniforms: { uPointer: { value: THREE.Vector2 } },
) {
  const pointer = uniforms.uPointer.value

  function onMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }
  function onLeave() {
    pointer.set(-999, -999)
  }

  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerleave', onLeave)
  return () => {
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerleave', onLeave)
  }
}

export function disposeScene(
  renderer: THREE.WebGLRenderer,
  host: HTMLElement,
  disposables: Array<{ dispose: () => void }>,
) {
  for (const d of disposables) d.dispose()
  renderer.dispose()
  if (renderer.domElement.parentElement === host) {
    host.removeChild(renderer.domElement)
  }
}
