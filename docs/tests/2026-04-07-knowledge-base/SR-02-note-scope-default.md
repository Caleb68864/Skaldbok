---
scenario_id: "SR-02"
title: "Note scope field defaults to campaign"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - database
  - ss-01
---

# Scenario SR-02: Note scope field defaults to campaign

## Description
Verifies that notes without a scope field default to 'campaign' when parsed through baseNoteSchema, and that notes with scope 'shared' parse correctly.

## Preconditions
- App is built and running

## Steps

1. Navigate to app
2. Use browser_evaluate to test Zod schema parsing:
   ```js
   // Test 1: note without scope defaults to 'campaign'
   const result1 = baseNoteSchema.parse({ id: 'test', campaignId: 'c1', sessionId: 's1', title: 'Test', body: null, type: 'generic', typeData: {}, status: 'active', pinned: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
   console.log('scope:', result1.scope); // should be 'campaign'
   
   // Test 2: note with scope 'shared' parses correctly
   const result2 = baseNoteSchema.parse({ ...result1, scope: 'shared' });
   console.log('scope:', result2.scope); // should be 'shared'
   ```
3. Verify both parse without errors

## Expected Results
- Omitting scope results in scope = 'campaign'
- Providing scope = 'shared' parses correctly
- No Zod validation errors

## Execution Tool
playwright — Use browser_evaluate to run schema parsing tests in the app context

## Pass / Fail Criteria
- **Pass:** Default scope is 'campaign', explicit 'shared' works
- **Fail:** Scope is undefined when omitted, or validation error on 'shared'
