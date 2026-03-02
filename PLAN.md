# Feature Implementation Plan

**Overall Progress:** `Steps 1-33 DONE | Fixes F1-F14 DONE | 37/37 tests passing | Build OK | Remove BG + Editable Product Name complete`

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
