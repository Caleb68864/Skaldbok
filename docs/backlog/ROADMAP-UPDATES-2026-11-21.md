# Roadmap status updates, 2026-11-21 (wave 5)

Branch `work/hardening-wave5`, stacked on `work/attachment-per-photo-delete`
(`2cc441d`, the per-photo attachment delete; see the wave 3 file's "Wave 4").
Not pushed.

`.gitignore` ignores `docs/backlog/`, so this file needs `git add -f`.

Out of scope by the brief: E5, G6, S25. Left for the owner: whether the sheet
should read `labels.derivedPanel` / `labels.storyBankPanel`.

## Done in this wave

| Item | Commit | What changed | Test |
|---|---|---|---|
| D12: the last `'classic-fantasy'` fallbacks | see `git log` | `DEFAULT_SYSTEM_ID` moved to `systems/defaultSystemId.ts` (no imports, so the type and bundle layers can read it without loading every `system.json`); `registry.ts` re-exports it. `bundleParser` (bare-character envelope), `bundleSerializer` (envelope system) and `campaignSchema`'s default now use it. Same value, so no behaviour change. | New `systems/defaultSystemId.test.ts`: fails on a quoted `'classic-fantasy'` in non-test source outside a three-file allowlist with reasons (the definition, the legacy alias table, the blank-template map). With the four files reverted it fails and lists the four sites. |
