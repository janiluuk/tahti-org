# Tahti style guide

Design system for the **Next.js app** (`apps/web`). Marketing pages (`website/`, root `index.html`) use the same brand palette on a **dark** theme; the app uses a **light** dashboard theme for readability.

**Component library:** `apps/web/src/components/ui/` — import as `@/components/ui`.

---

## Principles

1. **Use UI components first** — avoid one-off inline `style={{…}}` for buttons, panels, forms, and alerts.
2. **Use CSS tokens** — `--tahti-*` variables from `tokens.css` when custom styling is unavoidable.
3. **Space Grotesk for headings, Inter for body** — loaded in `app/layout.tsx` via `next/font`.
4. **Accessible defaults** — focus rings on inputs, `role="alert"` on alerts, semantic headings.

---

## Brand palette

| Token | Hex | Use |
|-------|-----|-----|
| `--tahti-brand-bg` | `#0a0f1e` | Marketing / dark surfaces |
| `--tahti-brand-amber` | `#f0a500` | Brand accent (marketing) |
| `--tahti-brand-cyan` | `#00bcd4` | Brand accent (marketing) |
| `--tahti-primary` | `#2563eb` | Primary actions in the app |
| `--tahti-success` | `#16a34a` | Success text, live OK states |
| `--tahti-error` | `#dc2626` | Errors, LIVE badge |
| `--tahti-warning` | `#d97706` | Warnings |
| `--tahti-text-muted` | `#6b7280` | Secondary copy |

---

## Typography

| Element | Component | Font |
|---------|-----------|------|
| Page title | `<Heading level={1}>` | Space Grotesk |
| Section title | `<Panel title="…">` or `<Heading level={2}>` | Space Grotesk |
| Subsection | `<Heading level={3}>` | Space Grotesk |
| Body | `<Text>` | Inter |
| Muted helper | `<Text tone="muted" size="sm">` | Inter |
| Monospace / URLs | `<Code>` or `mono` on `<Input>` / `<Textarea>` | System mono |

**Scale:** `--tahti-text-xs` (12px) through `--tahti-text-3xl` (30px).

---

## Layout

| Component | When to use |
|-----------|-------------|
| `<PageShell size="md">` | Dashboard, forms (960px) |
| `<PageShell size="lg">` | Channel page, wide grids (1100px) |
| `<Stack gap={4}>` | Vertical sections inside a panel |
| `<Row between>` | Toolbar (title + action) |
| `<Panel>` | Dashboard card / settings block |

**Spacing scale:** 4px base — `--tahti-space-1` … `--tahti-space-12`. Default panel margin-top: `--tahti-space-8`.

---

## Components

### Button

```tsx
import { Button } from '@/components/ui'

<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost" size="sm">Copy</Button>
<Button variant="danger">Delete</Button>
```

| Variant | Use |
|---------|-----|
| `primary` | Main action (save, pay, submit) |
| `secondary` | Default neutral (rare; prefer ghost) |
| `ghost` | Secondary actions, copy, rotate key |
| `danger` | Destructive |

### Panel

```tsx
<Panel title="Go Live" description="Optional helper text.">
  …
</Panel>

<Panel variant="warning" title="Complete your membership">…</Panel>
```

Variants: `default`, `warning`, `success`, `error`.

### Forms

```tsx
<Field label="Gallery style" htmlFor="mode" hint="Shown on your channel page.">
  <Select id="mode" … />
</Field>

<Field label="Notes">
  <Textarea rows={4} mono />
</Field>
```

### Feedback

```tsx
<Alert variant="error">Something went wrong.</Alert>
<Alert variant="success">Saved.</Alert>
<Badge variant="live">Live</Badge>
```

### Copy credentials (stream settings)

```tsx
<CopyRow label="Server" value={settings.rtmp.server} />
```

---

## Patterns

### Dashboard section

```tsx
<Panel title="Feature name" description="One sentence explaining the feature.">
  <Field label="…">…</Field>
  {error && <Alert variant="error">{error}</Alert>}
  <Button variant="primary">Save</Button>
</Panel>
```

### Page shell

```tsx
<PageShell size="md" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
  <Row between>
    <Heading level={1}>Dashboard</Heading>
    <Button variant="ghost">Log out</Button>
  </Row>
  …
</PageShell>
```

---

## Do / don't

| Do | Don't |
|----|-------|
| `import { Button, Panel } from '@/components/ui'` | Raw `<button style={{ background: '#2563eb' }}>` |
| `var(--tahti-border)` in new CSS | Hard-coded `#eee` in new code |
| `<Alert variant="error">` for errors | Red `<p style={{ color: '#dc2626' }}>` |
| Migrate files when you touch them | Big-bang rewrite of every page at once |

Existing pages still use inline styles — **migrate incrementally** when editing a file.

---

## File map

| Path | Purpose |
|------|---------|
| `components/ui/tokens.css` | CSS custom properties |
| `components/ui/ui.css` | Component class definitions |
| `components/ui/*.tsx` | React wrappers |
| `components/ui/index.ts` | Barrel exports |
| `components/gallery/` | Channel WebGL + static image galleries |
| `components/text-layer/` | Configurable CSS text effects for channels |
| `app/globals.css` | Imports tokens + ui, base body styles |
| `app/layout.tsx` | Fonts + `<SiteFooter />` |

---

## Adding a new component

1. Add BEM-style classes to `ui.css` (prefix `ui-`).
2. Add a thin React wrapper in `components/ui/`.
3. Export from `index.ts`.
4. Document props and usage in this file.
5. Use it in at least one screen so the pattern is proven.

---

## Channel galleries

Creators pick a gallery style in **Dashboard → Channel gallery**. Images are up to 10 public **HTTPS URLs** (your CDN or MinIO); WebGL modes load them as Three.js textures (CORS required).

| Mode | Inspiration ([freefrontend.com/three-js](https://freefrontend.com/three-js/)) |
|------|--------|
| Static image strip | — |
| Twisted Wave (WebGL) | Twisted Wave GLSL Image Gallery |
| Cinematic Zoom Blur (WebGL) | Cinematic Zoom Blur Image Gallery |
| RGB Shift strip (WebGL) | WebGL RGB Shift Image Card |
| Poster scroll wall (WebGL) | Infinite 3D Poster Scroll Wall |
| Shatter carousel (WebGL) | Shattering Image Gallery Transition |

**Code:** `@/components/gallery` — `ChannelGalleryView` switches on `ChannelGalleryMode` from `@tahti/shared`. Shared labels/hints live in `packages/shared/src/dto/channel-gallery.ts`.

---

## Channel text layer

Creators configure a headline in **Dashboard → Channel text layer**. Enter your own text (max 120 characters) and pick alignment. Five CSS effects are inspired by [freefrontend.com/css-text-effects](https://freefrontend.com/css-text-effects/).

| Mode | Inspiration |
|------|--------|
| Animated gradient shimmer | Animated Gradient Text |
| Cosmic neon glow | Cosmic Neon Text Effect |
| 3D layered wave | Interactive 3D Layered Text Wave Effect |
| Shimmer lines | Text Shimmer Lines Effect |
| Ghost echo | Vertical Ghost Text Hover Effect |

**Code:** `@/components/text-layer` — `ChannelTextLayerView` + `text-layer.css`. Shared DTO: `packages/shared/src/dto/channel-text-layer.ts`.

---

## Related docs

- [`docs/competitive-gaps-hearthis.md`](./competitive-gaps-hearthis.md) — per-content visuals (M24)
- Marketing dark theme — root `index.html` CSS variables (`--bg`, `--amber`, …)
