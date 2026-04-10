# Import/Export Test Plan

**Date:** 2026-04-07
**App:** Skaldbok (https://localhost:4173)
**Tool:** Playwright MCP

## Scenarios

| # | Scenario | File | Priority |
|---|----------|------|----------|
| 1 | Character export from library | scenario-01-character-export.md | P0 |
| 2 | Character import via library | scenario-02-character-import.md | P0 |
| 3 | Session export (.skaldbok) | scenario-03-session-export.md | P0 |
| 4 | Campaign export (.skaldbok.json) | scenario-04-campaign-export.md | P0 |
| 5 | Campaign/bundle import (.skaldbok.json) | scenario-05-campaign-import.md | P0 |
| 6 | Session export + notes ZIP | scenario-06-session-zip-export.md | P1 |
| 7 | Legacy .skaldmark.json import | scenario-07-legacy-import.md | P1 |

## Preconditions

- App running at https://localhost:4173
- Sample files available in `sample-data/examples/`
- Browser state may include stale session warnings -- dismiss with "Continue"

## Import flows

1. **Character Library import** -- uses `importCharacter()` from `utils/importExport.ts`, accepts raw character JSON
2. **Bundle import** -- uses `useImportActions()` hook, triggered from Session screen "Import (.skaldbok.json)" button, accepts `BundleEnvelope` format

## Export flows

1. **Character Library export** -- exports raw character JSON as `.skaldbok.json`
2. **Session/Campaign bundle export** -- exports `BundleEnvelope` as `.skaldbok.json`
3. **Session markdown** -- exports `.md` file
4. **Session ZIP** -- exports `.zip` with notes and attachments
