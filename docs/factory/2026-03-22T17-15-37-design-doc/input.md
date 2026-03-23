We need to address all the issues missed by the previous run and identified by the completeness report at docs/factory/2026-03-22T14-15-55-design-doc/completeness-report.md.

Also look at all files under C:\Users\CalebBennett\Documents\GitHub\Skaldmark\docs\factory to see if you can find any other bugs to fix during the run.

## Known Issues from Completeness Report

### Spec Violations (4 items)
1. `metadata` IndexedDB store missing (REQ-015) — no schema version tracking store in Dexie
2. Tiny Items UI section missing from GearScreen — specified in spec but silently dropped
3. Memento UI section missing from GearScreen — specified in spec but silently dropped
4. `themesSupported` field missing from SystemDefinition type — missing from schema

### Bugs Found (2 items)
1. WeaponEditor calls `handleOpen()` during render — potential infinite re-render loop
2. Settings save errors silently swallowed in AppStateContext — data loss risk

### Additional Items to Investigate
- Check all factory artifacts (spec.md, phase specs, verify-report) for any other gaps
- Check the actual source code for any additional bugs, dead imports, unused code
- Ensure all Dragonbane conditions match the spec (verify conditions list is complete)
- Verify PWA manifest and service worker configuration is correct
- Check that import/export with Zod validation handles edge cases properly

## Scope
This is a bugfix/completion run — not new features. Fix the 4 spec violations and 2 bugs listed above, plus any other issues found during investigation.
