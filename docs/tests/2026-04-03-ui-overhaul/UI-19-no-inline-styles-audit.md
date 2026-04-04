---
scenario_id: "UI-19"
title: "No inline styles remain in components"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - audit
---

# Scenario UI-19: No inline styles remain in components

## Description
Audit that inline style={{}} props have been removed from all migrated components. Only the SectionPanel grid-template-rows dynamic style should remain.

## Preconditions
- Access to the source code

## Steps

1. Run: `grep -rn "style={{" src/ --include="*.tsx"` via bash
2. Count the matches
3. Verify only acceptable remaining inline styles exist (SectionPanel grid animation)

## Expected Results
- Maximum 1 match: `src/components/primitives/SectionPanel.tsx` (gridTemplateRows for collapse animation)
- Zero matches in: src/screens/, src/components/ui/, src/components/shell/, src/components/fields/, src/features/

## Execution Tool
bash — Run grep command from repository root

## Pass / Fail Criteria
- **Pass:** 0-1 inline style matches (only SectionPanel grid trick)
- **Fail:** More than 1 inline style match
