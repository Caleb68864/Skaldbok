# Validation Questions

## Before Implementation Starts

- Does `@tiptap/suggestion` accept a multi-character `char` string like `'[['`? Build a minimal test. (ASM-1)
- How many note query sites need updating for `scope = 'shared'` support? (ASM-7)
- Can Dexie's WhereClause handle `OR` across `campaignId` and `scope` in a single query, or are two queries needed? (ASM-13)

## Answerable from Code

- Does `equalsIgnoreCase()` exist on Dexie 4.0.10's WhereClause? Check `node_modules/dexie/dist/dexie.d.ts` (ASM-2)
- What features does NotesGrid.tsx expose that VaultBrowser must replicate? Read `src/features/notes/NotesGrid.tsx` (ASM-9)
- Does vite-plugin-pwa auto-generate the precache manifest, or is it a static list? Check `vite.config.ts` (ASM-14)
- Does Tiptap's InputRule system support creating atom nodes (not just marks/wrapping)? Check `@tiptap/core` InputRule types (ASM-4)

## Answerable from Documentation

- Does MiniSearch 7.x `discard()` handle IDs that were never added (no-op vs throw)? Check MiniSearch docs (ASM-12)
- What is the actual gzipped size of d3-force + d3-zoom + d3-selection with tree-shaking via Vite? (ASM-10)
- Does `@tiptap/suggestion` 2.27.x have breaking changes vs the 2.11.x API? (ASM-6)

## Requires Stakeholder Decision

- Should `settings.debugMode` be added to AppSettings, or should debug logging use `import.meta.env.DEV`? (ASM-3)
- Should all @tiptap/* packages be aligned to ^2.27.2 before starting KB work? (ASM-6)
