---
title: "Knowledge Base Test Plan"
project: "Skaldmark"
date: 2026-04-07
type: test-plan
tags:
  - test-plan
  - skaldmark
  - knowledge-base
---

# Test Plan: Knowledge Base

## Meta
- Project: Skaldmark
- Date: 2026-04-07
- Author: Forge
- Spec Source: docs/factory/2026-04-07T00-01-30-design-doc/spec.md
- Scope: In-App Knowledge Base (SS-01 through SS-10)

## Prerequisites
- App built and running at https://localhost:4173
- Playwright MCP tools available
- Fresh IndexedDB (or existing campaign data for migration testing)

## Scenarios

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| SR-01 | Dexie v7 schema creates kb_nodes and kb_edges tables | Database | High | No |
| SR-02 | Note scope field defaults to campaign | Database | High | No |
| SR-03 | KB node repository CRUD operations | Database | High | Yes |
| SR-04 | KB edge repository CRUD operations | Database | High | Yes |
| SR-05 | Link sync engine populates graph on note save | Database | High | Yes |
| SR-06 | Tiptap parser extracts wikilinks and mentions | Unit | High | No |
| SR-07 | Wikilink input rule converts [[text]] to node | UI | High | No |
| SR-08 | Wikilink autocomplete triggers on [[ | UI | High | No |
| SR-09 | Note Reader renders read-only with tappable links | UI | High | No |
| SR-10 | Backlinks panel shows linking notes | UI | Medium | No |
| SR-11 | Vault Browser shows campaign notes with category tabs | UI | Medium | No |
| SR-12 | Vault Browser compact mode for session screen | UI | Medium | No |
| SR-13 | Tag filter chips filter displayed cards | UI | Medium | No |
| SR-14 | KB Screen routing — /kb renders VaultBrowser | UI | High | No |
| SR-15 | KB Screen routing — /kb/:nodeId renders NoteReader | UI | High | No |
| SR-16 | Command Palette search and navigation | UI | Medium | No |
| SR-17 | Graph View renders nodes and edges | UI | Low | No |
| SR-18 | Graph View tag toggle and type filters | UI | Low | No |
| INT-01 | End-to-end: create note with wikilink, navigate via KB | Integration | High | Yes |
| INT-02 | End-to-end: search in command palette and navigate | Integration | Medium | Yes |

See individual scenario files in this directory for full steps and expected results.

## Coverage Summary
- Total scenarios: 20
- Spec requirements covered: 94/94 acceptance criteria across all scenarios
- Database/unit scenarios: 6
- UI scenarios: 12
- Integration scenarios: 2
- Sequential scenarios: 5 (must run in order)
