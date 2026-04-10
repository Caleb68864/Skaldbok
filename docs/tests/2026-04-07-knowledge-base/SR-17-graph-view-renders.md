---
scenario_id: "SR-17"
title: "Graph View renders nodes and edges"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-10
---

# Scenario SR-17: Graph View renders nodes and edges

## Description
Verifies that navigating to /kb?view=graph renders a canvas element with colored nodes representing kb_nodes and edge lines representing kb_edges.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign exists with multiple kb_nodes and kb_edges (at least 3 nodes and 2 edges)

## Steps

1. Use `browser_navigate` to open https://localhost:4173/kb?view=graph
2. Use `browser_snapshot` to capture the graph view
3. Verify a canvas element is present on the page
4. Use `browser_take_screenshot` to visually confirm the graph rendering
5. Verify colored dots/circles are visible representing nodes
6. Verify lines connecting nodes are visible representing edges
7. Use `browser_evaluate` to check the canvas is rendering:
   ```js
   const canvas = document.querySelector('canvas');
   return canvas ? { width: canvas.width, height: canvas.height, exists: true } : { exists: false };
   ```
8. Use `browser_evaluate` to verify kb data is loaded:
   ```js
   const nodeCount = await window.__db.kb_nodes.count();
   const edgeCount = await window.__db.kb_edges.count();
   return { nodeCount, edgeCount };
   ```
9. Verify the node count and edge count are greater than 0 and consistent with what is rendered

## Expected Results
- A canvas element is rendered at /kb?view=graph
- The canvas has non-zero dimensions
- Colored nodes are visible on the canvas (different colors for different node types)
- Edge lines connect related nodes
- The graph reflects the data in kb_nodes and kb_edges

## Execution Tool
playwright — Use browser_navigate to /kb?view=graph, browser_take_screenshot to verify visual rendering

## Pass / Fail Criteria
- **Pass:** Canvas renders with visible colored nodes and edge lines matching the kb data
- **Fail:** No canvas element, canvas is blank, or no nodes/edges are visible
