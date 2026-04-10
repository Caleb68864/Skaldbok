---
scenario_id: "SR-03"
title: "KB node repository CRUD operations"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - database
  - ss-01
---

# Scenario SR-03: KB node repository CRUD operations

## Description
Verifies that kb_nodes can be created, read, and deleted through the repository layer using Dexie operations in the browser context.

## Preconditions
- App is built and running at https://localhost:4173
- At least one campaign exists in IndexedDB

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Use `browser_snapshot` to confirm the app has loaded
3. Use `browser_evaluate` to get the current campaignId:
   ```js
   const campaigns = await window.__db.campaigns.toArray();
   return campaigns[0]?.id;
   ```
4. Use `browser_evaluate` to create a kb_node via upsertNode:
   ```js
   const node = {
     id: 'test-node-sr03',
     campaignId: '<campaignId from step 3>',
     type: 'person',
     scope: 'campaign',
     label: 'SR-03 Test NPC',
     sourceId: null,
     tags: ['test'],
     createdAt: new Date().toISOString(),
     updatedAt: new Date().toISOString()
   };
   await window.__db.kb_nodes.put(node);
   return 'created';
   ```
5. Use `browser_evaluate` to read the node back by ID:
   ```js
   const found = await window.__db.kb_nodes.get('test-node-sr03');
   return JSON.stringify(found);
   ```
6. Verify the returned object has label 'SR-03 Test NPC', type 'person', and scope 'campaign'
7. Use `browser_evaluate` to delete the node:
   ```js
   await window.__db.kb_nodes.delete('test-node-sr03');
   return 'deleted';
   ```
8. Use `browser_evaluate` to verify deletion:
   ```js
   const gone = await window.__db.kb_nodes.get('test-node-sr03');
   return gone === undefined ? 'confirmed-deleted' : 'still-exists';
   ```

## Expected Results
- Node is created successfully and returns 'created'
- getNodeById returns a node with correct label, type, and scope
- delete operation completes without error
- Subsequent get returns undefined, confirming deletion

## Execution Tool
playwright — Use browser_evaluate to run Dexie CRUD operations directly

## Pass / Fail Criteria
- **Pass:** Node is created, retrieved with correct fields, deleted, and confirmed absent
- **Fail:** Any CRUD operation throws an error, or the node persists after deletion
