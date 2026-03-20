# Feature Implementation Plan

**Overall Progress:** `Steps 1-33 DONE | Fixes F1-F14 DONE | FM-1 to FM-44 DONE | P1-P12 DONE | S1-S6 DONE | T1-T8 DONE | N1-N7 DONE | H1-H3 DONE | A1-A13 DONE | DL1-DL5 DONE | QS-1–QS-26 DONE | ZM-1–ZM-6 DONE | IC-1–IC-3 DONE ✅`

### IC — Image Clamp (left-edge barrier on zoom)
- [x] IC-1: `constants/bannerTemplate.ts` — add `IMAGE_LEFT_BARRIER`
- [x] IC-2: `components/BannerPreview/BannerPreview.tsx` — clamp `left` to keep left edge ≥ barrier
- [x] IC-3: `BannerPreview.test.tsx` — 4 tests: no-clamp, active-clamp ×2, property invariant (137 passing)

### ZM — Image Zoom Sliders
- [x] ZM-1: `types/index.ts` — add `logoScale`, `productImageScale` to `BannerState`
- [x] ZM-2: `useBannerState.tsx` — state + setters + reset on `selectProduct`
- [x] ZM-3: `BannerControls.tsx` — `ZoomSlider` sub-component + new props
- [x] ZM-4: `BannerPreview.tsx` — apply `transform: scale()` to logo + product image
- [x] ZM-5: `App.tsx` — wire new state fields + props
- [x] ZM-6: Tests — `BannerControls`, `useBannerState`

### QS-26 ✅ Fix quantity sticker showing "1 unit" for multi-pack products
- Suppress ONDC generic placeholder `{ unit:"unit", value:"1" }` in `catalogueParser.ts`
- Fallback: extract "Pack of N" via regex from product name / shortDesc
- 8 new tests covering suppression, regex extraction, case insensitivity, priority order

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

----------------------------------------

----------------------------------------

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

----------------------------------------

----------------------------------------

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

---

## Subheading Text When Price Off — Implementation Plan

**Overall Progress:** `100%`

**Context:** When the user toggles price off, the subheading area (y:170, 45px tall, maxWidth:320) is left empty. This feature lets the user enter custom single-line text in that space. The text renders at Inter 600, 28px, black. The input starts empty — the area stays blank until the user types something.

### Critical Decisions
- **Positioning:** Reuse existing `SUBHEADING` constants (x:40, y:170, maxWidth:320) — no new layout math needed
- **Single-line enforcement:** Block Enter key in the input + `white-space: nowrap` / `overflow: hidden` on the banner render, constrained to `maxWidth: 320px`
- **State lifecycle:** Clear `subheadingText` when product changes (same pattern as `productNameOverride`). Preserve it across price toggles so users don't lose text if they toggle back and forth

### Tasks

- [x] 🟩 **Step S1: Add type + constant definitions** ✅ DONE
  - [x] 🟩 Add `subheadingText: string` to `BannerState` in `src/types/index.ts`
  - [x] 🟩 Add `SUBHEADING_TEXT` styling constants to `src/constants/bannerTemplate.ts` — `fontSize: 28`, `fontWeight: 600`, `color: '#000000'`, `fontFamily: '"Inter", sans-serif'`

- [x] 🟩 **Step S2: Add state management** ✅ DONE
  - [x] 🟩 Add `subheadingText` state (default `''`) + `setSubheadingText` setter in `src/hooks/useBannerState.tsx`
  - [x] 🟩 Reset `subheadingText` to `''` inside `selectProduct` callback (alongside existing `setProductNameOverride(null)`)
  - [x] 🟩 Expose in `BannerContextType` interface and context value object

- [x] 🟩 **Step S3: Wire through App.tsx** ✅ DONE
  - [x] 🟩 Destructure `subheadingText` and `setSubheadingText` from `useBannerState()`
  - [x] 🟩 Include `subheadingText` in the `bannerState` useMemo object
  - [x] 🟩 Pass `subheadingText` and `onSubheadingTextChange={setSubheadingText}` to `<BannerControls>`

- [x] 🟩 **Step S4: Add input UI in BannerControls** ✅ DONE
  - [x] 🟩 Add `subheadingText: string` and `onSubheadingTextChange: (text: string) => void` to `BannerControlsProps`
  - [x] 🟩 Inside the Price `<Section>`, when `!showPrice`: render a text input (placeholder `"Enter subheading..."`, `input-base` class)
  - [x] 🟩 Block Enter key via `onKeyDown` to enforce single-line

- [x] 🟩 **Step S5: Render subheading text in BannerPreview** ✅ DONE
  - [x] 🟩 Destructure `subheadingText` from `state`
  - [x] 🟩 Import `SUBHEADING` constant (already exists in `bannerTemplate.ts`)
  - [x] 🟩 When `!showPrice && subheadingText`: render a `<div>` at `SUBHEADING.x` / `SUBHEADING.y` with `SUBHEADING_TEXT` styling, `whiteSpace: 'nowrap'`, `overflow: 'hidden'`, `maxWidth: SUBHEADING.maxWidth`

- [x] 🟩 **Step S6: Build & verify** ✅ DONE
  - [x] 🟩 `npm run build` — type-check passes
  - [x] 🟩 `npm run test:run` — all existing tests pass
  - [x] 🟩 Manual: toggle price off → type text → renders single-line at correct position/style → toggle price on → text preserved → switch product → text cleared

### Edge Cases

| Scenario | Behavior |
|---|---|
| Price toggled on | Subheading input hidden, price displays normally |
| Price toggled off, no text entered | Subheading area stays empty |
| Price toggled off, text entered | Text renders at Inter 600, 28px, black in subheading area |
| Text exceeds 320px width | Clipped via `overflow: hidden` + `white-space: nowrap` |
| User presses Enter in input | Blocked — no newlines allowed |
| User toggles price on then off again | Previously entered text is preserved |
| User switches product | Subheading text reset to `''` |

### Files Modified

| File | Change |
|---|---|
| `src/types/index.ts` | Add `subheadingText: string` to `BannerState` |
| `src/constants/bannerTemplate.ts` | Add `SUBHEADING_TEXT` styling constants |
| `src/hooks/useBannerState.tsx` | Add state + setter + reset on product switch |
| `src/components/BannerControls/BannerControls.tsx` | Add subheading text input when price is off |
| `src/components/BannerPreview/BannerPreview.tsx` | Render subheading text when price off + text non-empty |
| `src/App.tsx` | Wire `subheadingText` and `setSubheadingText` through props + state |

### Files NOT Modified

- `src/services/exportService.ts` — subheading renders as part of BannerPreview DOM
- `src/services/catalogueParser.ts` — catalogue data unchanged
- `src/services/searchService.ts` — search unchanged
- `src/services/removeBackgroundService.ts` — unchanged
- `src/constants/backgrounds.ts` — unchanged
- All test files — no new tests needed (build + existing tests cover regressions)

---

## Toggleable Elements + Image Upload + Dynamic Layout — Implementation Plan

**Overall Progress:** `100%`

**Context:** Make all left-section banner elements toggleable (logo, heading, CTA — price/badge/T&C already done). Add file upload + clipboard paste for brand logo and product image. Rewrite left-section layout from hardcoded absolute `y` positions to dynamically computed vertical centering with preset gaps.

### Critical Decisions

- **Dynamic layout via JS computation, not CSS flexbox** — Elements still use `position: absolute` but `top` values are computed at render time based on which elements are visible. Preserves the existing rendering model (important for html-to-image export) while making positions dynamic.
- **Preset gaps between adjacent visible elements** — `LOGO→HEADING: 15`, `HEADING→SUBHEADING: 15`, `SUBHEADING→CTA: 20`, `CTA→T&C: 8`. When an element is hidden, its neighbors collapse together using the gap of the earlier element.
- **Reusable ImageUploadZone component** — Shared by both logo and product image sections. Rectangular dashed-border zone with Upload (file input) + Paste (`navigator.clipboard.read()`) buttons; shows thumbnail + Remove when image is set.
- **Blob URLs stored in existing override fields** — `brandLogoOverride` (already exists) stores uploaded logo blob URLs. New `productImageOverride` stores uploaded product image blob URLs. Both reset on product switch.
- **Image override priority chain** — Logo: `bgRemovedLogoUrl > brandLogoOverride > catalogue logo`. Product: `bgRemovedProductUrl > productImageOverride > catalogue imageUrl`. Remove-bg always processes the current effective image.
- **All overrides reset on product switch** — `brandLogoOverride`, `productImageOverride`, `productNameOverride`, `priceOverride`, `subheadingText` all clear when user selects a different product. Prevents stale blob URLs and cross-product state bleed.

### Element Heights (for dynamic layout computation)

| Element | Height | Source |
|---|---|---|
| Logo | 40px | `BRAND_LOGO.height` |
| Heading | `actualLines * headingFontSize * 1.2` | Measured via existing adaptive sizing `useEffect` |
| Subheading/Price | 50px | `SUBHEADING.height` |
| CTA | 38px | `paddingY*2 + fontSize*lineHeight` = `8*2 + 20*1.1` |
| T&C | 12px | `fontSize * ~1.2` = `10 * 1.2` |

**With all elements + gaps:** 40+15+77+15+50+20+38+8+12 = **275px** → `startY = (312-275)/2 ≈ 18px`

### Tasks

- [x] 🟩 **Step T1: Update type definitions** ✅ DONE
  - [x] 🟩 Add `showLogo: boolean`, `showHeading: boolean`, `showCta: boolean` to `BannerState`
  - [x] 🟩 Add `productImageOverride: string | null` to `BannerState`

- [x] 🟩 **Step T2: Add layout gap constants** ✅ DONE
  - [x] 🟩 Add `LEFT_SECTION_GAPS` to `bannerTemplate.ts`: `{ 'logo-heading': 15, 'heading-subheading': 10, 'subheading-cta': 15, 'cta-tnc': 8 }`
  - [x] 🟩 Add `CTA_HEIGHT` and `TNC_HEIGHT` computed constants for use in layout calculation
  - [x] 🟩 Keep existing hardcoded `y` values in constants (backward compat) — BannerPreview will stop using them

- [x] 🟩 **Step T3: Update state management** ✅ DONE
  - [x] 🟩 Add `showLogo` (default `true`), `showHeading` (default `true`), `showCta` (default `true`) state + toggle callbacks in `useBannerState`
  - [x] 🟩 Add `productImageOverride: string | null` state (default `null`) + setter
  - [x] 🟩 In `selectProduct`: reset `brandLogoOverride` to `null` and `productImageOverride` to `null` (alongside existing resets)
  - [x] 🟩 Expose all new state + setters + toggles in `BannerContextType`

- [x] 🟩 **Step T4: Create ImageUploadZone component** ✅ DONE
  - [x] 🟩 Create `src/components/ImageUploadZone/ImageUploadZone.tsx`
  - [x] 🟩 Props: `currentImage: string | null`, `onImageChange: (blobUrl: string | null) => void`, `label: string`
  - [x] 🟩 **No image state:** Dashed-border rectangle with Upload + Paste buttons
  - [x] 🟩 **Image set state:** Thumbnail preview + Remove button
  - [x] 🟩 Revoke old blob URL before creating a new one (check `currentImage?.startsWith('blob:')`)

- [x] 🟩 **Step T5: Update BannerControls** ✅ DONE
  - [x] 🟩 Add props: `showLogo`, `onLogoToggle`, `showHeading`, `onHeadingToggle`, `showCta`, `onCtaToggle`, `productImageOverride`, `onProductImageChange`, `onBrandLogoChange`
  - [x] 🟩 **Brand Logo section** (new, at top): `TogglePill` for `showLogo` + `ImageUploadZone` for logo upload
  - [x] 🟩 **Product Name section**: Add `TogglePill` for `showHeading` above the existing text input
  - [x] 🟩 **CTA Button section**: Add `TogglePill` for `showCta` above the existing text input + presets
  - [x] 🟩 **Product Image section** (new, at bottom): `ImageUploadZone` for product image upload
  - [x] 🟩 Remove old brand logo URL text input (replaced by ImageUploadZone)

- [x] 🟩 **Step T6: Rewrite BannerPreview dynamic layout** ✅ DONE
  - [x] 🟩 Destructure `showLogo`, `showHeading`, `showCta`, `productImageOverride` from `state`
  - [x] 🟩 Build visible elements list with `{ id, height }` entries
  - [x] 🟩 Compute gaps between consecutive visible elements via `LEFT_SECTION_GAPS` lookup
  - [x] 🟩 Compute startY for vertical centering: `(BANNER_HEIGHT - totalHeight) / 2`
  - [x] 🟩 Assign positions by walking through visible elements
  - [x] 🟩 Replace hardcoded `top` values with computed positions
  - [x] 🟩 Product image uses `productImageOverride ?? selectedProduct.imageUrl`

- [x] 🟩 **Step T7: Wire through App.tsx** ✅ DONE
  - [x] 🟩 Destructure new state and setters/toggles from `useBannerState()`
  - [x] 🟩 Add `showLogo`, `showHeading`, `showCta`, `productImageOverride` to `bannerState` useMemo
  - [x] 🟩 Add `useEffect` to reset `bgRemovedProductUrl` when `productImageOverride` changes
  - [x] 🟩 Update `handleRemoveBackground` to use effective image URLs
  - [x] 🟩 Pass new toggle props + image override props to `<BannerControls>`

- [x] 🟩 **Step T8: Build & verify** ✅ DONE
  - [x] 🟩 `npm run build` — type-check passes
  - [x] 🟩 `npm run test:run` — all 49 tests pass
  - [ ] ⬜ Manual: Toggle each element off → banner reflows, elements center vertically
  - [ ] ⬜ Manual: Upload logo image → replaces catalogue logo on banner
  - [ ] ⬜ Manual: Paste product image → replaces catalogue image on banner
  - [ ] ⬜ Manual: Switch product → all overrides reset, blob URLs cleaned up
  - [ ] ⬜ Manual: Export banner → uploaded images render correctly in export

### Edge Cases

| Scenario | Behavior |
|---|---|
| All left elements toggled off | Left half of banner is empty (background only) |
| Only CTA visible | CTA centered vertically at `(312-38)/2 ≈ 137px` |
| Logo toggled off, heading visible | Heading moves up, centered without logo's height contribution |
| CTA off, T&C on | T&C renders alone at the bottom of the visible stack |
| CTA off, T&C off | Neither renders; remaining elements (logo, heading, price) center |
| No catalogue logo, user uploads one | Uploaded image shows as logo; toggling off hides it |
| No catalogue product image, user uploads | Uploaded image renders in right half of banner |
| User uploads then clicks Remove | Image cleared, reverts to catalogue image (or empty) |
| Clipboard has no image on paste | No-op, no error (graceful fallback) |
| User uploads then switches product | Blob URL revoked, override reset to null |
| Remove Background after upload | Processes the uploaded image (effective URL), not catalogue original |

### Files Modified

| File | Change |
|---|---|
| `src/types/index.ts` | Add `showLogo`, `showHeading`, `showCta`, `productImageOverride` to `BannerState` |
| `src/constants/bannerTemplate.ts` | Add `LEFT_SECTION_GAPS`, `CTA_HEIGHT`, `TNC_HEIGHT` constants |
| `src/hooks/useBannerState.tsx` | New toggles, `productImageOverride` state, reset overrides on product switch |
| `src/components/ImageUploadZone/ImageUploadZone.tsx` | **New** — reusable upload/paste component |
| `src/components/BannerControls/BannerControls.tsx` | Toggle pills for logo/heading/CTA, upload zones, remove old logo URL input |
| `src/components/BannerPreview/BannerPreview.tsx` | Dynamic vertical layout computation, toggle-aware rendering, product image override |
| `src/App.tsx` | Wire new state, blob lifecycle effects, updated remove-bg handler |

### Files NOT Modified

- `src/services/exportService.ts` — renders whatever is in BannerPreview DOM
- `src/services/catalogueParser.ts` — catalogue data unchanged
- `src/services/searchService.ts` — search unchanged
- `src/services/removeBackgroundService.ts` — API unchanged
- `src/constants/backgrounds.ts` — unchanged
- `src/components/ProductSearch/ProductSearch.tsx` — unchanged
- `src/components/ExportPanel/ExportPanel.tsx` — unchanged
- `src/components/LogsPanel/LogsPanel.tsx` — unchanged
- `src/components/BackgroundGallery/BackgroundGallery.tsx` — unchanged

---

## Separate Subheading from Price — Independent Subheading Element + Compact Heading Mode

**Overall Progress:** `100%`

**Context:** The current "subheading" slot conflates two concepts: the price display and a fallback custom text. This plan separates them into two independent elements — a true **Subheading** (new) and a renamed **Price** (current "subheading"). When Subheading is toggled ON, the heading enters compact mode (28px, Inter 600, single line) and spacing tightens. All elements remain independently toggleable and dynamically centered.

### Critical Decisions

- **Rename `'subheading'` → `'price'` in ElementId** — the current layout slot that shows prices gets its correct name
- **New `'subheading'` ElementId** — inserted between heading and price in the layout stack
- **`subheadingText` state repurposed** — previously shown "when price is off"; now shown "when showSubheading is on" (independent of price toggle)
- **Heading has two modes:**
  - **Normal** (showSubheading OFF): adaptive 32→22px, weight 800, max 2 lines (existing behavior)
  - **Compact** (showSubheading ON): fixed 28px, weight 600, max 1 line, truncate with `...`
- **MRP font size updated** from 24px to 28px per new visual spec
- **New `showSubheading` toggle** (default `false`) — independent of price toggle, both can be ON simultaneously

### Layout Stack Reference

**Subheading OFF (current behavior, no change):**
```
Logo
  ↕ 10px
Heading (adaptive 32→22px, Inter 800, max 2 lines)
  ↕ 15px
Price (₹MRP 28px/500 strikethrough + ₹selling 36px/700)
  ↕ 15px
CTA
  ↕ 3px
T&C
```

**Subheading ON:**
```
Logo
  ↕ 10px
Heading (28px Inter 600, 1 line — COMPACT MODE)
  ↕ 10px
Subheading (24px Inter 400)
  ↕ 10px
Price (₹MRP 28px/500 strikethrough + ₹selling 36px/700)
  ↕ 15px
CTA
  ↕ 3px
T&C
```

### Gap Table (updated)

```
'logo-heading':       10   (unchanged)
'heading-subheading': 10   (new — compact heading to subheading)
'heading-price':      15   (renamed from old 'heading-subheading')
'subheading-price':   10   (new — subheading to price)
'subheading-cta':     10   (new — subheading to CTA when price is off)
'price-cta':          15   (renamed from old 'subheading-cta')
'cta-tnc':             3   (unchanged)
```

### Tasks

- [x] 🟩 **Step N1: Update bannerTemplate.ts — constants & gap table** ✅ DONE
  - [x] 🟩 Update `SUBHEADING_TEXT` styling to new values: `fontSize: 24, fontWeight: 400` (was 28/700)
  - [x] 🟩 Update `PRICE_DISPLAY.mrp.fontSize` from `24` → `28`
  - [x] 🟩 Add `HEADING_COMPACT` constant: `{ fontSize: 28, fontWeight: 600, lineHeight: 1.2, maxLines: 1 }`
  - [x] 🟩 Replace `LEFT_SECTION_GAPS` with updated gap table (see above)
  - [x] 🟩 Update `SUBHEADING_TEXT_HEIGHT` — now `24` (tracks new `SUBHEADING_TEXT.fontSize`)
  - [x] 🟩 `PRICE_HEIGHT` unchanged (still `sellingPrice.fontSize` = 36)

- [x] 🟩 **Step N2: Update types/index.ts** ✅ DONE
  - [x] 🟩 Add `showSubheading: boolean` to `BannerState`

- [x] 🟩 **Step N3: Update useBannerState.tsx** ✅ DONE
  - [x] 🟩 Add `showSubheading` state (default `false`)
  - [x] 🟩 Add `toggleSubheading` callback
  - [x] 🟩 Expose both in `BannerContextType` and context value

- [x] 🟩 **Step N4: Update BannerPreview.tsx — layout engine + rendering** ✅ DONE
  - [x] 🟩 Update `ElementId` type: `'logo' | 'heading' | 'subheading' | 'price' | 'cta' | 'tnc'`
  - [x] 🟩 Update `getGapBetween()` ordered list to `['logo', 'heading', 'subheading', 'price', 'cta', 'tnc']`
  - [x] 🟩 **Conditional heading config:** when `showSubheading` is true, use `HEADING_COMPACT` values in the adaptive sizing `useEffect` (fixed 28px, weight 600, maxLines 1); otherwise existing normal config
  - [x] 🟩 Destructure `showSubheading` from `state`
  - [x] 🟩 Update `visibleElements`:
    - Add `{ id: 'subheading', height: SUBHEADING_TEXT_HEIGHT }` when `showSubheading && subheadingText`
    - Rename old subheading entry to `{ id: 'price', height: PRICE_HEIGHT }` when `showPrice && displayPrice`
  - [x] 🟩 Update position references: `positions.subheading` for new subheading, `positions.price` for price display
  - [x] 🟩 Add render block for new subheading element (24px Inter 400, `SUBHEADING.x`, `positions.subheading`)
  - [x] 🟩 Update price render to use `positions.price` (was `positions.subheading`)
  - [x] 🟩 **Remove** old "subheading text when price off" render block — subheading text is now its own independent element

- [x] 🟩 **Step N5: Update BannerControls.tsx** ✅ DONE
  - [x] 🟩 Add new "Subheading" section (between Product Name and Background):
    - `TogglePill` for `showSubheading`
    - Text input for `subheadingText` when `showSubheading` is ON
    - Block Enter key (single-line only)
  - [x] 🟩 **Remove** subheading text input from Price section (was shown when `!showPrice` — that behavior is replaced by the new independent Subheading section)
  - [x] 🟩 Add new props: `showSubheading: boolean`, `onSubheadingToggle: () => void`

- [x] 🟩 **Step N6: Wire through App.tsx** ✅ DONE
  - [x] 🟩 Destructure `showSubheading` and `toggleSubheading` from `useBannerState()`
  - [x] 🟩 Add `showSubheading` to `bannerState` useMemo
  - [x] 🟩 Pass `showSubheading` and `onSubheadingToggle={toggleSubheading}` to `<BannerControls>`

- [x] 🟩 **Step N7: Build & verify** ✅ DONE
  - [x] 🟩 `npm run build` — type-check passes
  - [x] 🟩 `npm run test:run` — all 49 tests pass
  - [ ] ⬜ Manual: Subheading OFF → layout identical to before (no regressions)
  - [ ] ⬜ Manual: Subheading ON → heading shrinks to 28px/600/1-line, subheading appears below it
  - [ ] ⬜ Manual: Subheading ON + Price ON → both visible with 10px gaps
  - [ ] ⬜ Manual: Subheading ON + Price OFF → subheading visible, no price
  - [ ] ⬜ Manual: Toggle each element off → layout reflows correctly
  - [ ] ⬜ Manual: Export banner with subheading → renders correctly

### Visibility Combinations

| Subheading | Price | Heading Mode | Layout |
|---|---|---|---|
| OFF | ON | Normal (adaptive 32→22px, 800, 2 lines) | Logo → Heading → Price → CTA → T&C |
| OFF | OFF | Normal | Logo → Heading → CTA → T&C |
| ON | ON | Compact (28px, 600, 1 line) | Logo → Heading → Subheading → Price → CTA → T&C |
| ON | OFF | Compact (28px, 600, 1 line) | Logo → Heading → Subheading → CTA → T&C |

### Edge Cases

| Scenario | Behavior |
|---|---|
| Subheading ON, text empty | Subheading element not in layout (no blank space) |
| Subheading ON, heading too long for 1 line at 28px | Truncated with `...` (single line enforced) |
| Subheading ON, all other elements OFF | Only subheading visible, centered vertically |
| Toggle subheading OFF then ON | Text preserved (not cleared on toggle) |
| Switch product while subheading ON | `subheadingText` reset to `''` (existing behavior), heading mode stays compact |
| Both subheading and price OFF | Neither appears in layout; heading stays compact if subheading toggle is ON |

### Files Modified

| File | Change |
|---|---|
| `src/constants/bannerTemplate.ts` | Update `SUBHEADING_TEXT` (24/400), update `PRICE_DISPLAY.mrp.fontSize` (28), add `HEADING_COMPACT`, update gap table |
| `src/types/index.ts` | Add `showSubheading: boolean` to `BannerState` |
| `src/hooks/useBannerState.tsx` | Add `showSubheading` state + `toggleSubheading` |
| `src/components/BannerPreview/BannerPreview.tsx` | New `'subheading'` + `'price'` ElementIds, conditional heading mode, new subheading render, price uses `positions.price` |
| `src/components/BannerControls/BannerControls.tsx` | New Subheading section with toggle + input, remove old subheading-text-when-price-off |
| `src/App.tsx` | Wire `showSubheading` and `toggleSubheading` |

### Files NOT Modified

- `src/services/exportService.ts` — renders BannerPreview DOM as-is
- `src/services/catalogueParser.ts` — catalogue data unchanged
- `src/services/searchService.ts` — search unchanged
- `src/services/removeBackgroundService.ts` — unchanged
- `src/constants/backgrounds.ts` — unchanged
- `src/components/ImageUploadZone/ImageUploadZone.tsx` — unchanged
- `src/components/ProductSearch/ProductSearch.tsx` — unchanged
- `src/components/ExportPanel/ExportPanel.tsx` — unchanged
- `src/components/LogsPanel/LogsPanel.tsx` — unchanged
- `src/components/BackgroundGallery/BackgroundGallery.tsx` — unchanged
- All test files — no new tests needed (build + existing tests cover regressions)

---

## Fix Element Height Mismatches — Explicit Heights for Pixel-Perfect Spacing

**Overall Progress:** `100%`

**Context:** The dynamic layout engine in `BannerPreview.tsx` computes vertical positions by summing estimated element heights + gap values from `LEFT_SECTION_GAPS`. However, the rendered DOM elements don't enforce those exact heights — most lack explicit `height` and `lineHeight` styles. When the browser renders text with its default `lineHeight` (~1.2), elements become taller than the layout engine assumed, causing visible gaps to differ from the defined gap values.

**Root cause:** The layout engine assumes `SUBHEADING_TEXT_HEIGHT = 24` (fontSize only), but the browser renders the subheading at ~29px (fontSize x default lineHeight 1.2). This 5px discrepancy cascades to every gap below the subheading. Similar (smaller) mismatches exist on other text elements.

**Fix principle:** Every rendered element's actual DOM height must exactly match the height constant the layout engine uses. We achieve this by:
1. Adding explicit `lineHeight` to constants that lack it, so the height formula is deterministic
2. Setting explicit `height` + `overflow: hidden` on every rendered element in `BannerPreview.tsx`

### Mismatch Analysis

| Element | Layout Height Constant | Current Rendered lineHeight | Actual vs Expected | Fix |
|---|---|---|---|---|
| Logo | `BRAND_LOGO.height` (40) | N/A (img) | 40 = 40 | Already has explicit `height` |
| Heading | `headingHeight` (DOM measured) | `headingConfig.lineHeight` (1.2) | ~matched | Add explicit `height: headingHeight` |
| Subheading | `SUBHEADING_TEXT_HEIGHT` (24) | **None** -> browser ~1.2 | **~29 != 24** | Add `lineHeight: 1` to constant + explicit `height` |
| Price | `PRICE_HEIGHT` (32) | 1 (on spans) | ~32 | Add explicit `height` on flex container |
| CTA | `CTA_HEIGHT` (38) | 1.1 | 38 = 38 | Add `height` + `boxSizing: 'border-box'` for safety |
| T&C | `TNC_HEIGHT` (12) | **None** -> browser ~1.2 | ~12 | Add `lineHeight: 1.2` to constant + explicit `height` |

### Tasks

- [x] 🟩 **Step H1: Add lineHeight to text constants in bannerTemplate.ts** ✅ DONE
  - [x] 🟩 Add `lineHeight: 1` to `SUBHEADING_TEXT` — ensures height = fontSize x 1 = 24 = `SUBHEADING_TEXT_HEIGHT`
  - [x] 🟩 Add `lineHeight: 1.2` to `TNC_TEXT` — ensures height = fontSize x 1.2 = 12 = `TNC_HEIGHT`
  - [x] 🟩 Add `lineHeight: 1` to `PRICE_DISPLAY.mrp` and `PRICE_DISPLAY.sellingPrice` — codifies the lineHeight already used in JSX
  - [x] 🟩 No formula changes needed — height constants all still compute correctly

- [x] 🟩 **Step H2: Apply explicit heights + lineHeights on rendered elements in BannerPreview.tsx** ✅ DONE
  - [x] 🟩 **Heading**: Add `height: headingHeight` to the heading div style (already has `overflow: 'hidden'`)
  - [x] 🟩 **Subheading**: Add `lineHeight: SUBHEADING_TEXT.lineHeight`, `height: SUBHEADING_TEXT_HEIGHT`, `overflow: 'hidden'`
  - [x] 🟩 **Price**: Add `height: PRICE_HEIGHT`, `overflow: 'hidden'` on flex container; use `lineHeight` from constants on both spans
  - [x] 🟩 **CTA**: Add `height: CTA_HEIGHT`, `boxSizing: 'border-box' as const` (CTA_HEIGHT includes padding)
  - [x] 🟩 **T&C**: Add `lineHeight: TNC_TEXT.lineHeight`, `height: TNC_HEIGHT`, `overflow: 'hidden'`

- [x] 🟩 **Step H3: Build & verify** ✅ DONE
  - [x] 🟩 `npm run build` — type-check passes
  - [x] 🟩 `npm run test:run` — all 51 tests pass
  - [ ] ⬜ Manual: Visual gaps now match `LEFT_SECTION_GAPS` values exactly
  - [ ] ⬜ Manual: All toggle combinations still work correctly
  - [ ] ⬜ Manual: Long text truncates properly (doesn't overflow explicit heights)
  - [ ] ⬜ Manual: Export renders correctly

### Files Modified

| File | Change |
|---|---|
| `src/constants/bannerTemplate.ts` | Add `lineHeight` to `SUBHEADING_TEXT` (1), `TNC_TEXT` (1.2), `PRICE_DISPLAY.mrp` (1), `PRICE_DISPLAY.sellingPrice` (1) |
| `src/components/BannerPreview/BannerPreview.tsx` | Add explicit `height` + `overflow: hidden` to heading, subheading, price, CTA, T&C render blocks; use `lineHeight` from constants |

### Files NOT Modified

- `src/types/index.ts` — no type changes
- `src/hooks/useBannerState.tsx` — no state changes
- `src/components/BannerControls/BannerControls.tsx` — no control changes
- `src/App.tsx` — no wiring changes
- All service and test files — unchanged

---

## Live API Integration — Provider → Product Two-Step Flow

**Overall Progress:** `Steps A1-A13 DONE`

**Context:** Replace the static JSON catalogue (114 products from local files) with live API calls to Digihaat's production catalogue search endpoint, enabling access to millions of D2C products across 46 BPPs and 7 domains. The current single-search UX becomes a two-step flow: user picks BPP + domain → browses/searches providers → selects a provider → browses/searches products → selects a product → generates banner. All downstream banner logic (preview, export, controls) remains unchanged — only the data source and product discovery UI change.

### Critical Decisions

- **Single API endpoint, different params** — both provider search and product fetch use `GET https://prod.digihaat.in/analyticsDashboard/catalog/search` with different query params. No separate "list providers" endpoint.
- **No auth required** — APIs are open, direct browser `fetch()` calls OK (no CORS issues). If auth is added later, the abstracted `apiService` layer makes adding a proxy trivial.
- **Config-driven BPP + domain lists** — 46 BPPs and 7 domains stored in `src/constants/apiConfig.ts` as plain arrays, editable without code changes.
- **Sequential selection flow** — BPP dropdown → Domain dropdown → Provider list → Product list. Each stage depends on the previous.
- **Provider extraction from item results** — the API returns catalogue items, not a provider list. Unique providers are extracted by deduplicating on `provider_details.id`. Each item carries provider metadata (`name`, `logo`, `total_items`, `city`, `state`).
- **Debounced provider search** — provider name search debounces API calls (~300ms) to avoid hammering the endpoint.
- **Paginated lists** — both provider discovery and product browsing support `page` + `pageSize` params. UI uses "Load more" buttons.
- **AbortController for stale requests** — changing BPP, domain, or search while a request is in flight cancels the previous request to prevent race conditions.
- **New `parseApiItems()` parser** — the API returns structured `item_details` and `provider_details` objects (not stringified JSON). A new parser function handles this shape. Shared logic (`groupProducts()`, `formatPrice()`, `getProductsWithMissingImages()`) is preserved.
- **Remove static catalogue flow entirely** — `CATALOGUE_URLS`, `RawCatalogueEntry`, `parseCatalogue()`, `useCatalogue` hook, and static JSON files in `public/catalogue/` and `catalogue/` are deleted. No fallback.

### API Reference

**Endpoint:** `GET https://prod.digihaat.in/analyticsDashboard/catalog/search`

**Response shape:**
```json
{
  "data": [ ...items ],
  "total": 39,
  "page": 1,
  "pageSize": 50,
  "totalPages": 1
}
```

| Use Case | Required Params | Optional Params |
|---|---|---|
| Search providers | `bpp_id`, `domain`, `page`, `pageSize` | `search` (provider name filter) |
| Fetch products by provider | `provider_unique_id`, `page`, `pageSize` | — |

**API item shape (relevant fields):**
```
{
  id: string,                        // composite unique ID
  item_id: string,                   // product ID
  item_name: string,                 // product name
  price: number,                     // selling price
  mrp: number,                       // max retail price
  discount_percentage: number,
  in_stock: boolean,
  category: string,
  city: string,
  state: string,
  bpp_id: string,
  provider_name: string,
  total_items: number,               // total items for this provider
  enabled_items: number,
  item_details: {                    // structured (NOT stringified)
    descriptor: { name, images[], symbol, long_desc, short_desc },
    price: { value, maximum_value, currency, discount_percentage },
    quantity: { available, maximum, unitized },
    tags: [{ code, list: [{ code, value }] }],
    ...
  },
  provider_details: {
    id: string,                      // THIS is the provider_unique_id
    descriptor: { name, symbol, images[], long_desc, short_desc },
    rating: string
  }
}
```

### Config Data

**BPP IDs** (46 entries, stored as `BPP_OPTIONS: string[]`):
```
Rebel Foods, Kiko Live, bitsila, Tipplr, WAAYU, Fynd, Shikhar Store, Snapdeal, Mystore,
Bizom, Wcommerce, nLincs, Localekart, Green Receipt, ninjacart, UNIZAP, Vikra,
COSTBO SERVICES, channelier, Polestarre, Addble, Aavishk Sustainable Solutions Private Limited,
Valar Digital Commerce Private Limited, Shiprocket, smartsell.samhita.org, Xpressbaazaar,
Shiv Shankar SHG, Sabhyasha Retail Tech Private Limited, ShopEG, Globallinker Mall,
Indiahandmade Store, KAS commerce, ONDC Hub, Primarc Pecan, The Body Shop, Himira,
M/s Parasram Jajee, Webkul, Bamboology Pvt Ltd, UniSouk ONDC, Mooogly, Yuukke Market Place,
Eatanytime, Nirlim Studio, Shopclues, MAGICPIN
```

**Domains** (7 entries, stored as `DOMAIN_OPTIONS: { code: string; label: string }[]`):

| Code | Label |
|---|---|
| `ONDC:RET10` | Grocery |
| `ONDC:RET12` | Fashion |
| `ONDC:RET13` | Beauty & Personal Care |
| `ONDC:RET14` | Electronics |
| `ONDC:RET15` | Appliances |
| `ONDC:RET16` | Home & Kitchen |
| `ONDC:RET18` | Health & Wellness |

### UX Flow (Left Sidebar)

**Stage 1 — Provider Selection (no provider selected):**
```
┌─────────────────────────┐
│ DIGIHAAT BANNER         │ ← header
├─────────────────────────┤
│ [Export Panel]          │
├─────────────────────────┤
│ [BPP Dropdown ▼]       │ ← searchable, 46 options
│ [Domain Dropdown ▼]    │ ← 7 options
│ [🔍 Search providers...] │ ← debounced API search
├─────────────────────────┤
│ NSC Seeds Corp    (39) │ ← provider name + item count
│ ABC Organics      (12) │
│ XYZ Fresh         (87) │
│ ...                     │
│ [Load more]             │ ← pagination
└─────────────────────────┘
```

**Stage 2 — Product Selection (provider selected):**
```
┌─────────────────────────┐
│ ← Back to providers     │ ← click to deselect provider
│ NSC Seeds Corp          │ ← selected provider name
├─────────────────────────┤
│ [🔍 Search products...] │ ← client-side filter on loaded products
├─────────────────────────┤
│ ○ Chrysanthemum    ₹40 │ ← product list (grouped)
│   └ White variant  ₹35 │
│ ○ Gazania Mix     ₹130 │
│ ...                     │
│ [Load more]             │ ← pagination for products
└─────────────────────────┘
```

### Tasks

- [x] 🟩 **Step A1: Create API configuration constants** ✅ DONE
  - [x] 🟩 Create `src/constants/apiConfig.ts`
  - [x] 🟩 Export `API_BASE_URL = 'https://prod.digihaat.in/analyticsDashboard/catalog/search'`
  - [x] 🟩 Export `BPP_OPTIONS: string[]` — array of 46 BPP ID strings (alphabetically sorted for dropdown)
  - [x] 🟩 Export `DOMAIN_OPTIONS: { code: string; label: string }[]` — 7 domain entries
  - [x] 🟩 Export `DEFAULT_PAGE_SIZE = 50` — default page size for API requests

- [x] 🟩 **Step A2: Add API-related types** ✅ DONE
  - [x] 🟩 In `src/types/index.ts`:
  - [x] 🟩 Add `ApiCatalogItem` interface — shape of one item from API response (all relevant fields: `id`, `item_id`, `item_name`, `price`, `mrp`, `in_stock`, `item_details`, `provider_details`, `total_items`, `enabled_items`, `city`, `state`, etc.)
  - [x] 🟩 Add `ApiPaginatedResponse<T>` generic interface — `{ data: T[], total: number, page: number, pageSize: number, totalPages: number }`
  - [x] 🟩 Add `ApiProvider` interface — extracted unique provider: `{ id: string, name: string, logo: string | null, totalItems: number, enabledItems: number, city: string, state: string }`
  - [x] 🟩 Add `DomainOption` interface — `{ code: string, label: string }`
  - [x] 🟩 Remove `RawCatalogueEntry` interface (no longer needed — static JSON parsing removed)

- [x] 🟩 **Step A3: Create API service** ✅ DONE
  - [x] 🟩 Create `src/services/apiService.ts`
  - [x] 🟩 `searchCatalog(params: { bppId?: string, domain?: string, search?: string, providerUniqueId?: string, page?: number, pageSize?: number }, signal?: AbortSignal): Promise<ApiPaginatedResponse<ApiCatalogItem>>`
    - Builds URL with query params from the params object
    - Passes `signal` to `fetch()` for cancellation via `AbortController`
    - Throws on non-OK response with descriptive error (`HTTP {status}: {statusText}`)
    - Returns parsed JSON as `ApiPaginatedResponse<ApiCatalogItem>`
  - [x] 🟩 Keep it as a single function — both provider search and product fetch use the same endpoint with different params. The hooks decide which params to pass.

- [x] 🟩 **Step A4: Add API response parser + provider extractor** ✅ DONE
  - [x] 🟩 In `src/services/catalogueParser.ts`:
  - [x] 🟩 Add `parseApiItem(item: ApiCatalogItem): ParsedProduct | null` — converts one API item to `ParsedProduct`
  - [x] 🟩 Add `parseApiItems(items: ApiCatalogItem[]): ParsedProduct[]` — maps + deduplicates by item ID
  - [x] 🟩 Add `extractProviders(items: ApiCatalogItem[]): ApiProvider[]` — deduplicates by `provider_details.id`
  - [x] 🟩 Remove `parseCatalogue(entries: RawCatalogueEntry[])` — no longer needed
  - [x] 🟩 Keep `formatPrice()`, `groupProducts()`, `getProductsWithMissingImages()` — unchanged

- [x] 🟩 **Step A5: Create useDebounce utility hook** ✅ DONE
  - [x] 🟩 Create `src/hooks/useDebounce.ts`
  - [x] 🟩 `useDebounce<T>(value: T, delayMs: number): T` — returns the debounced value after `delayMs` of inactivity
  - [x] 🟩 Uses `setTimeout` / `clearTimeout` in a `useEffect`
  - [x] 🟩 Used by `useProviders` to debounce the `search` param

- [x] 🟩 **Step A6: Create useProviders hook** ✅ DONE
  - [x] 🟩 Create `src/hooks/useProviders.ts`
  - [x] 🟩 `useProviders(bppId: string | null, domain: string | null, search: string)`
  - [x] 🟩 State: `providers: ApiProvider[]`, `isLoading: boolean`, `error: string | null`, `page: number`, `totalPages: number`
  - [x] 🟩 Debounces `search` input via `useDebounce(search, 300)`
  - [x] 🟩 AbortController for stale request cancellation
  - [x] 🟩 Reset providers and page on `bppId` or `domain` change
  - [x] 🟩 `loadMore()` callback with dedup against existing providers
  - [x] 🟩 Returns `{ providers, isLoading, error, hasMore, loadMore }`

- [x] 🟩 **Step A7: Create useProviderProducts hook** ✅ DONE
  - [x] 🟩 Create `src/hooks/useProviderProducts.ts`
  - [x] 🟩 `useProviderProducts(providerUniqueId: string | null)`
  - [x] 🟩 AbortController for stale request cleanup
  - [x] 🟩 `parseApiItems(data)` → `groupProducts()` → `getProductsWithMissingImages()` pipeline
  - [x] 🟩 `loadMore()` callback with pagination
  - [x] 🟩 Returns `{ products, groups, isLoading, error, missingImageProducts, hasMore, loadMore }`

- [x] 🟩 **Step A8: Create ProviderSearch component** ✅ DONE
  - [x] 🟩 Create `src/components/ProviderSearch/ProviderSearch.tsx`
  - [x] 🟩 BPP Dropdown (searchable, 65 options), Domain Dropdown (7 ONDC categories)
  - [x] 🟩 Provider Search Input with magnifier icon
  - [x] 🟩 Provider List with name, item count, city/state
  - [x] 🟩 Load More, Loading, Error, and Empty states
  - [x] 🟩 Styled with existing design system tokens

- [x] 🟩 **Step A9: Adapt ProductSearch for API-loaded data** ✅ DONE
  - [x] 🟩 "Back to providers" header with selected provider name
  - [x] 🟩 `hasMore` and `onLoadMore` props for pagination
  - [x] 🟩 `isLoading` prop for loading state
  - [x] 🟩 Kept existing client-side search, ProductItem, and group rendering

- [x] 🟩 **Step A10: Update App.tsx — wire new two-stage flow** ✅ DONE
  - [x] 🟩 Removed `CATALOGUE_URLS` and `useCatalogue` call
  - [x] 🟩 Added provider selection state (`selectedBpp`, `selectedDomain`, `providerSearch`, `selectedProvider`)
  - [x] 🟩 Wired `useProviders` and `useProviderProducts` hooks
  - [x] 🟩 Two-stage sidebar: ProviderSearch (stage 1) → ProductSearch (stage 2)
  - [x] 🟩 `handleSelectProvider` and `handleBackToProviders` callbacks
  - [x] 🟩 All existing banner logic unchanged

- [x] 🟩 **Step A11: Remove old static catalogue code** ✅ DONE
  - [x] 🟩 Delete `src/hooks/useCatalogue.ts`
  - [x] 🟩 Delete `public/catalogue/*.json` (static catalogue files)
  - [x] 🟩 Delete `catalogue/*.json` (source catalogue files)
  - [x] 🟩 `parseCatalogue()` removed in Step A4
  - [x] 🟩 `RawCatalogueEntry` removed in Step A2

- [x] 🟩 **Step A12: Update tests** ✅ DONE
  - [x] 🟩 `catalogueParser.test.ts`: Removed `parseCatalogue()` tests, added `parseApiItem()`, `parseApiItems()`, `extractProviders()` tests
  - [x] 🟩 Kept `groupProducts()`, `getProductsWithMissingImages()`, `formatPrice()` tests
  - [x] 🟩 Created `apiService.test.ts`: fetch mocking, param construction, error handling, AbortSignal tests

- [x] **Step A13: Build & verify** ✅ DONE
  - [x] `npm run build` — TypeScript compiles clean, no errors
  - [x] `npm run test:run` — all tests pass
  - [x] 🟩 Manual: Select BPP → Select domain → providers load
  - [x] 🟩 Manual: Search provider by name → debounced results update
  - [x] 🟩 Manual: Select provider → products load → grouped display
  - [x] 🟩 Manual: Search products (client-side) → filters correctly
  - [x] 🟩 Manual: "Load more" on providers and products → pagination works
  - [x] 🟩 Manual: "Back to providers" → returns to provider list, clears banner
  - [x] 🟩 Manual: Select product → banner renders correctly (all existing features work)
  - [x] 🟩 Manual: Switch BPP/domain while loading → no stale data (AbortController)
  - [x] 🟩 Manual: Export banner → correct output

### Edge Cases

| Scenario | Behavior |
|---|---|
| BPP with no providers in selected domain | Provider list empty: "No providers found for this BPP and domain" |
| API returns error (network, 500, etc.) | Error message shown with descriptive text, providers/products cleared |
| User changes BPP/domain while API is loading | Previous request aborted via `AbortController`, new request starts |
| User types fast in provider search | Debounced at 300ms — only fires after user stops typing |
| Provider has thousands of products | Paginated: first 50 loaded, "Load more" fetches next page |
| Provider has 0 enabled items | Shown in list with "(0 items)" — selecting it shows empty product list |
| Product has no images | Same handling as before: warning icon in list, banner renders without product image |
| API item missing `item_id` | Skipped by `parseApiItem()` — returns null, filtered out |
| API item missing `provider_details` | Skipped by `extractProviders()` — not added to provider list |
| Provider search returns 0 results | "No providers found" message |
| User switches provider while products are loading | Previous request aborted, new products load |
| User clicks "Back to providers" | `selectedProvider` cleared, banner selection cleared, provider list preserved |
| Multiple items from same provider on page 1 | `extractProviders()` deduplicates — provider appears once |
| "Load more" discovers new providers | Appended to list, deduplicated against existing providers |

### New Files

| File | Purpose |
|---|---|
| `src/constants/apiConfig.ts` | BPP list, domain list, API base URL, default page size |
| `src/services/apiService.ts` | `searchCatalog()` — single fetch wrapper for the catalogue search API |
| `src/hooks/useDebounce.ts` | Generic debounce hook for search input |
| `src/hooks/useProviders.ts` | Provider discovery hook — fetches, deduplicates, paginates providers |
| `src/hooks/useProviderProducts.ts` | Product loading hook — fetches, parses, groups products for a selected provider |
| `src/components/ProviderSearch/ProviderSearch.tsx` | BPP/domain dropdowns + provider search/list UI |
| `src/services/__tests__/apiService.test.ts` | Unit tests for API service |

### Files Modified

| File | Change |
|---|---|
| `src/types/index.ts` | Add `ApiCatalogItem`, `ApiPaginatedResponse`, `ApiProvider`, `DomainOption`; remove `RawCatalogueEntry` |
| `src/services/catalogueParser.ts` | Add `parseApiItem()`, `parseApiItems()`, `extractProviders()`; remove `parseCatalogue()` |
| `src/components/ProductSearch/ProductSearch.tsx` | Add back-to-providers header, loading state, "Load more" pagination, `selectedProviderName` prop |
| `src/App.tsx` | Remove `CATALOGUE_URLS` + `useCatalogue`; add provider selection state; wire `useProviders` + `useProviderProducts`; two-stage sidebar rendering |
| `src/services/__tests__/catalogueParser.test.ts` | Remove `parseCatalogue` tests; add `parseApiItem`, `parseApiItems`, `extractProviders` tests |

### Files Deleted

| File | Reason |
|---|---|
| `src/hooks/useCatalogue.ts` | Replaced by `useProviders` + `useProviderProducts` |
| `public/catalogue/*.json` | Static catalogue files no longer needed |
| `catalogue/*.json` | Source catalogue files no longer needed |

### Files NOT Modified

- `src/components/BannerPreview/BannerPreview.tsx` — renders whatever `BannerState` it receives
- `src/components/BannerControls/BannerControls.tsx` — banner controls unchanged
- `src/components/ExportPanel/ExportPanel.tsx` — export unchanged
- `src/components/LogsPanel/LogsPanel.tsx` — logs unchanged
- `src/components/BackgroundGallery/BackgroundGallery.tsx` — backgrounds unchanged
- `src/components/ImageUploadZone/ImageUploadZone.tsx` — upload unchanged
- `src/hooks/useBannerState.tsx` — banner state management unchanged
- `src/hooks/useLogs.ts` — logging unchanged
- `src/services/exportService.ts` — export rendering unchanged
- `src/services/searchService.ts` — client-side product search still used within loaded products
- `src/services/removeBackgroundService.ts` — remove.bg unchanged
- `src/constants/bannerTemplate.ts` — banner layout unchanged
- `src/constants/backgrounds.ts` — backgrounds unchanged

### Execution Sequence (recommended order)

1. **A1** (apiConfig constants) — foundation, no dependencies
2. **A2** (types) — needed by everything else
3. **A3** (apiService) — API layer, testable in isolation
4. **A4** (catalogueParser additions) — parser layer, testable in isolation
5. **A12** (tests for A3 + A4) — verify data layer works before building UI
6. **A5** (useDebounce) — utility hook, no dependencies
7. **A6** (useProviders hook) — depends on A3, A4, A5
8. **A7** (useProviderProducts hook) — depends on A3, A4
9. **A8** (ProviderSearch component) — depends on A2 types
10. **A9** (adapt ProductSearch) — small changes to existing component
11. **A10** (App.tsx rewire) — depends on all hooks + components
12. **A11** (cleanup) — remove old code after everything works
13. **A13** (build + verify) — final validation

---

**After completion:** All tests pass, BPP/domain/provider/product selection works end-to-end, exported banners are identical to before (only the data source changed), no regressions to existing banner customization features.

## Direct Lookup by Provider ID / Item ID — Implementation Plan

**Overall Progress:** `DL1-DL5 DONE`

Adds two input fields at the top of the sidebar for pasting a `provider_unique_id` or `item_id` directly, bypassing the BPP > Domain > Provider browse flow.

### Phase 1 — API Layer ✅ DONE
- [x] 🟩 Add `itemId` param to `SearchCatalogParams` in `apiService.ts`
- [x] 🟩 Wire `itemId` as `item_id` query param in `searchCatalog()`
- [x] 🟩 Add tests for `item_id` query param construction in `apiService.test.ts`

### Phase 2 — Direct Lookup Hook ✅ DONE
- [x] 🟩 Create `useDirectLookup` hook to handle:
  - Provider ID paste → fetch products for that provider (reuses existing `provider_unique_id` flow)
  - Item ID paste → fetch single item via `item_id` param
- [x] 🟩 On successful item lookup, auto-parse into `ParsedProduct` and auto-select for banner
- [x] 🟩 Handle loading, error, and "not found" states
- [x] 🟩 AbortController for cancelling stale requests on new lookups

### Phase 3 — UI (Sidebar Inputs) ✅ DONE
- [x] 🟩 Add "Direct Lookup" section at top of sidebar, above BPP/Domain dropdowns
- [x] 🟩 Two input fields: "Provider ID" and "Item ID" with paste-friendly UX (Enter to submit)
- [x] 🟩 Submitting a lookup clears/bypasses BPP > Domain > Provider selection state
- [x] 🟩 Show inline error messages
- [x] 🟩 Item ID lookup auto-selects the product for banner preview

### Phase 4 — State Coordination ✅ DONE
- [x] 🟩 When direct lookup is active, BPP/Domain browse flow is hidden
- [x] 🟩 "Clear lookup / Back to browse" button returns to normal flow
- [x] 🟩 Product selection, banner state, and logs all work correctly with direct-lookup results
- [x] 🟩 `activeGroups`, `activeMissingImageProducts`, `activeProductsLoading` use direct lookup data when active
- [x] 🟩 Direct lookup errors logged to LogsPanel

### Phase 5 — Testing & Verification ✅ DONE
- [x] 🟩 Unit tests for API param wiring (9 tests in apiService.test.ts)
- [x] 🟩 `npm run build` — TypeScript compiles clean, no errors
- [x] 🟩 `npm run test:run` — all 74 tests pass
- [ ] ⬜ Manual E2E: paste provider ID → see products → select → export banner
- [ ] ⬜ Manual E2E: paste item ID → auto-selected → export banner
- [ ] ⬜ Manual: Verify browse flow still works unaffected after clearing direct lookup

### Edge Cases
- Invalid/nonexistent ID pasted → show "not found" message, don't crash
- Both provider ID and item ID filled → each has its own "Go" button (user chooses which to submit)
- User switches between direct lookup and browse → state resets cleanly
- API returns multiple items for item ID → first item is auto-selected
- Provider lookup returns 0 products → shows "not found" error message
- AbortController cancels stale requests when user triggers a new lookup

### New Files

| File | Purpose |
|---|---|
| `src/hooks/useDirectLookup.ts` | Direct lookup hook — provider ID and item ID fetching, parsing, state |
| `src/components/DirectLookup/DirectLookup.tsx` | UI component — two input fields with Go buttons, error display, clear action |

### Files Modified

| File | Change |
|---|---|
| `src/services/apiService.ts` | Add `itemId` param to `SearchCatalogParams`, wire as `item_id` query param |
| `src/App.tsx` | Wire `useDirectLookup`, add `DirectLookup` component, state coordination between direct lookup and browse flow |
| `src/services/__tests__/apiService.test.ts` | Add test for `item_id` query param construction |

### Files NOT Modified

- `src/components/BannerPreview/BannerPreview.tsx` — renders whatever `BannerState` it receives
- `src/components/BannerControls/BannerControls.tsx` — unchanged
- `src/components/ProductSearch/ProductSearch.tsx` — unchanged (receives `activeGroups` from either flow)
- `src/components/ProviderSearch/ProviderSearch.tsx` — unchanged
- `src/components/ExportPanel/ExportPanel.tsx` — unchanged
- `src/components/LogsPanel/LogsPanel.tsx` — unchanged
- `src/hooks/useBannerState.tsx` — unchanged
- `src/hooks/useProviders.ts` — unchanged
- `src/hooks/useProviderProducts.ts` — unchanged
- `src/services/catalogueParser.ts` — unchanged (reused by `useDirectLookup`)
- `src/types/index.ts` — unchanged

---

## Feature: Quantity Sticker on Banner

**Summary:** Add a toggleable dark pill sticker positioned bottom-right of the product image, showing pack/quantity info (e.g. "Pack of 5", "200 ml"). Auto-populated from catalogue data, user-editable override.

### Phase 1 — Investigate JSON source

- [x] ✅ QS-1: Inspect a real API response payload and locate the quantity fields. Candidates:
  - `item_details.quantity.unitized.measure.unit` + `.value` ← **confirmed path**
  - `item_details.tags` entry with a relevant code (like `@ondc/org/statutory_reqs_prepackaged_commodities`)
- [x] ✅ QS-2: Document the confirmed JSON path and note which BPPs/products populate it vs. leave it null
  - Path: `item_details.quantity.unitized.measure.{ unit, value }` (e.g. `unit="Pack"`, `value="5"`)
  - Many products will have this as `null`/`undefined` — handled gracefully
- [x] ✅ QS-3: Decide on the display format based on what the data looks like (e.g. `"{unit}\nof {value}"` vs `"{value} {unit}"`)
  - Auto-populated as free-form `"{value} {unit}"` (e.g. "5 Pack", "200 ml") — user edits freely

### Phase 2 — Types & constants

- [x] ✅ QS-4: Extend `ApiCatalogItem.item_details` in `src/types/index.ts` with the confirmed `quantity` shape
- [x] ✅ QS-5: Add `quantity?: { unit: string; value: string }` to `ParsedProduct` in `src/types/index.ts`
- [x] ✅ QS-6: Add `showQuantitySticker: boolean` and `quantityStickerText: string | null` to `BannerState` in `src/types/index.ts`
- [x] ✅ QS-7: Add `QUANTITY_STICKER` constant to `src/constants/bannerTemplate.ts`:
  - Size: width, min-height, padding
  - Font: size, weight, family, color
  - Background color (dark pill, e.g. `#3D3D3D`)
  - Position: bottom-right of product image area, with offset from edge

### Phase 3 — Parser extraction

- [x] ✅ QS-8: In `catalogueParser.ts` → `parseApiItem()`, extract `unit` + `value` from confirmed JSON path
- [x] ✅ QS-9: Expose extracted quantity on the returned `ParsedProduct` (null when not present)
- [x] ✅ QS-10: Add unit tests in `src/services/__tests__/catalogueParser.test.ts`:
  - Item with quantity data → correct unit/value extracted
  - Item with missing `quantity` field → `quantity: null` (no crash)
  - Item with partial data (only unit, no value) → graceful null

### Phase 4 — Banner state

- [x] ✅ QS-11: Initialize new fields in `useBannerState.tsx`:
  - `showQuantitySticker: false` (default off)
  - `quantityStickerText: null`
- [x] ✅ QS-12: When a product is selected, auto-populate `quantityStickerText` from `product.quantity` (format: `"{unit}\nof {value}"` or confirmed format from QS-3). Clear to null if quantity absent.
- [x] ✅ QS-13: Expose `setQuantityStickerText` and `setShowQuantitySticker` for BannerControls to call

### Phase 5 — BannerPreview rendering

- [x] ✅ QS-14: In `BannerPreview`, conditionally render the sticker when `showQuantitySticker` is true and `quantityStickerText` is non-empty
- [x] ✅ QS-15: Position sticker absolutely — bottom-right corner of the product image area, using `QUANTITY_STICKER` constants
- [x] ✅ QS-16: Style: dark rounded pill, centered two-line text, using `QUANTITY_STICKER` font/color constants
- [x] ✅ QS-17: Ensure sticker is captured correctly by `html-to-image` (no clipping, z-index correct)

### Phase 6 — BannerControls UI

- [x] ✅ QS-18: Add sticker toggle (On/Off) to `BannerControls`, consistent with existing toggle pattern (logo, heading, CTA, etc.)
- [x] ✅ QS-19: Below the toggle, show an editable text field pre-filled with `quantityStickerText` — visible only when toggle is On
- [x] ✅ QS-20: Wiring: toggle calls `setShowQuantitySticker`, text field calls `setQuantityStickerText`

### Phase 7 — Tests

- [x] ✅ QS-21: Unit test `useBannerState`: selecting a product with quantity → `quantityStickerText` auto-populated
- [x] ✅ QS-22: Unit test `useBannerState`: selecting a product without quantity → `quantityStickerText` is null, `showQuantitySticker` stays false
- [x] ✅ QS-23: Render test `BannerPreview`: sticker visible when `showQuantitySticker=true` + text set
- [x] ✅ QS-24: Render test `BannerPreview`: sticker absent when `showQuantitySticker=false`
- [x] ✅ QS-25: Render test `BannerControls`: toggle and text field render; interactions fire correct callbacks
