# Roadmap status updates, 2026-11-21 (wave 8)

Branch `work/roadmap-wave8`, stacked on `work/found-wave7` (`0033a3d`). Not
pushed.

`.gitignore` ignores `docs/backlog/`, so this file needs `git add -f`.

The remaining roadmap under the owner's decision rule (wave 6 file). Blocked
means: rulebook text or numbers, hardware, credentials, or an irreversible data
migration; and "unsure" counts as blocked.

## Checked and left blocked

| Item | Why it stays blocked |
|---|---|
| **C3** two maxima for HP/WP, and **C4**'s remainder | Checked against the code. `resources.hp.max` is synced to the raw attribute (`syncDerivedResourceMaxima`), while `derived.hpMax` is the effective attribute, overridable and a modifier target (`computeHPMax` → `effectiveAttribute`). Making one channel the truth forces a rules answer the repository does not have: if a "+2 Max HP" buff raises the maximum, may current HP rise above the stored maximum, and what happens to it when the buff ends? Today `normalizeResource` clamps `current` to the stored `max` on every read, so honouring an effective maximum without that answer would silently cut HP at the next load. The two designs the entry offers both change play behaviour and one drops a user feature (HP Max overrides). That is rules text, so blocked. C4's remaining sites (`ParticipantDrawer` clamp, `SheetScreen` raw current) are the same question. |
| **T1** skill training | The spec lists three decisions "before coding": which Traveller source defines study time per level, how study periods are counted, and whether skills train concurrently. The first is rulebook numbers; the spec itself says not to start with invented defaults. |

## Decided by agent 2026-11-21 (owner may revisit)

| Item | Commit | Choice and why | Test |
|---|---|---|---|
| **U2** campaign create and import are two transactions | (this commit, docs only) | **Kept as two steps.** Folding the create into `mergeBundle` would move it from the form's Create button to the Import click, which changes what the dialog does. The crash window it would close is small and its result is reversible: an unused campaign made in the dialog is already discarded on cancel (`80bc05e`), and one left by a crash is an empty campaign the user can see. | none (no code change) |
