---
scenario_id: "SR-01"
title: "Dexie v7 schema creates kb_nodes and kb_edges tables"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - database
  - ss-01
---

# Scenario SR-01: Dexie v7 schema creates kb_nodes and kb_edges tables

## Description
Verifies that the Dexie v7 migration creates the kb_nodes and kb_edges tables with correct indexes, and that existing data is preserved.

## Preconditions
- App is built and running at https://localhost:4173
- Browser has existing campaign data (or fresh install)

## Steps

1. Navigate to the app at https://localhost:4173
2. Open browser DevTools > Application > IndexedDB > SkaldbokDatabase
3. Verify `kb_nodes` table exists with indexes: id, campaignId, type, scope, label, sourceId, updatedAt, [campaignId+type]
4. Verify `kb_edges` table exists with indexes: id, campaignId, fromId, toId, type
5. Verify `notes` table index string includes `scope`
6. Run in console: `await db.kb_nodes.count()` — should return a number (0 or more)
7. Run in console: `await db.kb_edges.count()` — should return a number (0 or more)
8. Verify existing notes table data is intact (no data loss from migration)

## Expected Results
- kb_nodes table exists and is queryable
- kb_edges table exists and is queryable
- notes table has scope in its index
- No existing data was lost during migration
- No console errors during app load related to Dexie

## Execution Tool
playwright — Navigate to app URL, use `browser_evaluate` to check IndexedDB tables via Dexie API

## Pass / Fail Criteria
- **Pass:** Both tables exist, are queryable, and existing data is preserved
- **Fail:** Tables missing, indexes wrong, or data lost during migration
