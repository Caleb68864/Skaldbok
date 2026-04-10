---
scenario_id: "SR-04"
title: "KB edge repository CRUD operations"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - database
  - ss-01
---

# Scenario SR-04: KB edge repository CRUD operations

## Description
Verifies that kb_edges can be created, queried by fromId, and deleted through Dexie operations in the browser context.

## Preconditions
- App is built and running at https://localhost:4173
- At least one campaign exists in IndexedDB
- Two kb_nodes exist (or will be created as part of setup)

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Use `browser_snapshot` to confirm the app has loaded
3. Use `browser_evaluate` to set up two test nodes and an edge:
   ```js
   const campaignId = (await window.__db.campaigns.toArray())[0]?.id;
   const now = new Date().toISOString();
   await window.__db.kb_nodes.bulkPut([
     { id: 'sr04-node-a', campaignId, type: 'person', scope: 'campaign', label: 'Node A', sourceId: null, tags: [], createdAt: now, updatedAt: now },
     { id: 'sr04-node-b', campaignId, type: 'place', scope: 'campaign', label: 'Node B', sourceId: null, tags: [], createdAt: now, updatedAt: now }
   ]);
   await window.__db.kb_edges.put({
     id: 'sr04-edge-1',
     campaignId,
     fromId: 'sr04-node-a',
     toId: 'sr04-node-b',
     type: 'mentions',
     createdAt: now
   });
   return 'setup-complete';
   ```
4. Use `browser_evaluate` to query edges from node A:
   ```js
   const edges = await window.__db.kb_edges.where('fromId').equals('sr04-node-a').toArray();
   return JSON.stringify(edges);
   ```
5. Verify the returned array contains one edge with toId 'sr04-node-b' and type 'mentions'
6. Use `browser_evaluate` to delete the edge:
   ```js
   await window.__db.kb_edges.delete('sr04-edge-1');
   return 'deleted';
   ```
7. Use `browser_evaluate` to verify deletion:
   ```js
   const remaining = await window.__db.kb_edges.where('fromId').equals('sr04-node-a').toArray();
   return remaining.length === 0 ? 'confirmed-deleted' : 'still-exists';
   ```
8. Use `browser_evaluate` to clean up test nodes:
   ```js
   await window.__db.kb_nodes.bulkDelete(['sr04-node-a', 'sr04-node-b']);
   return 'cleanup-done';
   ```

## Expected Results
- Both nodes and the edge are created without errors
- Querying edges by fromId returns the correct edge
- Edge deletion completes successfully
- Post-deletion query returns an empty array
- Cleanup removes test nodes

## Execution Tool
playwright — Use browser_evaluate to run Dexie CRUD operations directly

## Pass / Fail Criteria
- **Pass:** Edge is created, queried correctly by fromId, deleted, and confirmed absent
- **Fail:** Any operation throws an error, query returns wrong results, or edge persists after deletion
