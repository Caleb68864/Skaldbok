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
| S25: links to private notes on export | (this commit) | In any export that excludes private notes, a `[[wikilink]]` or `@mention` node whose target is a private note is replaced by the text `[private note]` on the exported copy. Matching is by id, or by label/title for an unresolved link, except where a shared note has the same title. Before, the JSON bundle found the private id in the public note's body and refused to write at all (one link blocked the whole shareable export), and every Markdown exit wrote the private title. Conservative: nothing private leaves, only the link node changes, the surrounding prose and the stored note are untouched, and an export with private notes included is unaffected. The fail-closed residue check stays, for anything else. Reversible: one function, `utils/export/redactPrivateLinks.ts`, applied in `applyPrivacyFilter` and the five Markdown paths in `useExportActions`. | New `redactPrivateLinks.test.ts` (5); `privacyBacklinks.test.ts`'s two cases that pinned the old behaviour now pin this rule and fail on the old filter (+1 that the stored note is unchanged); new `privateLinkExport.test.tsx` fails on the old hook. |
