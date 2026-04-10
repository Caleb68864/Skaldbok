# Phase Spec — SS-03: CampaignContext Provider

```yaml
sub-spec: SS-03
title: CampaignContext Provider
stage: 1
priority: P0
score: 93
depends-on: SS-02
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** Requires **SS-02** (Dexie v3 Schema Migration) to be complete first. The Dexie tables and Zod types (`Campaign`, `Session`, `Party`) must exist before this provider can hydrate from them. SS-04 (Note Repositories) and SS-07 (Campaign & Session CRUD) depend on this context being available.

---

## Intent

Provide a React context that wraps `AppStateContext` and exposes campaign, session, party, and character-in-campaign state to all consumers. Must hydrate from Dexie on app load, guard single-active-session invariant, and provide null-safe values when no campaign exists.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S3-01 | `CampaignContext` is created with `createContext(null)` pattern. `useCampaignContext()` hook throws a descriptive error if called outside the provider (matches existing context pattern). |
| AC-S3-02 | Provider hydrates on mount: reads campaigns from Dexie, finds first with `status: "active"`, resolves its active session, party, and `activeCharacterId`, sets `activeCampaign`, `activeSession`, `activeParty`, `activeCharacter` in context state. If no active campaign, all four values are `null`. |
| AC-S3-03 | `CampaignContext` wraps `AppStateContext` in the component tree. `AppStateContext` continues to own: `activeCharacterId`, `theme`, `mode`, boon/bane overrides. `CampaignContext` owns: `activeCampaign`, `activeSession`, `activeParty`, `activeCharacterInCampaign`. No state is duplicated between the two contexts. |
| AC-S3-04 | `startSession()` action: guards if `activeSession` exists (does NOT create a new one; returns an error indicator or throws — caller handles UX). Writes new session record to Dexie (`status: "active"`). Updates `activeSession` in context state. Auto-generates session title (e.g., `"Session N — YYYY-MM-DD"`). |
| AC-S3-05 | `endSession()` action: sets `activeSession.status` to `"ended"` in Dexie. Sets `activeSession.endedAt` to current ISO timestamp. Clears `activeSession` from context state (set to `null`). |
| AC-S3-06 | On app launch, if an active session exists with `startedAt` more than 24 hours ago: a warning is surfaced to the user (toast or prompt). The session is **NOT** auto-ended. The user is offered "End it" or "Continue" options. |
| AC-S3-07 | `setActiveCampaign(campaignId)` action updates `activeCampaign` in context and re-resolves `activeSession` and `activeParty` from Dexie. |
| AC-S3-08 | Context provides `null` values (not `undefined`, not thrown errors) when no campaign is set. All consumers treat `null` as "no campaign" and degrade gracefully per AC-S1-04. |
| AC-S3-09 | No TypeScript errors in provider or hook files. |

---

## Implementation Steps

1. **Create `src/features/campaign/CampaignContext.tsx`**

2. **Define the context interface**
   ```ts
   export interface CampaignContextValue {
     activeCampaign: Campaign | null;
     activeSession: Session | null;
     activeParty: Party | null;
     activeCharacterInCampaign: PartyMember | null;
     startSession: () => Promise<void>;
     endSession: () => Promise<void>;
     setActiveCampaign: (campaignId: string) => Promise<void>;
   }
   ```
   - Import types from SS-02 outputs: `src/types/campaign.ts`, `src/types/session.ts`, `src/types/party.ts`

3. **Create context with `createContext(null)`**
   ```ts
   const CampaignContext = createContext<CampaignContextValue | null>(null);
   ```

4. **Implement `useCampaignContext()` hook**
   ```ts
   export function useCampaignContext(): CampaignContextValue {
     const ctx = useContext(CampaignContext);
     if (!ctx) throw new Error('useCampaignContext must be used within CampaignProvider');
     return ctx;
   }
   ```

5. **Implement `CampaignProvider` component**
   - Use mounted-flag pattern for all async Dexie reads:
     ```ts
     let mounted = true;
     // ... async fetch ...
     if (mounted) setState(...);
     return () => { mounted = false; };
     ```
   - On mount hydration (`useEffect` with `[]` deps):
     - Query `db.campaigns.where('status').equals('active').first()`
     - If found: fetch matching session via `db.sessions.where({ campaignId, status: 'active' }).first()`
     - Fetch party via `db.parties.where('campaignId').equals(campaignId).first()`
     - Set state: `activeCampaign`, `activeSession`, `activeParty`
     - After hydration, check stale session (AC-S3-06): if `activeSession?.startedAt` is > 24h ago, show warning

6. **Implement stale session warning (AC-S3-06)**
   - Calculate diff: `Date.now() - new Date(activeSession.startedAt).getTime() > 24 * 60 * 60 * 1000`
   - Use `showToast()` from `useToast()` OR render a modal/drawer with "End it" / "Continue" buttons
   - "End it" calls `endSession()` internally
   - "Continue" dismisses without action

7. **Implement `startSession()`**
   - Guard: if `activeSession !== null`, call `showToast('A session is already active')` and return
   - Generate new session: `{ id: generateId(), campaignId: activeCampaign.id, title: autoTitle, status: 'active', date: nowISO().slice(0,10), startedAt: nowISO() }`
   - Auto-title logic: count existing sessions for campaign + 1, format `Session N — YYYY-MM-DD`
   - Write to Dexie: `await db.sessions.add(newSession)`
   - Set `activeSession` in state

8. **Implement `endSession()`**
   - Guard: if `activeSession === null`, return
   - Update Dexie: `await db.sessions.update(activeSession.id, { status: 'ended', endedAt: nowISO() })`
   - Set `activeSession` to `null` in state

9. **Implement `setActiveCampaign(campaignId)`**
   - Fetch campaign from Dexie by id
   - Re-fetch active session and party for that campaign
   - Update state: `activeCampaign`, `activeSession`, `activeParty`
   - Update campaign's active status in Dexie if needed (set previous active campaign to archived/inactive)

10. **Wrap `AppStateContext` in component tree**
    - In `src/app/AppProviders.tsx` (where the provider tree is assembled), add `CampaignProvider` inside `ActiveCharacterProvider`, wrapping `ToastProvider`:
      ```tsx
      <ActiveCharacterProvider>
        <CampaignProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </CampaignProvider>
      </ActiveCharacterProvider>
      ```

11. **Named exports**
    - `export { CampaignProvider, useCampaignContext }`
    - No default exports

---

## Verification Commands

```
# TypeScript check
npx tsc --noEmit

# Manual browser checks:
# 1. App loads → no console errors
# 2. With no campaign in DB → all four context values are null
# 3. Create a campaign + session in DB (or via SS-07 UI) → context hydrates on reload
# 4. Call startSession() twice → second call shows toast, no duplicate session created
# 5. Call endSession() → session.status = "ended" in IndexedDB
# 6. Manually set a session's startedAt to > 24h ago → stale warning appears on next launch
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `src/features/campaign/CampaignContext.tsx` |
| **Modify** | `src/app/AppProviders.tsx` — add `CampaignProvider` inside `ActiveCharacterProvider`, wrapping `ToastProvider` |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-02` All new IDs use `generateId()`; timestamps use `nowISO()`
- `XC-04` Named exports only
- `XC-05` Hook returns object `{ fn1, fn2 }` — no array returns
- `XC-06` `showToast()` from `useToast()` for user-facing errors
