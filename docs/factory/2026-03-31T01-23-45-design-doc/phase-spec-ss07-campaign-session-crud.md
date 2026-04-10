# Phase Spec — SS-07: Campaign & Session CRUD (Phase 1)

```yaml
sub-spec: SS-07
title: Campaign & Session CRUD
stage: 2
priority: P0
score: 90
depends-on: SS-02, SS-03, SS-04
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** Requires **SS-02** (Dexie v3 schema), **SS-03** (CampaignContext — `startSession`, `endSession`, `setActiveCampaign`), and **SS-04** (campaign/session repositories). SS-08 (Party) and SS-09 (Notes Hub) depend on this sub-spec providing an active campaign lifecycle. All Stage 1 sub-specs (SS-01 through SS-06) must be complete before Stage 2 begins.

---

## Intent

Enable a user to create a campaign, start a session, and end a session from the UI. This is the minimum viable campaign lifecycle.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S7-01 | User can create a campaign from a Campaign Creation screen or modal. Required fields: **name**. Optional: description, system (default: `"dragonbane"`). On save, campaign appears in campaign selector in the header. |
| AC-S7-02 | User can set an active campaign by tapping it in the campaign selector. `CampaignContext.setActiveCampaign()` is called; header updates immediately. |
| AC-S7-03 | Session tab shows "Start Session" button when: an active campaign exists AND no active session exists for that campaign. |
| AC-S7-04 | Tapping "Start Session": creates a session record in Dexie (`status: "active"`); updates `CampaignContext.activeSession`; Session tab shows session status (title, started time); "Start Session" button is replaced by "End Session" button. |
| AC-S7-05 | Tapping "End Session": prompts for confirmation (modal or drawer); on confirm: sets `session.status` to `"ended"`, sets `session.endedAt`; `CampaignContext.activeSession` becomes `null`; Session tab returns to "Start Session" state. |
| AC-S7-06 | If a campaign has no active session, the Session tab still renders (no blank screen). Shows at minimum: campaign name, last session summary or "No sessions yet." |
| AC-S7-07 | Stale session warning fires on app launch per AC-S3-06 (the warning originates in `CampaignContext` — this sub-spec only verifies it surfaces correctly in the UI). |
| AC-S7-08 | No TypeScript errors in Campaign and Session screen files. |

---

## Implementation Steps

### 1. Create Campaign Creation Modal/Screen

**File:** `src/features/campaign/CampaignCreateModal.tsx`

- A modal or drawer component
- Form fields:
  - `name` (required): text input, `minLength: 1`
  - `description` (optional): textarea
  - `system` (optional): defaults to `"dragonbane"`, not shown in UI (Dragonbane-only design)
- On submit:
  - Call `campaignRepository.createCampaign({ name, description, system: 'dragonbane', status: 'active', ... })`
  - After creation, call `setActiveCampaign(newCampaign.id)` to make it active
  - Close modal
- On cancel: close modal without saving
- Tap target for submit button: min 44×44 px
- Inline styles with CSS variables

### 2. Update Campaign Header / Selector Overlay

**File:** `src/components/shell/CampaignHeader.tsx` (from SS-01)

- Campaign selector overlay (opened by tapping the header):
  - Lists all campaigns from `campaignRepository.getAllCampaigns()`
  - Each campaign item tappable (≥ 44×44 px) — calls `setActiveCampaign(id)`
  - Active campaign marked with visual indicator (CSS variable accent color)
  - "+ Create Campaign" action at bottom — opens `CampaignCreateModal`
- Overlay closes on campaign selection or outside tap

### 3. Create Session Tab Screen

**File:** `src/screens/SessionScreen.tsx`

#### States to render:

**No active campaign:**
```tsx
// Prompt card per AC-S1-04
<NoCampaignPrompt />
```

**Active campaign, no active session:**
```tsx
<div>
  <h2>{activeCampaign.name}</h2>
  <p>{lastSessionSummary || 'No sessions yet.'}</p>
  <button onClick={handleStartSession} style={{ minHeight: 44, minWidth: 44 }}>
    Start Session
  </button>
</div>
```

**Active session:**
```tsx
<div>
  <h2>{activeSession.title}</h2>
  <p>Started: {formatTime(activeSession.startedAt)}</p>
  <button onClick={handleEndSession} style={{ minHeight: 44, minWidth: 44 }}>
    End Session
  </button>
</div>
```

#### Handlers:

```ts
const handleStartSession = async () => {
  await startSession();  // from CampaignContext
};

const handleEndSession = () => {
  setShowEndConfirm(true);  // show confirmation modal
};

const confirmEndSession = async () => {
  await endSession();  // from CampaignContext
  setShowEndConfirm(false);
};
```

### 4. Create End Session Confirmation Modal

**File:** `src/features/campaign/EndSessionModal.tsx` (or inline in SessionScreen)

- Modal or drawer
- Text: "End this session?" + session title
- Two buttons: "Confirm" (calls `confirmEndSession`) and "Cancel"
- Tap targets ≥ 44×44 px

### 5. "Last session summary" helper

In `SessionScreen.tsx`:
- After hydration, if no `activeSession`, fetch sessions for campaign via `sessionRepository.getSessionsByCampaign(campaignId)`
- Sort by `date` descending, take first
- Display: `Last session: ${lastSession.title} on ${formatDate(lastSession.date)}`

### 6. Register SessionScreen route

- In router config, map `/session` to `<SessionScreen />`
- Ensure it's rendered inside `ShellLayout` (from SS-01)

---

## Verification Commands

```
# TypeScript check
npx tsc --noEmit

# Manual flow verification (AC-S7-01 through AC-S7-08):
# 1. Open app with empty DB → Session tab shows "no campaign" prompt
# 2. Tap campaign header → selector overlay opens, shows "+ Create Campaign"
# 3. Tap "+ Create Campaign" → modal opens, fill "name" → save
#    → campaign appears in selector, header shows campaign name
# 4. Session tab now shows "Start Session" button
# 5. Tap "Start Session" → session record created in IndexedDB, button changes to "End Session"
# 6. Tap "End Session" → confirmation modal appears
# 7. Confirm → session.status = "ended" in IndexedDB, button returns to "Start Session"
# 8. Session tab shows last session summary (title + date)
# 9. Start another session → "Start Session" works again (no duplicate active sessions)
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `src/screens/SessionScreen.tsx` |
| **Create** | `src/features/campaign/CampaignCreateModal.tsx` |
| **Create** | `src/features/campaign/EndSessionModal.tsx` |
| **Modify** | `src/components/shell/CampaignHeader.tsx` — add campaign list + create action to selector overlay |
| **Modify** | Router config — register `/session` route |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-02` All new IDs use `generateId()`; timestamps use `nowISO()`
- `XC-03` Inline `style={{}}` with CSS variables
- `XC-04` Named exports only
- `XC-06` `showToast()` for user-facing errors
