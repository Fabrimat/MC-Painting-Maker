# MC Painting Maker — UI Redesign Spec

## Goal

Polish the existing functional-but-bare UI into a friendly, production-grade interface that non-technical users can navigate without prior Bedrock knowledge. No new features — only presentation, layout, copy, and responsive behavior.

Out of scope: editor canvas internals (Konva drawing), build pipeline, schema, asset generation.

## Visual System

### Palette (Modern Studio)

Light theme. Reuse Bedrock-friendly accent without going "themed."

| Role | Token | Hex | Use |
|---|---|---|---|
| Background | `--bg` | `#ffffff` | Page, editor canvas wrap fill |
| Surface | `--surface` | `#fafbfc` | Sidebar, properties panel, topbar |
| Surface alt | `--surface-2` | `#f4f5f7` | Editor canvas backdrop, hover wells |
| Border | `--border` | `#e5e7eb` | Default dividers |
| Border strong | `--border-strong` | `#d1d5db` | Form fields |
| Text | `--text` | `#1f2937` | Default text |
| Text muted | `--text-muted` | `#6b7280` | Labels, hints |
| Text faint | `--text-faint` | `#94a3b8` | Placeholders, secondary hints |
| Primary | `--primary` | `#3b82f6` | Selection, focus, accents |
| Primary tint | `--primary-tint` | `#eff6ff` | Selected row, info boxes |
| Primary border | `--primary-border` | `#bfdbfe` | Tint outlines |
| Primary deep | `--primary-deep` | `#1e40af` | Text on tint, info copy |
| CTA | `--cta` | `#f97316` | Build button |
| CTA hover | `--cta-hover` | `#ea580c` | Build button border / hover |
| Danger | `--danger` | `#dc2626` | Delete icon hover |
| Danger tint | `--danger-tint` | `#fee2e2` | Delete button hover bg |

No dark mode in this pass (note `color-scheme: light` to override system default).

### Typography

System fonts only (already configured). Sizes via CSS variables:

| Token | Value | Use |
|---|---|---|
| `--fs-xs` | 10px | Labels, hints, small captions |
| `--fs-sm` | 11px | Sidebar items, field values, chips |
| `--fs-base` | 12px | Default body |
| `--fs-md` | 13px | Editor title, brand, drawer headings |
| `--fs-lg` | 15px | Page-level headings |

Weights: 400 default, 600 for labels and field text, 700 for headings and uppercase section labels.

### Spacing, radii, shadows

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 6px |
| `--space-3` | 8px |
| `--space-4` | 10px |
| `--space-5` | 12px |
| `--space-6` | 14px |
| `--space-7` | 16px |
| `--space-8` | 18px |
| `--radius-sm` | 5px |
| `--radius` | 7px |
| `--radius-lg` | 10px |
| `--radius-xl` | 14px |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.06)` |
| `--shadow` | `0 1px 3px rgba(0,0,0,.04)` |
| `--shadow-lg` | `-12px 0 28px rgba(0,0,0,.12)` (drawer) |

Section labels use uppercase 10px with a 6px primary dot to anchor the eye.

## Layout — Desktop (≥ 900px)

Three columns inside a topbar. Pack settings open as a right-side drawer.

```
┌─────────────────────────────────────────────────────────────┐
│ [🖼 Painting Maker]            [Import] [Export] [⚙] [↓ Build] │
├─────────┬───────────────────────────────────┬───────────────┤
│ Paint…  │  Sunset · click to rename         │ ● Canvas size │
│ + Add   │                                   │  W 2.00 / H 3 │
│ ──────  │  ┌─────────────────────────────┐  │ ● Texture     │
│ [▣] Sun │  │       (canvas)              │  │  Resolution…  │
│ [▣] For │  │                             │  │  Scaling…     │
│         │  └─────────────────────────────┘  │ ● Transparency│
│         │                                   │  Cutout/Blend │
└─────────┴───────────────────────────────────┴───────────────┘
```

Columns:
- **Sidebar** — 200px fixed. Painting list. "+ Add images" card sits above the list as both drop zone and file picker. No inline rename. Delete (✕) appears on row hover.
- **Editor** — flex 1. Editor header (clickable name + "click to rename" hint). Canvas wrap fills remaining height with a soft `--surface-2` backdrop so the canvas reads as a distinct work area.
- **Properties** — 240px fixed. Three sections: Canvas size, Texture quality, Transparency. Each section opens with the uppercase label + primary dot.

Topbar:
- Brand: gradient-square icon + "Painting Maker"
- `Import` / `Export` ghost buttons (project JSON)
- `⚙` icon button opens the **Pack settings drawer** — 340px from the right, modal shade behind. Drawer holds Identity (name, description, icon) and Advanced (namespace, creative menu group, version) sections.
- `↓ Build .mcaddon` CTA — disabled when paintings array is empty. Loading state shows spinner + "Building…".

Empty state (no painting selected):
- Editor area shows a centered card: icon + "Start by adding an image" + drop / pick hint. Build button is dimmed.

## Layout — Mobile (< 900px)

Bottom tabs with three views. Topbar stays compact.

```
Tab "Paintings"           Tab "Edit"               Tab "Properties"
┌──────────────────┐      ┌──────────────────┐    ┌──────────────────┐
│ [🖼] [⚙] [Build] │      │ [🖼] [⚙] [Build] │    │ [🖼] [⚙] [Build] │
├──────────────────┤      ├──────────────────┤    ├──────────────────┤
│ Paintings · 2    │      │ Sunset       ⋯   │    │ Editing Sunset   │
│ + Add images     │      │ ┌──────────────┐ │    │ ● Canvas size    │
│ [▣] Sunset    >  │      │ │              │ │    │  W 2.00 / H 3.00 │
│ [▣] Forest    >  │      │ │  (canvas)    │ │    │ ● Transparency   │
│                  │      │ │              │ │    │  Cutout / Blend  │
│                  │      │ └──────────────┘ │    │                  │
├──────────────────┤      ├──────────────────┤    ├──────────────────┤
│ 🖼  ✎  ≡         │      │ 🖼  ✎  ≡         │    │ 🖼  ✎  ≡         │
└──────────────────┘      └──────────────────┘    └──────────────────┘
```

Tabs:
- **Paintings** — list. Tapping a row selects it and switches to Edit tab.
- **Edit** — full-width canvas. Editor header with name and `⋯` menu (rename, delete).
- **Properties** — same sections as desktop, but listed top-to-bottom. Always shows "Editing <name>" header. If no painting selected, shows the empty-state card.

Topbar on mobile: brand + ⚙ + Build (no Import/Export — they move into ⚙ drawer footer).

Build button on mobile: compact "Build" label (no caret icon, no ".mcaddon"). Stays in topbar across tabs so it's always reachable.

Pack settings drawer on mobile: full-screen modal with "‹ Done" back affordance.

### Breakpoint

Single breakpoint at **900px**. Above: desktop 3-column. Below: mobile tabs. Use `@media` (no JS detection) so it follows the viewport live.

The tab bar reuses the same data and routing as the desktop columns — the right "Properties" panel and the "Properties" tab render the same Svelte component.

## Component changes

| File | Change |
|---|---|
| `web/src/app.css` | Replace existing minimal CSS with the design tokens (CSS variables on `:root`). Set `color-scheme: light`. Reset margins. Add `box-sizing: border-box` globally. |
| `web/src/App.svelte` | Replace 3-column grid with new structure: topbar + main area. Main area is `<aside class="sidebar">`, `<main class="editor">`, `<aside class="properties">`. Below 900px, swap to `<TabBar>` + single-pane `<main>` that switches on `activeTab`. Add `<PackDrawer>` rendered conditionally. |
| `web/src/ui/Topbar.svelte` | **New.** Brand, Import/Export (desktop only), ⚙ icon button, Build CTA. Emits `openPackSettings`, `build`. |
| `web/src/ui/Sidebar.svelte` | Rewrite layout: drop card on top, list below. Remove the inline rename `<input>` — keep only thumbnail, name, size, delete-on-hover. Tapping a row selects (and on mobile switches to Edit tab). |
| `web/src/ui/PaintingList.svelte` | **New, extracted from Sidebar.** Just the list of rows, used by both desktop Sidebar and mobile Paintings tab. |
| `web/src/ui/FileDrop.svelte` | Restyle as the "+ Add images" card: dashed border, plus icon in tint square, label + "drag & drop" hint. No new component — this absorbs the AddCard concept. |
| `web/src/ui/EditorHeader.svelte` | **New.** Renders the clickable painting title that becomes an `<input>` on click; commits on blur or Enter. |
| `web/src/ui/PaintingProperties.svelte` | **New.** The right-side properties form. Replaces the `.bar` div inside `PaintingEditor.svelte`. Three sections with their friendly labels and pill toggles. |
| `web/src/editor/PaintingEditor.svelte` | Strip out the `.bar` toolbar (now lives in `PaintingProperties.svelte`). Keep only the canvas host. Title moves to `EditorHeader.svelte`. |
| `web/src/ui/PackDrawer.svelte` | **New.** Pack settings as a slide-in drawer (desktop) / full-screen sheet (mobile). Two sections: Identity (name, description, icon), Advanced (namespace, creative group, version). Footer with Import/Export on mobile, Close button. Replaces the existing `PackSettings.svelte`. |
| `web/src/ui/PackSettings.svelte` | Delete after `PackDrawer.svelte` lands. |
| `web/src/ui/TabBar.svelte` | **New, mobile only.** Three tabs: Paintings 🖼, Edit ✎, Properties ≡. Hidden via `@media (min-width: 900px) { display: none }`. |
| `web/src/ui/EmptyState.svelte` | **New.** Centered card used in editor area (desktop) and Edit tab (mobile) when no painting selected. |
| `web/src/stores/ui.ts` | **New.** Tiny store for mobile-only state: `activeTab: 'paintings' \| 'edit' \| 'properties'`, `packDrawerOpen: boolean`. Drawer state is global so both desktop ⚙ button and mobile ⚙ button toggle the same flag. |

## Friendly label mapping

Visible copy changes only — the underlying schema values stay the same.

| Schema value | Old label | New label | Hint |
|---|---|---|---|
| `resampling: 'smooth'` | "smooth" | **Smooth** | (no hint, paired with Pixel art) |
| `resampling: 'pixelated'` | "pixelated" | **Pixel art** | — |
| `material: 'alphatest'` | "alphatest" | **Cutout** | "Cutout = sharp edges (best for pixel art)." |
| `material: 'alphablend'` | "alphablend" | **Blended** | "Blended = soft edges, smooth transparency." |
| `textureDensity: 'auto'` | "auto (4×)" | **Auto · 4×** | (same idea, formatted) |
| Canvas W / H | "W" / "H" | **Width / Height** | Suffix "blocks" inside the field |
| Texture px info | "Texture: 128×192 px" | inline as a field suffix next to Resolution |

Pill toggles replace the `<select>` elements for Scaling and Transparency — only two values each, no need for a dropdown.

## States to design

- **Idle Build button** — orange `--cta`, shadow.
- **Disabled Build button** — same shape, opacity `.5`, no shadow, cursor `not-allowed`. Used when `paintings.length === 0`.
- **Building** — replace label with spinner + "Building…". Button stays orange, not clickable.
- **Build error** — toast at bottom-right, red border, auto-dismiss after 6s. Replaces the current `<p class="err">` near the button.
- **Drawer open** — `⚙` icon switches to tint background (`--primary-tint` bg, `--primary-border` border, `--primary-deep` color) so the user sees which surface is active.
- **Sidebar row hover** — `--surface` background, delete (✕) fades in.
- **Sidebar row selected** — `--primary-tint` bg, 1px `--primary-border` outline.
- **Field focus** — 1px `--primary` border, 3px `--primary-tint` ring.

## Interaction & a11y notes

- All controls keyboard-reachable. Tab order: topbar buttons → sidebar items → editor title → properties fields.
- Buttons have explicit `type="button"` to avoid form-submit hijinks.
- Drawer:
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the drawer title.
  - Escape closes; focus traps inside while open; restored to ⚙ button on close.
- Empty-state CTA is the same FileDrop card (consistent affordance, not a separate button).
- Pill toggles are `<button>` elements inside a labelled group (`role="radiogroup"`, each button `role="radio"` with `aria-checked`).
- Tabs (mobile): `role="tablist"`, each tab `role="tab"` with `aria-selected`. Panels have `role="tabpanel"`.
- Color contrast: all text/background pairs meet WCAG AA at the chosen sizes.

## Testing

This is a visual / structural change, not a behavior change. Existing tests for build / lang / geometry stay untouched.

Add lightweight component-level tests with `@testing-library/svelte`:

- `PaintingProperties.test.ts` — renders three sections, pill toggles emit the right `update` events with `alphatest` / `alphablend` even though the label says "Cutout / Blended".
- `Topbar.test.ts` — Build button is disabled when `paintings.length === 0`; ⚙ click emits `openPackSettings`.
- `Sidebar.test.ts` — clicking a row sets `selectedId`; no inline rename `<input>` is rendered.
- `EditorHeader.test.ts` — click on title enters edit mode; Enter / blur commits; Escape reverts.
- `PackDrawer.test.ts` — Escape closes; focus returns to trigger.

No visual regression tests (Percy/Chromatic etc.) in this pass — the screenshots in this spec are the reference.

## Migration / risk

- Existing project JSONs keep working — no schema change.
- `PackSettings.svelte` deletion is paired with `PackDrawer.svelte` creation; one PR / one branch.
- Editor toolbar moves out of `PaintingEditor.svelte` but the underlying `project` store updates are identical, so canvas behavior (snap, rasterize) is unaffected.
- Mobile breakpoint at 900px chosen because the canvas needs ~400px width to be usable and the right panel adds 240px + sidebar 200px + chrome — under 900px the cramped 3-column collapses badly.

## Open / deferred

- No dark mode in this pass. Token names are colour-role-based, so a dark theme can be added later by swapping the `:root` block.
- No animations beyond drawer slide + tab transitions (`transform`/`opacity`, 150–200ms). No spring physics, no scroll-triggered effects.
- Build progress is binary (idle / building) — no percentage. Adding a percentage requires plumbing through the build pipeline, out of scope here.
