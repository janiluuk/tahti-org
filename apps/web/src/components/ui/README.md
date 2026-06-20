# Tahti UI (`apps/web` re-export)

**Do not add components here.** All UI is implemented in `packages/ui` (`@tahti/ui`).

```tsx
import { Button, Panel, ChannelPageLayout, StudioShell } from '@tahti/ui'
// equivalent:
import { Button, Panel } from '@/components/ui'
```

See `docs/design/README.md`, `docs/AGENT.md` (UI section), and `.cursor/rules/ui-library.mdc`.

**Exceptions (app-only, not in `@tahti/ui`):**

- `bg-canvas.tsx` — Three.js gateway background (depends on `three`)
