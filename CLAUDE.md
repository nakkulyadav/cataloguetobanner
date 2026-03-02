# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DigihaatCatalogueToBanner — client-side React app for Digihaat employees to generate 712×322px product marketing banners from a JSON catalogue. No backend; catalogue is a static JSON file served via Vite.

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Type-check + production build
npm run preview    # Preview production build
npm run test       # Run tests in watch mode (Vitest)
npm run test:run   # Run tests once
```

## Tech Stack

- **React 19 + TypeScript** with Vite 6
- **Tailwind CSS 3** (dark theme, class-based)
- **html-to-image** for client-side banner rendering (PNG/JPG/WEBP)
- **Vitest** + Testing Library for tests
- Path alias: `@/` maps to `./src/`

## Architecture

```
src/
├── types/index.ts              # All TypeScript interfaces
├── constants/
│   ├── bannerTemplate.ts       # Fixed 712×322 layout positions, fonts, sizes
│   └── backgrounds.ts          # Predefined background options
├── services/
│   ├── catalogueParser.ts      # Parse stringified JSON, deduplicate, group related items
│   ├── searchService.ts        # Multi-word substring search
│   └── exportService.ts        # html-to-image rendering + download
├── hooks/
│   ├── useCatalogue.ts         # Load + parse catalogue
│   ├── useBannerState.ts       # Banner config state (product, bg, CTA, badge, T&C, logo)
│   └── useLogs.ts              # Log entries state
├── components/
│   ├── BannerPreview/          # The 712×322 HTML template (forwardRef for export capture)
│   ├── ProductSearch/          # Search input + grouped results list
│   ├── BannerControls/         # Background, CTA, badge, T&C toggle, logo override
│   ├── BackgroundGallery/      # Modal popup for background selection
│   ├── ExportPanel/            # Format selector + download button
│   └── LogsPanel/              # Scrollable log messages
└── App.tsx                     # Wires everything: 3-column layout (sidebar | preview | controls)
```

## Key Data Flow

1. **Catalogue JSON** (`public/catalogue/*.json`) → each entry has stringified `item_details` + `provider_details`
2. **catalogueParser** parses, deduplicates by item ID, groups `related: true` items under parents
3. **searchService** filters groups by multi-word substring match on product name
4. **BannerPreview** renders HTML/CSS at exact 712×322px, driven by constants
5. **exportService** captures the preview DOM node via html-to-image

## Catalogue Format

Each entry: `{ item_details: "<stringified>", provider_details: "<stringified>" }`
- Item: `descriptor.name`, `descriptor.images[0]`, `price`, `tags` (veg/non-veg, parent ID)
- Provider: `descriptor.name` (brand), `descriptor.symbol` (logo), `descriptor.long_desc` (company)

## Agent Workflow (`.agent/commands/`)

Follow explore → plan → execute for new features. See `.agent/commands/` for stage instructions.

## Engineering Preferences

- **DRY** — flag repetition aggressively.
- **Testing is non-negotiable** — err on the side of too many tests.
- **"Engineered enough"** — not fragile/hacky, not prematurely abstract.
- **Handle more edge cases**, not fewer; thoughtfulness > speed.
- **Explicit over clever.**

## Code Review Process

Before making code changes, ask whether the user wants:
- **BIG CHANGE** — Interactive review section by section (Architecture → Code Quality → Tests → Performance), at most 4 top issues each.
- **SMALL CHANGE** — One question per review section.

Number issues and letter options (e.g., Issue #1 Option A). Recommended option is always listed first.
