# Feature Implementation Plan

**Overall Progress:** `Steps 1-33 DONE | Fixes F1-F14 DONE | FM-1 to FM-44 DONE | P1-P12 DONE | 49/49 tests passing | Build OK | Price Display Feature complete`

## TLDR
Build a client-side React app that lets Digihaat employees search products from a JSON catalogue, customize banner elements (background, CTA, offer badge), preview a 712×322px banner in real-time, and export it as PNG/JPG/WEBP. Dark theme modern dashboard UI. No backend — catalogue is a static JSON file.

## Critical Decisions
- **Client-side only** — no backend; catalogue loaded as static JSON asset
- **Single JSON format** — each entry contains both `item_details` (product) and `provider_details` (brand), both stringified
- **html-to-image** for banner rendering — lightweight, client-side, supports PNG/JPG/WEBP natively
- **Simple substring search** — split query into words, case-insensitive `.includes()` on product name; no external library needed
- **Dark theme** — modern dashboard UI; Antigravity prompts provided for UI component generation
- **Related items grouped** under parent products in search results (using `parent.id` from tags)
- **Deduplication** by item ID — catalogue may contain duplicate entries
- **Brand logo override** — UI allows manual logo replacement per banner
- **Backgrounds stored in `/public/backgrounds/`** — user provides 3 images

## Catalogue Data Model
Each JSON entry:
```
{
  "item_details": "<stringified JSON>",     // Product info
  "provider_details": "<stringified JSON>"  // Brand/provider info
}
```

**Item details** (parsed):
- `descriptor.name` → product name
- `descriptor.images[0]` → product image URL
- `descriptor.symbol` → product image URL (fallback)
- `price.value` → current price (not shown on banner, but available)
- `id` → unique item ID (used for deduplication)
- `related` → true = customization item, false = standalone product
- `tags[code=parent].list[code=id].value` → parent product ID (for grouping)
- `tags[code=veg_nonveg]` → veg/non-veg indicator

**Provider details** (parsed):
- `descriptor.name` → brand name (e.g., "HRX by EatFit")
- `descriptor.symbol` → brand logo URL
- `descriptor.images[]` → store images
- `descriptor.long_desc` → company name (e.g., "CUREFOODS INDIA PRIVATE LIMITED")
- `id` → provider ID

## Project Structure
```
DigihaatCatalogueToBanner/
├── public/
│   └── backgrounds/                # 3 predefined background images (user-provided)
├── catalogue/
│   └── *.json                      # Product catalogue (item_details + provider_details)
├── src/
│   ├── main.tsx                    # App entry point
│   ├── App.tsx                     # Root component, layout shell
│   ├── types/
│   │   └── index.ts                # All TypeScript interfaces
│   ├── constants/
│   │   └── bannerTemplate.ts       # Fixed 712×322 layout: positions, fonts, sizes, colors
│   ├── services/
│   │   ├── catalogueParser.ts      # Parse stringified JSON, normalize, deduplicate, group
│   │   ├── searchService.ts        # Multi-word substring search logic
│   │   └── exportService.ts        # html-to-image rendering + download
│   ├── hooks/
│   │   ├── useCatalogue.ts         # Load, parse, and expose catalogue data
│   │   ├── useBannerState.ts       # All banner config state (product, background, CTA, etc.)
│   │   └── useLogs.ts              # Error/warning log state
│   ├── components/
│   │   ├── Layout/                 # Dashboard shell (sidebar + main area)
│   │   ├── ProductSearch/          # Search input + grouped product results list
│   │   ├── BannerPreview/          # Live 712×322 banner preview (this IS the render target)
│   │   ├── BannerControls/         # Background picker, CTA editor, badge editor, T&C toggle, logo override
│   │   ├── BackgroundGallery/      # Visual popup/modal for background selection
│   │   ├── ExportPanel/            # Format selector + download button
│   │   └── LogsPanel/              # Scrollable log messages area
│   └── utils/
│       └── imageHelpers.ts         # Image loading, fallback handling
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── CLAUDE.md
```

## Banner Layout Reference (712×322px)
```
┌─────────────────────────────────────────────────────────────────┐
│  [Brand Logo]                                 ┌──────────────┐  │
│  Brand Tagline                                │ Offer Badge  │  │
│                                               └──────────────┘  │
│  Product Name                                                   │
│  (multi-line wrap)                    [Product Image]           │
│                                       (right-aligned)           │
│  ┌────────────┐                                                 │
│  │  CTA BTN   │                                                 │
│  └────────────┘                                                 │
│  *T&C Apply (optional)                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Tasks

- [x] 🟩 **Step 1: Project Scaffolding** ✅ DONE
  - [x] 🟩 Initialize React + Vite + TypeScript project
  - [x] 🟩 Install dependencies: `html-to-image`, `tailwindcss`
  - [x] 🟩 Configure Tailwind with dark theme defaults
  - [x] 🟩 Create directory structure (`src/types`, `src/services`, `src/hooks`, `src/components`, `src/constants`, `src/utils`)
  - [x] 🟩 Set up `/public/backgrounds/` directory (placeholder until user provides images)

- [x] 🟩 **Step 2: Type Definitions** ✅ DONE
  - [x] 🟩 `RawCatalogueEntry` — shape of raw JSON: `{ item_details: string, provider_details: string }`
  - [x] 🟩 `ParsedItemDetails` — parsed item: `id`, `name`, `shortDesc`, `images`, `price`, `isVeg`, `isRelated`, `parentId`
  - [x] 🟩 `ParsedProviderDetails` — parsed provider: `id`, `brandName`, `brandLogo`, `companyName`, `storeImages`
  - [x] 🟩 `ParsedProduct` — combined: `ParsedItemDetails` + `provider: ParsedProviderDetails`
  - [x] 🟩 `ProductGroup` — parent product + children array for grouped display
  - [x] 🟩 `BannerState` — selected product, background, CTA text, badge text, T&C visible, brand logo override URL
  - [x] 🟩 `LogEntry` — type (info/warning/error), message, timestamp
  - [x] 🟩 `BackgroundOption` — id, name, thumbnail, full-size URL

- [x] 🟩 **Step 3: Catalogue Parser Service** ✅ DONE
  - [x] 🟩 Load JSON file, parse each stringified `item_details` and `provider_details`
  - [x] 🟩 Deduplicate entries by item ID
  - [x] 🟩 Normalize into `ParsedProduct` objects (item + provider combined)
  - [x] 🟩 Identify parent-child relationships: `related: true` items with `parent.id` tag → grouped under the parent; standalone `related: false` items with `custom_group` tag → marked as group parents
  - [x] 🟩 Build `ProductGroup[]` array for display
  - [x] 🟩 Flag products with placeholder/missing images (`noImage.png` detection)

- [x] 🟩 **Step 4: Search Service** ✅ DONE
  - [x] 🟩 Split query into words, lowercase
  - [x] 🟩 Filter products where ALL words appear in `product.name` (case-insensitive)
  - [x] 🟩 Maintain group structure in results (if a child matches, show it under its parent; if a parent matches, show it with all children)
  - [x] 🟩 Handle empty query (show all) and no results

- [x] 🟩 **Step 5: Banner Template Constants** ✅ DONE
  - [x] 🟩 Define fixed dimensions: 712×322px
  - [x] 🟩 Define element positions, sizes, font families, font weights, font sizes, colors for: brand logo area, product name, product image, CTA button, offer badge, T&C text
  - [x] 🟩 These constants drive both the preview component and the export rendering

- [x] 🟩 **Step 6: Banner Preview Component** ✅ DONE
  - [x] 🟩 Build the HTML/CSS template as a React component matching the reference banner exactly
  - [x] 🟩 Background image layer (full bleed)
  - [x] 🟩 Brand logo + tagline (top-left) — uses provider logo by default, overridable via UI
  - [x] 🟩 Product name with multi-line wrapping (left side, below brand)
  - [x] 🟩 Product image (right side, vertically centered)
  - [x] 🟩 CTA button (bottom-left, styled)
  - [x] 🟩 Offer badge (top-right, bordered rectangle)
  - [x] 🟩 *T&C Apply text (below CTA, conditionally rendered via toggle)
  - [x] 🟩 All element positions driven by constants from Step 5
  - [x] 🟩 Graceful handling: no product image → render without; no brand logo → skip

- [x] 🟩 **Step 7: State Management** ✅ DONE
  - [x] 🟩 `useBannerState` hook: selected product, selected background, CTA text (default "BUY NOW"), badge text (default "Free Delivery"), T&C toggle (default off), brand logo override URL (default null = use provider logo)
  - [x] 🟩 `useCatalogue` hook: load + parse catalogue on mount, expose products and groups
  - [x] 🟩 `useLogs` hook: append log entries, expose log list

- [x] 🟩 **Step 8: Export Service** ✅ DONE
  - [x] 🟩 Use `html-to-image` to capture the banner preview DOM node
  - [x] 🟩 Support `toPng()`, `toJpeg()`, `toBlob()` for PNG/JPG/WEBP
  - [x] 🟩 Trigger browser download with correct filename and extension
  - [x] 🟩 Handle export errors (log to LogsPanel)

- [x] 🟩 **Step 9: UI Components + Antigravity Prompts** ✅ DONE
  - [x] 🟩 **Dashboard Layout**: dark sidebar + main content area
  - [x] 🟩 **Product Search Panel**: search input + scrollable grouped results list (related items as sublists)
  - [x] 🟩 **Banner Preview Area**: centered 712×322 preview with zoom/scale for viewport fit
  - [x] 🟩 **Banner Controls Panel**: background thumbnail selector, CTA text input (presets + custom), badge text input (presets + custom), T&C toggle switch, brand logo override button
  - [x] 🟩 **Background Gallery Modal**: popup grid of background thumbnails, click to select
  - [x] 🟩 **Export Panel**: format radio/select (PNG/JPG/WEBP) + download button
  - [x] 🟩 **Logs Panel**: scrollable list of log entries with icons (warning/error/info)
  - [x] 🟩 For each component: provide an Antigravity prompt for the user to generate the UI

- [x] 🟩 **Step 10: Integration & Wiring** ✅ DONE
  - [x] 🟩 Wire state management across all components
  - [x] 🟩 Product selection → updates banner preview in real-time (including brand info from provider)
  - [x] 🟩 Background/CTA/badge/T&C/logo override changes → update preview in real-time
  - [x] 🟩 Export button → captures current preview state
  - [x] 🟩 Missing image detection → writes to logs panel

- [x] 🟩 **Step 11: Error Handling & Edge Cases** ✅ DONE
  - [x] 🟩 Products with no image (`noImage.png` or broken URL): render banner without product image + log "No product image in the catalogue"
  - [x] 🟩 Products with no brand logo: skip brand section gracefully
  - [x] 🟩 Long product names: multi-line wrap with overflow handling
  - [x] 🟩 Empty catalogue / failed load: show error state
  - [x] 🟩 Export failure: log error, show user-facing message
  - [x] 🟩 Image CORS issues on export (html-to-image requires images to be CORS-accessible or proxied)
  - [x] 🟩 Duplicate catalogue entries: deduplicated in parser (by item ID)

- [x] 🟩 **Step 12: Testing** ✅ DONE
  - [x] 🟩 Unit tests: catalogue parser (stringified JSON parsing, deduplication, grouping, missing image detection, provider extraction)
  - [x] 🟩 Unit tests: search service (multi-word matching, empty query, no results, group structure preservation)
  - [x] 🟩 Unit tests: export service (format selection, filename generation)
  - [x] 🟩 Unit tests: banner state hook (defaults, updates, resets, logo override)
  - [x] 🟩 Integration test: select product → preview renders correctly with brand info
  - [x] 🟩 Edge case tests: missing images, broken URLs, empty catalogue, very long product names, duplicate entries

## Known Risks / Open Items
1. **CORS on product images**: `html-to-image` needs image pixels to be accessible. If catalogue image URLs don't have CORS headers, export will fail with tainted canvas. **Mitigation**: Proxy images through a small serverless function, or use `fetch` + blob URLs to preload images. Will evaluate during Step 8.
2. **Catalogue structure changes**: If final catalogue structure differs, `catalogueParser.ts` is the only file that needs updating — isolated by design.
3. **Background images**: User to provide 3 images for `/public/backgrounds/`. Placeholder directory created in Step 1.
4. **Brand logo quality**: Provider `symbol` may be a store photo rather than a clean logo. Brand logo override UI mitigates this — user can supply a better image.

---

## Fix Plan: Align Codebase After Antigravity Changes

Antigravity modified hooks to use Context/Provider pattern and changed several API contracts. The original UI components (named `.tsx` files) are kept; Antigravity's `index.tsx` component files have been deleted. The goal is to make the app run correctly using **Antigravity's Context/Provider hooks** + **original UI components**.

### Architecture Decision
- **Hooks**: Context/Provider pattern (Antigravity's approach — `BannerProvider`, `LogsProvider`)
- **Components**: Original named `.tsx` files (Claude's approach — prop-driven, will restyle with Antigravity later)
- **App.tsx**: Rewrite to consume Context hooks and pass data to original components

### Fix List

- [x] 🟩 **Fix F1: Delete Antigravity's `index.tsx` component files** ✅ DONE
  - Delete: `src/components/BannerPreview/index.tsx`, `ProductSearch/index.tsx`, `BannerControls/index.tsx`, `ExportPanel/index.tsx`, `LogsPanel/index.tsx`, `BackgroundGallery/index.tsx`, `Layout/index.tsx`
  - **STATUS: DONE** — already deleted

- [x] 🟩 **Fix F2: Align `types/index.ts`** ✅ DONE
  - `BackgroundOption` → updated to `{ id, url, ctaColor, ctaTextColor }` (removed `name`, `thumbnailUrl`)
  - `BannerState` → added `showBadge: boolean`, `tncText: string` fields

- [x] 🟩 **Fix F3: Fix `useLogs.tsx`** ✅ DONE
  - `addLog(level, message)` positional args, `new Date()` timestamp, counter-based unique IDs

- [x] 🟩 **Fix F4: Fix `useBannerState.tsx`** ✅ DONE
  - Added `showBadge` (default true), `tncText` (default "*T&C Apply"), `toggleTnc`, `toggleBadge`
  - CTA default → "SHOP NOW", renamed `showTc` → `showTnc`

- [x] 🟩 **Fix F5: Fix `catalogueParser.ts` + `useCatalogue.ts`** ✅ DONE
  - Parser kept pure; `useCatalogue` rewritten to fetch → parse → group → detect missing images
  - Returns `{ products, groups, isLoading, error, missingImageProducts }`

- [x] 🟩 **Fix F6: Verify `searchService.ts`** ✅ DONE — no changes needed

- [x] 🟩 **Fix F7: Fix `exportService.ts`** ✅ DONE
  - Changed to `exportBanner(node, filename, format)`, added `generateFilename()`

- [x] 🟩 **Fix F8: Fix `backgrounds.ts`** ✅ DONE
  - Real filenames: `blue bg.png`, `pink bg.png`, `purple bg.png` with per-background CTA colours

- [x] 🟩 **Fix F9: Fix `bannerTemplate.ts`** ✅ DONE
  - Updated to 722×312 spec with all positions, fonts, adaptive sizing constants

- [x] 🟩 **Fix F10: Fix `main.tsx`** ✅ DONE — wrapped with `LogsProvider` > `BannerProvider`

- [x] 🟩 **Fix F11: Fix `App.tsx`** ✅ DONE
  - Uses flat context values, assembles `BannerState` via `useMemo` for BannerPreview

- [x] 🟩 **Fix F12: Fix component prop interfaces** ✅ DONE
  - `BannerControls`: added `showBadge`, `tncText`, `onBadgeToggle`, `onTncTextChange`
  - `BackgroundGallery`: removed name labels, updated aspect ratio to 722/312
  - `BannerPreview`: full rewrite for 722×312 spec with adaptive font sizing

- [x] 🟩 **Fix F13: Fix tests** ✅ DONE
  - Fixed `searchService.test.ts` mockProvider, `catalogueParser.test.ts` missing image test
  - All 29 tests passing

- [x] 🟩 **Fix F14: Add Google Fonts CDN** ✅ DONE
  - Added Inter (400, 500, 700, 800) with preconnect hints

### Fix Order (recommended execution sequence)
1. F1 (delete duplicates) — DONE
2. F2 (types) — foundation, everything depends on this
3. F14 (fonts) — quick, no dependencies
4. F3 (useLogs) + F4 (useBannerState) — hooks must be correct before components
5. F5 (catalogueParser + useCatalogue) — data layer
6. F6 (searchService) — already correct, just verify
7. F7 (exportService) — add generateFilename back
8. F8 (backgrounds) — use real filenames
9. F9 (bannerTemplate) — fix export format
10. F10 (main.tsx) — add providers
11. F11 (App.tsx) — rewire everything
12. F12 (component props) — align interfaces
13. F13 (tests) — verify everything passes

### After Fixes: Banner Spec Implementation
Once the app runs, execute Steps 13–23 below to apply the detailed 722×312 banner element spec.

### After Banner Spec: UI Restyling
Restyle all components with Antigravity for the final dark theme modern UI.

---

## Banner Element Spec — Implementation Steps

Canvas: **722×312px**, corner radius 24px, fallback `#FFFFFF`, overflow `hidden`.
50/50 horizontal split at `x = 361`. Left half = text elements. Right half = product image + badge.
Font: **Inter** via Google Fonts CDN (400, 500, 700, 800).

### Color Reference

| Element | Color | Notes |
|---|---|---|
| Product name (heading) | `#000000` | Always black |
| T&C text | `#000000` | Always black |
| CTA text | `#FFFFFF` | Always white |
| CTA bg — blue bg | `#457DD1` | Per-background |
| CTA bg — pink bg | `#FF6B6B` | Per-background |
| CTA bg — purple bg | `#411F54` | Per-background |
| Offer badge text | `#FFFFFF` | Always white |
| Offer badge bg | `#85929E` | Always grey |
| Canvas fallback | `#FFFFFF` | When no background selected |

### Font Reference

| Element | Font | Weight | Size | Special |
|---|---|---|---|---|
| Heading (product name) | Inter | 800 | 28px → 18px adaptive | Max 2 lines, truncate `...` |
| CTA button | Inter | 700 | 20px | — |
| T&C text | Inter | 400 | 12px | — |
| Offer badge | Inter | 500 | 20px | — |

### Visual Layout (722×312)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ x=24                              x=361                    ┌──────────────┐ │
│ ┌────────┐                          │                      │ Offer Badge  │ │
│ │  Logo  │ (max 120×40)             │                      │  #85929E bg  │ │
│ └────────┘                          │                      │  TL=0 TR=24  │
│   8px gap                           │                      │  BR=0 BL=8   │
│ ┌─────────────────────┐             │                      └──────────────┘ │
│ │ Product Name        │ (Inter 800) │                                       │
│ │ max 320px, 2 lines  │ #000000     │         ┌──────────────────┐          │
│ │ 28px → 18px adaptive│             │         │                  │          │
│ └─────────────────────┘             │         │  Product Image   │          │
│   ↑ group bottom-anchored at y=165  │         │  (contain fit)   │          │
│                                     │         │  centered at     │          │
│ ─── y=180 ─── subheading area ───── │         │  x=541.5         │          │
│ ─── y=225 ─── end subheading ────── │         │                  │          │
│                                     │         │  bottom-aligned  │          │
│ ┌────────────────┐  y=233           │         │                  │          │
│ │   SHOP NOW     │  CTA (Inter 700) │         └──────────────────┘          │
│ │   #ctaColor bg │  20px, #FFF text │                  ↓                    │
│ └────────────────┘                  │            (touches bottom)            │
│  *T&C Apply  (Inter 400, 12px)      │                                       │
│   6px below CTA, #000000            │                                       │
└──────────────────────────────────────────────────────────────────────────────┘
  ← 722px →                                                    corner radius=24
```

### Tasks

- [x] 🟩 **Step 13: Update Canvas Dimensions & Base Styles**
  - [x] 🟩 Change canvas from 712×322 to **722×312** in `bannerTemplate.ts`
  - [x] 🟩 Set corner radius to **24px** (all corners)
  - [x] 🟩 Set fallback background to `#FFFFFF`
  - [x] 🟩 Set `overflow: hidden` on the canvas container
  - [x] 🟩 Update the dimension label in `App.tsx` from "712 × 322px" to "722 × 312px"
  - [x] 🟩 Update `BannerPreview.tsx` to use the new canvas constants

- [x] 🟩 **Step 14: Update Background Constants with CTA Colors**
  - [x] 🟩 In `backgrounds.ts`, update `BackgroundOption` type to include `ctaColor` and `ctaTextColor`
  - [x] 🟩 Set blue bg → `ctaColor: #457DD1`, `ctaTextColor: #FFFFFF`
  - [x] 🟩 Set pink bg → `ctaColor: #FF6B6B`, `ctaTextColor: #FFFFFF`
  - [x] 🟩 Set purple bg → `ctaColor: #411F54`, `ctaTextColor: #FFFFFF`
  - [x] 🟩 Remove `name` and `thumbnailUrl` fields — gallery uses `url` directly, no labels

- [x] 🟩 **Step 15: Implement Brand Logo Element**
  - [x] 🟩 Position at `x=24, y=22`
  - [x] 🟩 Max dimensions: `120×40px`, `object-fit: contain`
  - [x] 🟩 Source: `provider.brandLogo`, overridable via `brandLogoOverride`
  - [x] 🟩 If logo is missing/null: **skip logo entirely**, heading shifts up (handled in Step 16)

- [x] 🟩 **Step 16: Implement Product Name (Heading) with Dynamic Positioning**
  - [x] 🟩 Font: Inter 800, color `#000000`, max width 320px, max 2 lines
  - [x] 🟩 X position: 24px
  - [x] 🟩 Logo + heading form a vertical group, **bottom-anchored** at `y = 165` (15px above subheading at y=180)
  - [x] 🟩 When logo exists: logo top → 8px gap → heading. Group bottom at y=165
  - [x] 🟩 When no logo: heading top starts at `y = 22` (where logo would have been)
  - [x] 🟩 **Adaptive font sizing**: start at 28px, reduce by 2px increments, minimum 18px
  - [x] 🟩 At 18px minimum: if text still overflows, truncate with `...` after 2 lines
  - [x] 🟩 Implement measurement logic (ref-based DOM measurement or canvas `measureText`) to determine if text fits at each font size
  - [x] 🟩 Line height: 1.2

- [x] 🟩 **Step 17: Implement Subheading Reserved Area**
  - [x] 🟩 Reserve space from `y=180` to `y=225` (45px tall), `x=24`, width 320px
  - [x] 🟩 Leave **empty** for now — no content rendered in this zone
  - [x] 🟩 Ensure no other elements overlap this area

- [x] 🟩 **Step 18: Implement CTA Button & T&C Text**
  - [x] 🟩 **CTA button**: position at `x=24, y=233`
  - [x] 🟩 Font: Inter 700, 20px, text color `#FFFFFF`
  - [x] 🟩 Padding: 8px vertical, 24px horizontal
  - [x] 🟩 Corner radius: 8px (all corners)
  - [x] 🟩 Background color: **read from selected background's `ctaColor`** (per-background from Step 14)
  - [x] 🟩 Default text: `"SHOP NOW"` (editable via `ctaText` state)
  - [x] 🟩 **T&C text**: positioned 6px below CTA button bottom
  - [x] 🟩 Font: Inter 400, 12px, color `#000000`
  - [x] 🟩 Default text: `"*T&C Apply"` (editable via `tncText` state)
  - [x] 🟩 Conditionally rendered: only shown when `showTnc === true`
  - [x] 🟩 Max width: 320px

- [x] 🟩 **Step 19: Implement Offer Badge**
  - [x] 🟩 Position: top-right corner of canvas, flush against edge
  - [x] 🟩 Badge right edge = canvas right edge, badge top = canvas top
  - [x] 🟩 Background: `#85929E` (grey)
  - [x] 🟩 Text color: `#FFFFFF` (white)
  - [x] 🟩 Font: Inter 500, 20px
  - [x] 🟩 Padding: 8px vertical, 16px horizontal
  - [x] 🟩 Corner radius: **asymmetric** — TL=0, TR=24 (match canvas), BR=0, BL=8
  - [x] 🟩 Default text: `"Free Delivery"` (editable via `badgeText` state)
  - [x] 🟩 Conditionally rendered: only shown when `showBadge === true`

- [x] 🟩 **Step 20: Implement Product Image (Right Half)**
  - [x] 🟩 Positioned in right half of canvas (x = 361 to 722)
  - [x] 🟩 Horizontal center: `x = 541.5` (center of right half)
  - [x] 🟩 Vertical alignment: **bottom-aligned** (image bottom edge = canvas bottom edge)
  - [x] 🟩 Max width: 300px
  - [x] 🟩 Max height: 280px (leave room for badge at top)
  - [x] 🟩 Object fit: `contain` (preserve aspect ratio, no crop)
  - [x] 🟩 Source: `product.imageUrl`
  - [x] 🟩 If missing: render banner without product image — right half shows background only

- [x] 🟩 **Step 21: Add Google Fonts CDN to `index.html`**
  - [x] 🟩 Add `<link>` tag for Inter font (weights 400, 500, 700, 800) in `<head>`
  - [x] 🟩 Use `display=swap` for performance
  - [x] 🟩 Verify font loads correctly in BannerPreview rendering
  - [x] 🟩 Verify exported banners use the correct Inter font (html-to-image must have font available)

- [x] 🟩 **Step 22: Update `BannerControls.tsx` for New Fields**
  - [x] 🟩 Add **badge toggle** (show/hide offer badge via `showBadge` / `toggleBadge`)
  - [x] 🟩 Add **T&C text input** (editable text, not just a toggle — `tncText` / `setTncText`)
  - [x] 🟩 Ensure CTA text input default is `"SHOP NOW"` (not "BUY NOW")
  - [x] 🟩 Ensure badge text input default is `"Free Delivery"`

- [x] 🟩 **Step 23: Integration Testing & Visual Verification**
  - [x] 🟩 Select a product → verify logo, heading, CTA, badge, product image all render at correct positions
  - [x] 🟩 Test adaptive font sizing: short name (28px), medium name (reduced), long name (18px + truncate)
  - [x] 🟩 Test no-logo scenario: heading shifts up to y=22
  - [x] 🟩 Test each background: verify CTA color changes correctly (blue/pink/purple)
  - [x] 🟩 Test badge toggle: show/hide
  - [x] 🟩 Test T&C toggle + text editing
  - [x] 🟩 Test export: verify exported image matches preview at 722×312
  - [x] 🟩 Update existing unit tests for new canvas dimensions and constants
  - [x] 🟩 Add tests for adaptive font sizing logic

---

## Remove Background Feature — Implementation Steps (remove.bg API)

**Context:** Banner images (product image + brand logo) often have solid backgrounds that look bad over the banner background. One-click button below preview calls the remove.bg API to strip backgrounds, replacing images with transparent PNGs.

**API:** `POST https://api.remove.bg/v1.0/removebg` — FormData with `image_url` + `size=auto`, `X-Api-Key` header. Returns binary PNG.

**Architecture:** Local state in App.tsx (`bgRemovedProductUrl`, `bgRemovedLogoUrl`) overrides banner state before passing to BannerPreview. No changes to BannerState type or BannerPreview component.

### Tasks

- [x] 🟩 **Step 24: Environment Setup** ✅ DONE
  - [x] 🟩 Create `.env` at project root: `VITE_REMOVEBG_API_KEY=<key>`
  - [x] 🟩 Add `.env` to `.gitignore` if not present
  - [x] 🟩 Verify `import.meta.env.VITE_REMOVEBG_API_KEY` accessible in dev

- [x] 🟩 **Step 25: Remove Background Service** ✅ DONE
  - [x] 🟩 Create `src/services/removeBackgroundService.ts`
  - [x] 🟩 `removeBackground(imageUrl: string): Promise<string>`:
    - Guard: throw if API key missing
    - Build FormData with `image_url` + `size=auto`
    - POST to `https://api.remove.bg/v1.0/removebg` with `X-Api-Key` header
    - Convert `response.blob()` → `URL.createObjectURL(blob)` → return blob URL
    - Throw descriptive error on non-OK response (status + statusText)

- [x] 🟩 **Step 26: App.tsx — State & Handler** ✅ DONE
  - [x] 🟩 Add state: `bgRemovedProductUrl`, `bgRemovedLogoUrl` (both `string | null`), `isRemovingBg: boolean`
  - [x] 🟩 `handleRemoveBackground` callback:
    - Set `isRemovingBg = true`
    - Build promises: product image (if exists) + brand logo (if exists)
    - `Promise.allSettled()` for parallel calls
    - Store successful blob URLs; log errors for failures
    - Set `isRemovingBg = false`, log summary via `addLog()`
  - [x] 🟩 `useEffect`: reset both URLs + revoke blob URLs when `selectedProduct` changes
  - [x] 🟩 In `bannerState` useMemo: override `selectedProduct.imageUrl` with `bgRemovedProductUrl` if set; override `brandLogoOverride` with `bgRemovedLogoUrl` if set
  - [x] 🟩 Clean up blob URLs via `URL.revokeObjectURL()` on reset/unmount

- [x] 🟩 **Step 27: "Remove Background" Button UI** ✅ DONE
  - [x] 🟩 Location: below `<BannerPreview>`, inside `flex-col items-center gap-4` wrapper, before "722 × 312px" label
  - [x] 🟩 Text: "Remove Background" / "Removing Background..." (loading)
  - [x] 🟩 Disabled: no product selected, `isRemovingBg`, or both images already processed
  - [x] 🟩 Style: `bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg px-4 py-2 text-sm`

- [x] 🟩 **Step 28: Testing & Verification** ✅ DONE
  - [x] 🟩 Create `src/services/__tests__/removeBackgroundService.test.ts`:
    - Mock `fetch` — successful response → returns blob URL
    - Mock `fetch` — non-OK response → throws with status
    - Missing API key → throws immediately
  - [x] 🟩 `npm run build` — type-check passes
  - [x] 🟩 `npm run test:run` — all 37 tests pass (32 existing + 5 new)
  - [ ] ⬜ Manual: select product → click button → images update → export works

### Edge Cases
- Product has no image → only process brand logo
- No brand logo → only process product image
- Both missing → button disabled
- API fails for one → keep the other, log error
- User switches product → reset + revoke blob URLs
- User overrides brand logo after processing → reset processed logo URL

### Files
| File | Change |
|---|---|
| `.env` | **New** — `VITE_REMOVEBG_API_KEY` |
| `.gitignore` | Add `.env` if missing |
| `src/services/removeBackgroundService.ts` | **New** — remove.bg API service |
| `src/App.tsx` | State, handler, button, bannerState override, cleanup |
| `src/services/__tests__/removeBackgroundService.test.ts` | **New** — unit tests |

### Files NOT Modified
- `BannerPreview.tsx` — renders whatever URLs in BannerState (blob URLs work fine)
- `types/index.ts` — BannerState type unchanged
- `useBannerState.tsx` — untouched
- `exportService.ts` — blob URLs are same-origin, html-to-image handles them

---

## Editable Product Name Feature — Implementation Steps

**Context:** Banner product name is currently read-only from `selectedProduct.name`. Users need to customise it (shorten, rephrase, fix typos) without modifying the catalogue. Follows the same pattern as CTA text and badge text editing — a field in BannerControls that overrides the default value.

**Architecture:** New `productNameOverride: string | null` field in `BannerState`. `null` means "use original catalogue name". When a product is selected, the input pre-fills with the original name. Editing sets the override. Switching products resets to `null`. The override flows through `bannerState` into `BannerPreview`, which already has adaptive font sizing — no layout changes needed.

### Tasks

- [x] 🟩 **Step 29: Update Types & State** ✅ DONE
  - [x] 🟩 Add `productNameOverride: string | null` to `BannerState` in `types/index.ts`
  - [x] 🟩 Add `productNameOverride` state (default `null`) + `setProductNameOverride` setter in `useBannerState.tsx`
  - [x] 🟩 Expose `setProductNameOverride` in `BannerContextType`
  - [x] 🟩 Reset `productNameOverride` to `null` when `selectProduct` is called (so switching products clears the override)

- [x] 🟩 **Step 30: Add Product Name Input to BannerControls** ✅ DONE
  - [x] 🟩 Add `productNameOverride: string | null` and `originalProductName: string | null` and `onProductNameChange: (text: string | null) => void` to `BannerControlsProps`
  - [x] 🟩 Add a "Product Name" `Section` in BannerControls (placed first, above Background)
  - [x] 🟩 Text input: value = `productNameOverride ?? originalProductName ?? ''`, placeholder = `"Product name..."`
  - [x] 🟩 `onChange`: if value matches original name, set override to `null` (no unnecessary override); otherwise set override to the typed value
  - [x] 🟩 "Reset to original" text button (like brand logo reset) — shown only when override is active, resets to `null`

- [x] 🟩 **Step 31: Wire Through App.tsx** ✅ DONE
  - [x] 🟩 Destructure `productNameOverride` and `setProductNameOverride` from `useBannerState()`
  - [x] 🟩 Include `productNameOverride` in `bannerState` useMemo
  - [x] 🟩 Pass `productNameOverride`, `originalProductName={selectedProduct?.name ?? null}`, and `onProductNameChange={setProductNameOverride}` to `<BannerControls>`

- [x] 🟩 **Step 32: Update BannerPreview to Use Override** ✅ DONE
  - [x] 🟩 Destructure `productNameOverride` from `state`
  - [x] 🟩 Compute display name: `productNameOverride ?? selectedProduct?.name`
  - [x] 🟩 Use display name in the heading `<div>` (replaces `selectedProduct.name`)
  - [x] 🟩 Use display name in the adaptive font sizing `useEffect` dependency (replaces `selectedProduct?.name`)

- [x] 🟩 **Step 33: Testing & Verification** ✅ DONE
  - [x] 🟩 `npm run build` — type-check passes
  - [x] 🟩 `npm run test:run` — all 37 tests pass
  - [ ] ⬜ Manual: select product → name pre-fills → edit → banner updates → switch product → resets

### Edge Cases
- No product selected → Product Name section hidden or input disabled (same as other controls)
- User clears the input to empty string → render empty heading (intentional — user may want no heading)
- User types back the exact original name → override resets to `null` (clean state)
- Long override text → adaptive font sizing handles it automatically (existing logic)
- Product name override persists only until product switch → `selectProduct` resets it

### Files
| File | Change |
|---|---|
| `src/types/index.ts` | Add `productNameOverride: string \| null` to `BannerState` |
| `src/hooks/useBannerState.tsx` | Add state + setter + reset on product switch |
| `src/components/BannerControls/BannerControls.tsx` | Add "Product Name" input section |
| `src/App.tsx` | Wire new props through |
| `src/components/BannerPreview/BannerPreview.tsx` | Use override for heading text + font sizing |

### Files NOT Modified
- `exportService.ts` — unchanged
- `removeBackgroundService.ts` — unchanged
- `catalogueParser.ts` — catalogue data stays as-is
- `searchService.ts` — search uses original catalogue names

---

## Frontend Modernization – Phase-wise Implementation

**Goal:** Transform the existing UI into a Linear/Vercel-inspired ultra-clean tech dashboard with Apple-level depth and polish, keeping the professional internal-tool aesthetic. This is a structured visual + UX redesign — **business logic, hooks, services, types, and tests are untouched.**

**Design Direction:** Near-black layered surfaces · Indigo accent system · 8pt spacing grid · 150ms micro-interactions · Strong typographic hierarchy · Controlled whitespace as the primary separator · No heavy gradients, no neumorphism, no bounce animations.

**Constraint:** All 37 tests must pass after every phase. Run `npm run test:run` as a gate.

---

### Design System Tokens (reference for all phases)

| Token | Value | Use |
|---|---|---|
| `--surface-0` | `#0a0a0b` | Page background |
| `--surface-1` | `#111113` | Sidebar / panel backgrounds |
| `--surface-2` | `#1a1a1f` | Input / card backgrounds |
| `--surface-3` | `#222229` | Hover states |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Primary dividers |
| `--border-muted` | `rgba(255,255,255,0.10)` | Input borders |
| `--border-focus` | `#6366f1` | Focus rings |
| `--text-primary` | `#f4f4f5` | Main readable text |
| `--text-secondary` | `#a1a1aa` | Labels, metadata |
| `--text-tertiary` | `#71717a` | Placeholders, timestamps |
| `--accent-base` | `#6366f1` | Primary action color (replaces blue-600) |
| `--accent-hover` | `#4f46e5` | Hover state for accent |
| `--accent-soft` | `rgba(99,102,241,0.12)` | Selected item backgrounds |
| `--duration-fast` | `150ms` | Standard interaction speed |
| `--ease-standard` | `cubic-bezier(0.16,1,0.3,1)` | Snappy ease-out |

---

### Phase 1 — Design Token Foundation ✅ DONE

**Files:** `src/index.css`, `tailwind.config.ts`

- [x] 🟩 **FM-1:** Add all CSS custom properties (surface, border, text, accent, shadow, duration, easing) to `:root` in `index.css`
- [x] 🟩 **FM-2:** Add base styles to `index.css` — body background, font-smoothing, Inter font-family
- [x] 🟩 **FM-3:** Extend `tailwind.config.ts` theme with color tokens, so `bg-surface-1`, `text-text-secondary`, etc. become usable Tailwind classes
- [x] 🟩 **FM-4:** Add `@layer utilities` to `index.css` — `.transition-interaction`, `.focus-ring`, `.input-base` utility classes
- [x] 🟩 **FM-5:** Add thin scrollbar styles, `::selection` highlight, and global `:focus-visible` ring to `index.css`

---

### Phase 2 — App Shell & Layout ✅ DONE

**File:** `App.tsx` (layout/JSX only — no logic changes)

- [x] 🟩 **FM-6:** Replace raw `bg-gray-950` / `bg-gray-900/50` with CSS variable references
- [x] 🟩 **FM-7:** Narrow sidebars: left `w-64` (256px), right `w-72` (288px)
- [x] 🟩 **FM-8:** Replace `border-gray-800` dividers with `border-[var(--border-subtle)]`
- [x] 🟩 **FM-9:** Upgrade sidebar headers — `text-[11px] font-semibold text-[--text-tertiary] uppercase tracking-[0.08em]`
- [x] 🟩 **FM-10:** Redesign empty state — add SVG banner-outline icon, new heading + sub-text copy, centered layout
- [x] 🟩 **FM-11:** Redesign BannerPreview wrapper — deep lift shadow (`0 24px 48px rgba(0,0,0,0.65)`), match 24px border-radius to banner
- [x] 🟩 **FM-12:** Relocate dimension label — right-aligned `text-[10px] text-[--text-tertiary]` below preview wrapper
- [x] 🟩 **FM-13:** Upgrade "Remove Background" button — ghost style with `border-muted`, `text-secondary`, `hover:bg-[--surface-2]`

---

### Phase 3 — Component Restyling

Each component is refactored independently. No prop-type or interface changes.

#### 3A — ProductSearch ✅ DONE
**File:** `src/components/ProductSearch/ProductSearch.tsx`

- [x] 🟩 **FM-14:** Add search icon SVG (magnifier, 14×14) inside the search input as a left prefix
- [x] 🟩 **FM-15:** Apply `.input-base` styles to search input
- [x] 🟩 **FM-16:** Restyle `ProductItem` button — selected state uses left accent border + `bg-[--accent-soft]`, hover uses `bg-[--surface-2]`, all via `transition-interaction`
- [x] 🟩 **FM-17:** Replace veg dot with 6×6 inline SVG indicator; replace `!` missing-image text with a small SVG warning triangle

#### 3B — BannerControls ✅ DONE
**File:** `src/components/BannerControls/BannerControls.tsx`

- [x] 🟩 **FM-18:** Apply `.input-base` to all text inputs
- [x] 🟩 **FM-19:** Replace background "Choose background..." trigger button with an **inline 3-thumbnail strip** — small `aspect-[722/312]` image buttons in `flex gap-2`, selected = `ring-2 ring-[--accent-base]`
- [x] 🟩 **FM-20:** Restyle `PresetChips` — base `bg-[--surface-2]` / active `bg-[--accent-soft]` / hover `border-[--border-muted]`
- [x] 🟩 **FM-21:** Fix `ToggleRow` — replace `<div onClick>` with `<button role="switch" aria-checked>`, restyle track and thumb with CSS variable colors
- [x] 🟩 **FM-22:** Change "Reset to original" / "Reset to default" from `text-red-400` to `text-[--text-tertiary]` — reset is neutral, not destructive
- [x] 🟩 **FM-23:** Change brand logo "Apply" button from `blue-600` to `bg-[--accent-base]`
- [x] 🟩 **FM-24:** Update `Section` component label — `text-[11px] font-semibold uppercase tracking-[0.06em] text-[--text-tertiary]`

#### 3C — ExportPanel ✅ DONE
**File:** `src/components/ExportPanel/ExportPanel.tsx`

- [x] 🟩 **FM-25:** Change Download button from `green-600` → `bg-[--accent-base] hover:bg-[--accent-hover]` — green is out of system
- [x] 🟩 **FM-26:** Disabled state: `bg-[--surface-2] text-[--text-disabled] border border-[--border-subtle]`
- [x] 🟩 **FM-27:** Add `active:scale-[0.98]` micro-interaction on the enabled button

#### 3D — LogsPanel ✅ DONE
**File:** `src/components/LogsPanel/LogsPanel.tsx`

- [x] 🟩 **FM-28:** Replace character icons (`i`, `!`, `✕`) with proper inline SVG icons (circle-info, triangle-warning, x-circle)
- [x] 🟩 **FM-29:** Apply `--status-*` and `--status-*-bg` colors (from token file) to log entry backgrounds and icon colors
- [x] 🟩 **FM-30:** Update header label typography — match section label style from BannerControls
- [x] 🟩 **FM-31:** Update message text to `text-[--text-secondary]`, timestamp to `text-[--text-tertiary]`

#### 3E — BackgroundGallery ✅ DONE
**File:** `src/components/BackgroundGallery/BackgroundGallery.tsx`

- [x] 🟩 **FM-32:** Add modal entry animation — `@keyframes dialogIn` (scale 0.97→1 + opacity 0→1 at 200ms) in `index.css`, apply `.dialog-enter` class to dialog div
- [x] 🟩 **FM-33:** Add `backdrop-blur-sm` to the backdrop overlay
- [x] 🟩 **FM-34:** Restyle dialog — `bg-[--surface-1]`, `border-[--border-muted]`, `shadow-xl`
- [x] 🟩 **FM-35:** Restyle close button — `w-7 h-7 rounded-md hover:bg-[--surface-2]` with SVG × icon
- [x] 🟩 **FM-36:** Restyle thumbnail selection — `ring-2 ring-[--accent-base] ring-offset-2 ring-offset-[--surface-1]` (selected) vs `ring-1 ring-[--border-muted]` (unselected)

---

### Phase 4 — Audit & Consistency Pass ✅ DONE

- [x] 🟩 **FM-37:** Global sweep — replace all remaining raw `gray-*` Tailwind classes with CSS variable equivalents
- [x] 🟩 **FM-38:** Verify all interactive elements have `cursor-pointer` and `transition-interaction`
- [x] 🟩 **FM-39:** Verify `ExportModal.tsx` (if styled separately) follows the same modal conventions as BackgroundGallery

---

### Phase 5 — Verification ✅ DONE

- [x] 🟩 **FM-40:** `npm run test:run` — all 37 tests pass
- [x] 🟩 **FM-41:** `npm run build` — TypeScript compiles clean, no errors
- [x] 🟩 **FM-42:** Manual visual check — banner preview, empty state, all 3 sidebars, modal, logs panel
- [x] 🟩 **FM-43:** Tab through entire UI — every interactive element has a visible focus ring
- [x] 🟩 **FM-44:** Export a banner — verify the visual output is unchanged (styling changes must not touch BannerPreview internals)

---

### Files Modified in This Phase

| File | Change |
|---|---|
| `src/index.css` | CSS variables, base styles, utilities, animations, scrollbars |
| `tailwind.config.ts` | Theme token extension |
| `src/App.tsx` | Layout shell, empty state, wrapper styles, button styles |
| `src/components/ProductSearch/ProductSearch.tsx` | Search icon, item styles |
| `src/components/BannerControls/BannerControls.tsx` | All controls restyled, toggle semantics, bg thumbnail strip |
| `src/components/ExportPanel/ExportPanel.tsx` | Button color, micro-interaction |
| `src/components/LogsPanel/LogsPanel.tsx` | SVG icons, color tokens |
| `src/components/BackgroundGallery/BackgroundGallery.tsx` | Modal animation, styles |

### Files NOT Modified

- All hooks (`useBannerState`, `useCatalogue`, `useLogs`)
- All services (`exportService`, `catalogueParser`, `searchService`, `removeBackgroundService`)
- All types (`types/index.ts`)
- All constants (`bannerTemplate.ts`, `backgrounds.ts`)
- `src/components/BannerPreview/BannerPreview.tsx` — internal layout untouched
- `main.tsx`, `index.html`, `vite.config.ts`, `vitest.config.ts`
- All test files

---

## Price Display Feature — Implementation Plan

**Context:** Add toggleable MRP + selling price display to the banner, positioned in the currently-empty subheading area. Prices are parsed from the catalogue JSON (`price.maximum_value` and `price.value`), formatted with commas and ₹ prefix, and styled per the visual spec below.

**Requirements:**
- **Data extraction:** Parse `price.maximum_value` (MRP) and `price.value` (selling price) from catalogue JSON as **optional fields**
- **Formatting:** ₹ prefix, comma-separated (e.g., `₹1,299`), no decimals (strip `.00`)
- **Visual spec:**
  - **MRP**: Inter 500, 12px, black (`#000000`), strikethrough
  - **Selling Price**: Inter 700, 18px, black (`#000000`)
- **Layout:** Both prices bottom-aligned in the subheading area (`y=180` to `y=225`), MRP on left at `x=24`, 8px gap, selling price to the right
- **Toggleable:** Default ON, toggle control in BannerControls
- **Edge cases:**
  - If product has no price data → leave area empty, log message
  - If MRP = selling price → show both anyway (no special logic)

---

### Phase 1 — Type Definitions & Data Model

**Files:** `src/types/index.ts`, `src/services/catalogueParser.ts`

#### Tasks

- [x] 🟩 **Step P1: Update ParsedProduct Type** ✅ DONE
  - [x] 🟩 Add optional `price?: { mrp: string; sellingPrice: string }` field to `ParsedProduct` interface
  - [x] 🟩 Both `mrp` and `sellingPrice` are strings (formatted, e.g., `"₹1,299"`) — formatting happens in parser

- [x] 🟩 **Step P2: Update BannerState Type** ✅ DONE
  - [x] 🟩 Add `showPrice: boolean` to `BannerState` interface (default `true`)

- [x] 🟩 **Step P3: Extract Price Data in Catalogue Parser** ✅ DONE
  - [x] 🟩 In `catalogueParser.ts → parseCatalogue()`, after parsing `itemInfo`:
    - Try to extract `itemInfo.price.maximum_value` (MRP) and `itemInfo.price.value` (selling price)
    - If both exist, format them:
      - Convert to number, strip decimals (e.g., `"499.0"` → `499`)
      - Add commas: `499` → `"499"`, `1299` → `"1,299"`
      - Add ₹ prefix: `"₹499"`, `"₹1,299"`
    - If either is missing or invalid, set `price` field to `undefined`
    - Add formatted `price: { mrp, sellingPrice }` to the `ParsedProduct` object
  - [x] 🟩 Create helper function `formatPrice(value: string | number): string` for the formatting logic (testable)

---

### Phase 2 — State Management

**Files:** `src/hooks/useBannerState.tsx`

#### Tasks

- [x] 🟩 **Step P4: Add Price Toggle State** ✅ DONE
  - [x] 🟩 Add `showPrice: boolean` state in `useBannerState`, default `true`
  - [x] 🟩 Add `togglePrice: () => void` function (flips `showPrice`)
  - [x] 🟩 Expose both in the return object and in `BannerContextType`

---

### Phase 3 — Banner Template Constants

**Files:** `src/constants/bannerTemplate.ts`

#### Tasks

- [x] 🟩 **Step P5: Define Price Display Constants** ✅ DONE
  - [x] 🟩 Create `PRICE_DISPLAY` constant with:
    - `x: 24` (left margin, same as product name)
    - `bottomY: 225` (bottom edge of subheading area — prices are bottom-aligned here)
    - `gap: 8` (horizontal gap between MRP and selling price)
    - `mrp`: `{ fontSize: 12, fontWeight: 500, color: '#000000', fontFamily: 'Inter', textDecoration: 'line-through' }`
    - `sellingPrice`: `{ fontSize: 18, fontWeight: 700, color: '#000000', fontFamily: 'Inter' }`

---

### Phase 4 — Banner Preview Rendering

**Files:** `src/components/BannerPreview/BannerPreview.tsx`

#### Tasks

- [x] 🟩 **Step P6: Render Prices in Subheading Area** ✅ DONE
  - [x] 🟩 Destructure `showPrice` from `state`
  - [x] 🟩 Add conditional rendering block (between product name and CTA button)
  - [x] 🟩 Position the wrapper `<div>` at `x=24`, with bottom edge at `y=225` (use `position: absolute`, `left: 24`, `bottom: 312 - 225 = 87`)
  - [x] 🟩 Layout: `display: flex`, `align-items: flex-end` (bottom-align text), `gap: 8px`
  - [x] 🟩 Apply `PRICE_DISPLAY.mrp` styles to MRP `<span>`, including `textDecoration: 'line-through'`
  - [x] 🟩 Apply `PRICE_DISPLAY.sellingPrice` styles to selling price `<span>`

---

### Phase 5 — UI Controls

**Files:** `src/components/BannerControls/BannerControls.tsx`, `src/App.tsx`

#### Tasks

- [x] 🟩 **Step P7: Add Price Toggle to BannerControls** ✅ DONE
  - [x] 🟩 Add `showPrice: boolean` and `onPriceToggle: () => void` to `BannerControlsProps`
  - [x] 🟩 Add a new `<ToggleRow>` for "Show Price" in BannerControls (placed after T&C toggle, before Export section)
  - [x] 🟩 Label: `"Show Price"`, toggle bound to `showPrice` / `onPriceToggle`

- [x] 🟩 **Step P8: Wire Through App.tsx** ✅ DONE
  - [x] 🟩 Destructure `showPrice` and `togglePrice` from `useBannerState()`
  - [x] 🟩 Include `showPrice` in the `bannerState` useMemo
  - [x] 🟩 Pass `showPrice` and `onPriceToggle={togglePrice}` to `<BannerControls>`

---

### Phase 6 — Logging & Edge Cases

**Files:** `src/hooks/useCatalogue.ts` (or `src/App.tsx`)

#### Tasks

- [x] 🟩 **Step P9: Log Missing Price Data** ✅ DONE
  - [x] 🟩 After parsing the catalogue in `useCatalogue`, check each product
  - [x] 🟩 Aggregate count: log summary like `"Price data missing for X products"` instead of one log per product (cleaner)

---

### Phase 7 — Testing

**Files:** `src/services/__tests__/catalogueParser.test.ts`, manual testing

#### Tasks

- [x] 🟩 **Step P10: Unit Tests for Price Formatting** ✅ DONE
  - [x] 🟩 Test `formatPrice("499.0")` → `"₹499"`
  - [x] 🟩 Test `formatPrice("1299")` → `"₹1,299"`
  - [x] 🟩 Test `formatPrice(1299)` → `"₹1,299"` (number input)
  - [x] 🟩 Test `formatPrice("0")` → `"₹0"`
  - [x] 🟩 Test invalid input (empty string, null) → returns empty or throws

- [x] 🟩 **Step P11: Unit Tests for Catalogue Parser** ✅ DONE
  - [x] 🟩 Test product with valid `price.maximum_value` and `price.value` → `ParsedProduct.price` is set correctly
  - [x] 🟩 Test product with missing price fields → `ParsedProduct.price` is `undefined`
  - [x] 🟩 Test product with malformed price (e.g., non-numeric string) → `ParsedProduct.price` is `undefined`

- [x] 🟩 **Step P12: Integration Testing** ✅ DONE
  - [x] 🟩 `npm run build` — type-check passes
  - [x] 🟩 `npm run test:run` — all 49 tests pass (37 existing + 12 new)
  - [ ] ⬜ Manual: Select product with price → prices render in subheading area, bottom-aligned, correct fonts/sizes
  - [ ] ⬜ Manual: Toggle "Show Price" off → prices disappear
  - [ ] ⬜ Manual: Select product with no price → subheading area empty, log message appears
  - [ ] ⬜ Manual: Export banner with prices visible → prices appear in exported image

---

### Edge Cases Summary

| Scenario | Behavior |
|---|---|
| Product has valid MRP + selling price | Both display, formatted with ₹ and commas |
| MRP = selling price (no discount) | Show both anyway (strikethrough on MRP still applied) |
| Product missing price data (`price` undefined) | Subheading area remains empty, log entry: "Price unavailable for: {name}" |
| User toggles price off | Prices hidden, subheading area empty |
| Very long price string (e.g., `₹99,99,999`) | Renders as-is (no wrapping/overflow — prices are single-line) |
| User switches products | Price data updates automatically (driven by `selectedProduct.price`) |

---

### Files Modified

| File | Change |
|---|---|
| `src/types/index.ts` | Add `price?: { mrp: string; sellingPrice: string }` to `ParsedProduct`, add `showPrice` to `BannerState` |
| `src/services/catalogueParser.ts` | Extract and format price data, add `formatPrice()` helper |
| `src/hooks/useBannerState.tsx` | Add `showPrice` state + `togglePrice` function |
| `src/constants/bannerTemplate.ts` | Add `PRICE_DISPLAY` constants |
| `src/components/BannerPreview/BannerPreview.tsx` | Render prices in subheading area |
| `src/components/BannerControls/BannerControls.tsx` | Add price toggle control |
| `src/App.tsx` | Wire `showPrice` and `togglePrice` through props |
| `src/hooks/useCatalogue.ts` | Log missing price data after parsing |
| `src/services/__tests__/catalogueParser.test.ts` | Add tests for price extraction and formatting |

### Files NOT Modified

- `src/services/exportService.ts` — unchanged (prices render as part of BannerPreview DOM, exported automatically)
- `src/services/searchService.ts` — unchanged (search still uses product name only)
- `src/services/removeBackgroundService.ts` — unchanged
- `src/components/ProductSearch/ProductSearch.tsx` — unchanged
- `src/components/ExportPanel/ExportPanel.tsx` — unchanged
- `src/components/LogsPanel/LogsPanel.tsx` — unchanged
- `src/components/BackgroundGallery/BackgroundGallery.tsx` — unchanged

---

### Visual Reference (722×312 Banner)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ x=24                              x=361                    ┌──────────────┐ │
│ ┌────────┐                          │                      │ Offer Badge  │ │
│ │  Logo  │ (max 120×40)             │                      │  (top-right) │ │
│ └────────┘                          │                      └──────────────┘ │
│   8px gap                           │                                       │
│ ┌─────────────────────┐             │                                       │
│ │ Product Name        │ (Inter 800) │         ┌──────────────────┐          │
│ │ max 320px, 2 lines  │ #000000     │         │                  │          │
│ │ 28px → 18px adaptive│             │         │  Product Image   │          │
│ └─────────────────────┘             │         │  (contain fit)   │          │
│   ↑ group bottom-anchored at y=165  │         │  centered at     │          │
│                                     │         │  x=541.5         │          │
│ ─── y=180 ─── SUBHEADING AREA ───── │         │                  │          │
│  ₹499  ₹1,299  ← PRICES HERE        │         │  bottom-aligned  │          │
│  (MRP) (Selling)                    │         │                  │          │
│  Inter  Inter                       │         └──────────────────┘          │
│  500    700                         │                  ↓                    │
│  12px   18px                        │            (touches bottom)            │
│  strike  —                          │                                       │
│ ─── y=225 ─── END SUBHEADING ────── │                                       │
│                                     │                                       │
│ ┌────────────────┐  y=233           │                                       │
│ │   SHOP NOW     │  CTA (Inter 700) │                                       │
│ │   #ctaColor bg │  20px, #FFF text │                                       │
│ └────────────────┘                  │                                       │
│  *T&C Apply  (Inter 400, 12px)      │                                       │
│   6px below CTA, #000000            │                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Price positioning detail:**
- Container: `position: absolute`, `left: 24px`, `bottom: 87px` (312 - 225 = 87)
- Layout: `display: flex`, `align-items: flex-end`, `gap: 8px`
- MRP: `font-size: 12px`, `font-weight: 500`, `text-decoration: line-through`
- Selling: `font-size: 18px`, `font-weight: 700`

---

### Execution Sequence (recommended order)

1. **P1** (types) — foundation
2. **P3** (parser + formatter) — data layer, testable in isolation
3. **P10 + P11** (tests for parser/formatter) — verify data layer works
4. **P2** (state) — hook layer
5. **P5** (constants) — layout constants
6. **P6** (BannerPreview) — rendering
7. **P7 + P8** (controls + wiring) — UI controls
8. **P9** (logging) — edge case handling
9. **P12** (integration tests + manual verification) — final validation

---

**After completion:** All 37+ existing tests pass, price display toggle works, exported banners include prices when enabled, no regressions to existing features.
