---
type: phase-spec
sub_spec_id: SS-02
phase: run
depends_on: []
wave: 1
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-02 — `promoted_into` entity-link relationship type

## Scope

Register the `promoted_into` relationship (`log` note → target note) and document it per project convention.

## Why this matters

`CLAUDE.md` mandates that adding a relationship type updates **both** the relationship table in `CLAUDE.md` **and** the comment at the top of `entityLinkRepository.ts`. `AGENTS.md` is a near-verbatim copy of `CLAUDE.md` and must stay in sync — a change to one without the other is a documented convention break.

## Interface Contracts

### promoted_into
- Direction: SS-02 → SS-07, SS-13
- Owner: SS-02
- Shape: `entityLinks` row — `{ fromEntityId: <log note id>, fromEntityType: 'note', toEntityId: <target note id>, toEntityType: 'note', relationshipType: 'promoted_into' }`

## Implementation Steps

### Step 1. Extend the repository comment

Modify `src/storage/repositories/entityLinkRepository.ts`. Add `promoted_into` to the documented relationship list at the top of the file, described as: *a log entry that was promoted into (or appended to) this note; the entry itself is never deleted*.

No code change is required — `relationshipType` is a free-string field and `createLink` is already generic.

### Step 2. Update `CLAUDE.md`

Add a row to the "Relationship types in use" table:

| `promoted_into` | `note` (log) → `note` | The log entry was promoted into, or appended to, this note |

### Step 3. Mirror into `AGENTS.md`

Apply the identical table row. `AGENTS.md` is the Codex copy of `CLAUDE.md`; the two must not drift.

### Step 4. Verify and commit

```bash
npm run build
git add src/storage/repositories/entityLinkRepository.ts CLAUDE.md AGENTS.md
git commit -m "docs(links): register promoted_into relationship type [factory-managed]"
```

## Verification Commands

```bash
npm run build
grep -c "promoted_into" CLAUDE.md AGENTS.md src/storage/repositories/entityLinkRepository.ts
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Repo comment lists promoted_into | [STRUCTURAL] | `grep -q "promoted_into" src/storage/repositories/entityLinkRepository.ts \|\| (echo "FAIL: entityLinkRepository comment missing promoted_into" && exit 1)` |
| CLAUDE.md documents promoted_into | [STRUCTURAL] | `grep -q "promoted_into" CLAUDE.md \|\| (echo "FAIL: CLAUDE.md missing promoted_into row" && exit 1)` |
| AGENTS.md stays in sync | [MECHANICAL] | `[ $(grep -c "promoted_into" AGENTS.md) -ge 1 ] \|\| (echo "FAIL: AGENTS.md out of sync with CLAUDE.md" && exit 1)` |
| Build passes | [MECHANICAL] | `npm run build > /dev/null 2>&1 \|\| (echo "FAIL: npm run build failed" && exit 1)` |
