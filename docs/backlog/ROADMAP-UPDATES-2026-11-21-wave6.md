# Roadmap status updates, 2026-11-21 (wave 6)

Branch `work/decisions-wave6`, cut from `main` `047cdf9` (PR #9, wave 5,
merged). Not pushed.

`.gitignore` ignores `docs/backlog/`, so this file needs `git add -f`.

Under the owner's standing order, items that were waiting on a product choice
are implemented with the most conservative option and recorded as **Decided by
agent 2026-11-21 (owner may revisit)**. Items needing rulebook text, hardware,
credentials or an irreversible data migration stay blocked and are listed at the
end.

## Decided by agent 2026-11-21 (owner may revisit)

| Item | Commit | Choice and why | Test |
|---|---|---|---|
| S25: links to private notes on export | `4fee2fc` | In any export that excludes private notes, a `[[wikilink]]` or `@mention` node whose target is a private note is replaced by the text `[private note]` on the exported copy. Matching is by id, or by label/title for an unresolved link, except where a shared note has the same title. Before, the JSON bundle found the private id in the public note's body and refused to write at all (one link blocked the whole shareable export), and every Markdown exit wrote the private title. Conservative: nothing private leaves, only the link node changes, the surrounding prose and the stored note are untouched, and an export with private notes included is unaffected. The fail-closed residue check stays, for anything else. Reversible: one function, `utils/export/redactPrivateLinks.ts`, applied in `applyPrivacyFilter` and the five Markdown paths in `useExportActions`. | New `redactPrivateLinks.test.ts` (5); `privacyBacklinks.test.ts`'s two cases that pinned the old behaviour now pin this rule and fail on the old filter (+1 that the stored note is unchanged); new `privateLinkExport.test.tsx` fails on the old hook. |
| G6: gear in play mode | `c51bec7` | Kept as it is: in play mode the gear screen keeps Equip, a consumable's count and coins, and adding, editing or removing weapons, inventory, tiny items or the memento needs edit mode. This is the existing behaviour, the most conservative option, and matches what play mode is for (a tap mid-session cannot change what the character owns). The question is now asked as a field path, `FIELD_PATHS.gear`, so the policy lives in `modeGuards.ts` beside the others; opening gear up later is one line (`'gear'` in `PLAY_MODE_EDITABLE_PREFIXES`). `modeGuards.ts`'s comment saying weapons were always editable was wrong (only Equip was) and is corrected. | `modeGuards.test.ts` lists `gear` among the locked paths; new `gearPlayMode.test.tsx` (2) pins what play mode leaves available. Behaviour is unchanged, so these pass on the old code too. |
| E5: classic-fantasy helpers into `systems/classic-fantasy/classicMath.ts` | (this commit, docs only) | **Not moved.** The half that did not conflict landed in PR #4 (system `index.ts` files no longer re-export maths; the duplicate `getSkillBaseChance` is gone). Moving `derivedValues`/`restActions`/`boonBane`/`abilities`/`spells` contradicts CLAUDE.md's rule that the classic-fantasy adapter *delegates* to those helpers, which is what keeps Dragonbane's behaviour provably unchanged, and a move gains no behaviour. `DERIVED_KEYS` in `derivedValues.ts` and `LEGACY_DERIVED_KEYS` in `migrations.ts` stay separate on purpose: the migration copy is frozen with the released upgrade. The entry's other idea, a generic `RestDefinition.restores` read from `ResourceDefinition.refresh: 'rest'`, needs each ruleset's rest numbers, which is rules text and stays blocked. | none (no code change) |
| `labels.derivedPanel` / `labels.storyBankPanel` on the sheet | (this commit, docs only) | **The sheet keeps its own titles** ("Derived Values", "Story Bank"). Both labels are declared on the type as play-dashboard card titles, and the one system that sets one (Traveller, `derivedPanel: "Stats"`) chose it for the dashboard card, where the characteristic score is shown with its DM (`ad6873b`). Reading it on the sheet would rename a panel for Traveller users with no request behind it. Reversible: a sheet-specific label can be added later without touching these. | none (no code change) |
