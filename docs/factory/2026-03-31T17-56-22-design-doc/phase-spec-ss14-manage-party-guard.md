# Phase Spec — SS-14: Manage Party No-Campaign Guard
**Sub-Spec:** SPEC-B4-1
**Issue:** #1
**Batch:** 4 — Feedback & Guards
**Dependency:** None within Batch 4. Complete Batches 1–3 before starting Batch 4.

---

## Intent
Prevent confusing state when a user tries to add a party member before creating a campaign. Show a warning toast and optionally offer a shortcut to create a campaign.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Read & modify | Manage Party screen / party member add entry point (search for "ManageParty", "AddMember", or "party" in `src/features`) |
| Reference | `src/features/campaign/CampaignContext.tsx` — `useCampaign().activeCampaign` |
| Reference | `src/context/ToastContext.tsx` — `useToast().showToast(message, variant)` |

---

## Implementation Steps

1. **Search** the codebase for the Manage Party screen and the party member add entry point (button, form, or action).
2. **Read** the relevant file(s) to understand the current add-member flow.
3. **Read** `src/features/campaign/CampaignContext.tsx` to confirm the `activeCampaign` field shape.
4. **Add guard** at the party member add entry point:
   - Check `useCampaign().activeCampaign`.
   - **If no campaign:** call `showToast("Create a campaign first", "warning")` and abort the add action. Optionally render an inline "Create Campaign" shortcut link/button near the disabled add control.
   - **If campaign exists:** proceed with existing add-member flow.
5. **Add auto-create logic**: if a campaign exists but no party record exists for it, auto-create the party record when the first member is added (do not require the user to explicitly create a party).

---

## Acceptance Criteria

- [ ] **B4-1-AC1:** Attempting to add a party member with no campaign shows toast `"Create a campaign first"`.
- [ ] **B4-1-AC2:** With a campaign but no party record, the party record is auto-created on first member add.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- No Dexie schema version bump.
- All CSS via CSS variables — no hardcoded colors.
- All touch targets ≥ 44 px.
