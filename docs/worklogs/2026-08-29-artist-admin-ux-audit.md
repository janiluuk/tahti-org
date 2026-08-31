# Artist and admin UX audit (2026-08-29)

## Scope

Static UX audit of the authenticated artist studio (`/dashboard/**`) and board
admin (`/admin/**`) surfaces. Checked navigation structure, responsive behavior,
status language, modal interaction patterns, upload controls, error feedback,
and route/link consistency. The initial entry was an audit only; implementation
follow-ups are recorded below.

## Findings

### UX-01 — Artist navigation has two competing information architectures

**Priority:** High  
**Surface:** Desktop and mobile artist navigation  
**Evidence:** `packages/ui/src/brand/dashboard-nav.ts`,
`packages/ui/src/brand/StudioSidebar.tsx`, and
`packages/ui/src/brand/StudioMobileNav.tsx`.

Desktop uses four primary destinations (`Studio`, `Library`, `Perform`,
`Manage`) with contextual submenus. The desktop sidebar's underlying item list
instead uses labels such as `Channel`, `Discography`, `Broadcast`, and `Design`.
Mobile has a separate hard-coded primary list containing `Channel`, `Stats`,
`Discography`, `Upload`, `Collections`, `Revenue`, and `Settings`. As a result,
the same destination changes name, grouping, prominence, and location depending
on viewport. `Collections` is especially inconsistent: the current desktop
model says it lives under Discography, while mobile exposes a separate primary
destination.

**Recommended fix:** derive desktop and mobile navigation from one canonical
destination/group model, with only the number of visible items changing at the
mobile breakpoint.

### UX-02 — Artist and admin mobile “More” sheets are not fully keyboard-accessible

**Priority:** High  
**Surface:** Mobile navigation overflow menus  
**Evidence:** `packages/ui/src/brand/StudioMobileNav.tsx` and
`apps/web/src/app/admin/admin-mobile-nav.tsx`.

Both sheets use `role="dialog"` and `aria-modal="true"`, but neither handles
Escape, moves focus into the sheet, traps focus while open, or restores focus to
the More button on close. The dialog can therefore leave keyboard and screen
reader users behind the overlay or with focus on an obscured control.

**Recommended fix:** use a shared mobile navigation sheet with Escape handling,
focus return, focus containment, and a labelled close affordance.

### UX-03 — Admin governance destination is ambiguous

**Priority:** Medium  
**Surface:** Admin top header versus admin sidebar  
**Evidence:** `packages/ui/src/brand/AdminShellHeader.tsx:88` links
`Governance` to `/governance`, while `apps/web/src/app/admin/admin-nav.tsx`
links the admin Governance section to `/admin/governance`.

An admin user sees two equally prominent Governance destinations with the same
label but different contexts. The header link opens the member/public governance
portal; the sidebar opens admin governance tools. This makes it unclear whether
the link is a shortcut, a context switch, or an accidental route mismatch.

**Recommended fix:** label the header link explicitly (`Governance portal`) or
point it to `/admin/governance`; retain the public portal as a clearly secondary
link where needed.

### UX-04 — Mobile admin navigation loses the desktop grouping model

**Priority:** Medium  
**Surface:** Admin responsive navigation  
**Evidence:** `apps/web/src/app/admin/admin-nav.tsx` defines Overview,
Community, Content, and Manage groups, while
`apps/web/src/app/admin/admin-mobile-nav.tsx` flattens `ADMIN_NAV` into a
primary-four list plus an ungrouped More grid.

The mobile More sheet is ordered by the legacy flat list rather than the active
admin group. An admin moving from desktop to mobile must relearn where tools
live, and related operations are separated visually.

**Recommended fix:** preserve the four group headings in the More sheet, or use
the same grouped accordion/sheet structure at every breakpoint.

### UX-05 — Upload controls still bypass the standard uploader pattern

**Priority:** Medium  
**Surface:** Artist and admin file/image workflows  
**Evidence:** raw file inputs remain in
`apps/web/src/app/dashboard/channel-identity-panel.tsx`,
`apps/web/src/app/dashboard/settings/presskit/_press-kit-builder.tsx`,
`apps/web/src/app/dashboard/upload-form.tsx`,
`apps/web/src/app/dashboard/stash/stash-client.tsx`,
`apps/web/src/app/admin/announcements/_admin-announcements-panel.tsx`, and
`apps/web/src/app/admin/disco-widgets/_admin-disco-widgets-panel.tsx`.

Some surfaces have bespoke drop zones, some expose browser-native file inputs,
and image/avatar/logo controls use different preview, validation, and busy
states. This conflicts with the requested standard uploader behavior and makes
upload affordances and failure recovery inconsistent.

**Recommended fix:** standardize on one uploader primitive with drag/drop,
click-to-select, filename/type/size feedback, preview where applicable,
keyboard activation, cancel/retry, and inline errors. Keep specialized accept
types as configuration rather than separate interaction patterns.

### UX-06 — Error feedback is still inconsistent and disruptive

**Priority:** Medium  
**Surface:** Artist and admin actions  
**Evidence:** browser `alert()` is used by
`apps/web/src/app/dashboard/_header-go-live-action.tsx`,
`apps/web/src/app/dashboard/_stream-manager-panel.tsx`,
`apps/web/src/app/dashboard/stash/stash-client.tsx`, and
`apps/web/src/app/admin/files/_admin-files-browser.tsx`, among others.

The same class of action can produce an inline status, a toast-like panel, or a
blocking browser dialog depending on the page. Alerts interrupt the workflow,
are difficult to associate with the failed control, and do not provide a
consistent retry path.

**Recommended fix:** introduce a shared action-feedback component/toast with
`aria-live`, persistent inline errors for forms, and explicit retry/dismiss
actions. Reserve confirmation dialogs for destructive actions.

### UX-07 — Navigation and action language is not consistently task-oriented

**Priority:** Low  
**Surface:** Artist/admin labels  
**Evidence:** artist labels vary between `Library`/`Discography`,
`Perform`/`Broadcast`, and `Manage`/`Design`; admin uses `Selects`,
`Disco-widgets`, `Reports`, and `Features` while the page titles use
`Tahti Selects`, `Disco-widgets`, `Content reports`, and `Feature requests`.

The labels are individually understandable but do not consistently describe the
same concept at navigation and page level. Hyphenation and capitalization also
vary (`Disco-widgets` versus the more readable `Disco widgets`).

**Recommended fix:** establish a label glossary and use the page title as the
navigation label unless a shorter label is deliberately documented.

## Checks completed

- Enumerated artist and admin routes and compared navigation references against
  the route tree; no immediately missing `/dashboard/**` or `/admin/**` route
  references were found in the primary nav definitions.
- Searched for raw file inputs, native alerts, modal/dialog implementations, and
  duplicate navigation definitions.
- Ran `git diff --check`.
- Existing app validation remains clean: TypeScript and lint pass; lint retains
  the pre-existing visualizer `settingsRef` dependency warnings.

## Suggested implementation order

1. Fix shared mobile dialog accessibility (UX-02).
2. Consolidate artist navigation and remove the competing mobile definitions
   (UX-01).
3. Align admin grouping and clarify governance destinations (UX-03/UX-04).
4. Replace uploader and error-feedback variants with shared primitives
   (UX-05/UX-06).
5. Apply the label glossary (UX-07).

## Implementation follow-up (2026-08-31)

### UX-02 — completed

Added the shared `MobileNavSheet` component to `@tahti/ui` and used it for the
artist and admin mobile navigation. The sheet now has a labelled close button,
focus entry, Escape handling, Tab/Shift+Tab containment, backdrop dismissal, and
focus restoration to the More trigger. Regression coverage is in
`packages/ui/src/brand/MobileNavSheet.test.tsx`.

### UX-01 — completed

The artist mobile bottom navigation now derives its visible destinations and
icons from `DASHBOARD_PRIMARY_NAV`, the same canonical model used by the
desktop sidebar. Legacy mobile-only labels and destinations (including the
separate Collections entry) were removed; secondary routes continue to appear
through the shared More sheet.

### UX-03 — completed

The admin top-bar link is now labelled `Governance portal`, distinguishing the
public/member governance portal from the `/admin/governance` administration
tools.

### UX-04 — completed

Admin mobile navigation now uses the same Overview, Community, Content, and
Manage group roots as the desktop sidebar. The More sheet preserves those group
headings while listing each group's secondary tools.

### UX-05 — in progress

The existing shared `FileDropzone` primitive now powers the main artist audio
upload, artist Stash upload, admin system-announcement upload, admin widget
script upload, the upload entry surface, and the press-kit photo uploader,
including keyboard activation, drag/drop, selected filename feedback, and
disabled states. Channel identity image, album-folder, and multitrack upload
surfaces remain specialized.

### UX-06 — completed

The artist go-live, end-broadcast, Stash, stream manager, broadcast wizard, and
admin file-browser actions now render failures through the shared `Alert`
component instead of blocking browser alerts. The audited dashboard/admin
alert calls are now removed; remaining native confirmations are limited to
destructive or disconnect actions where confirmation is appropriate.

### UX-07 — completed

Admin navigation now uses `Tahti Selects` and `Disco widgets`, matching the
corresponding page titles and removing the inconsistent hyphenation.

### Channel designer follow-up — completed

The full-page channel designer now includes editable Links and Text overlay
sections. Both update the shared live preview immediately and are persisted by
the main `Publish changes` action; the standalone text-layer page keeps its own
save action. The preview and public channel header now place the artist
identity, genres, and links inside the same banner treatment.
