# Tahti UI (`@/components/ui`)

Reusable React components and CSS tokens for `apps/web`.

**Full style guide:** [`docs/style-guide.md`](../../../docs/style-guide.md)

## Quick start

```tsx
import { Button, Panel, Field, Input, Alert, PageShell } from '@/components/ui'

export function Example() {
  return (
    <PageShell size="md">
      <Panel title="Settings">
        <Field label="Display name" htmlFor="name">
          <Input id="name" />
        </Field>
        <Alert variant="info">Changes apply immediately.</Alert>
        <Button variant="primary">Save</Button>
      </Panel>
    </PageShell>
  )
}
```

## Components

| Export | Purpose |
|--------|---------|
| `Button`, `ButtonGroup` | Actions |
| `Input`, `Textarea`, `Select` | Form controls |
| `Field`, `Label` | Label + control layout |
| `Panel` | Dashboard sections |
| `Heading`, `Text` | Typography |
| `Badge` | LIVE pill, tags |
| `Alert` | Inline feedback |
| `Stack`, `Row`, `Divider`, `PageShell`, `Code` | Layout |
| `CopyRow` | Label + monospace value + copy |
| `Link` | Styled anchor |
| `SiteFooter` | Global footer |
| `cn` | Class name helper |
| `tokens` | JS color constants (prefer CSS vars) |
