---
title: "Skaldmark Full Coverage Test Plan"
project: "Skaldmark"
date: 2026-03-31
type: test-plan
tags:
  - test-plan
  - skaldmark
---

# Test Plan: Skaldmark Full Coverage

## Meta
- Project: Skaldmark
- Date: 2026-03-31
- Author: Forge
- Spec Source: Codebase scan + 2 Forge specs (Universal Note Model, Note Image Attachments)
- Scope: Full Codebase
- Test Tool: Playwright (MCP)
- Data Strategy: Self-contained (each scenario sets up and tears down its own data)
- Priority: Equal across all areas

## Prerequisites
- Application running locally (typically `npm run dev`)
- Playwright MCP tools available in session
- Clean IndexedDB state (or scenarios handle own setup/teardown)
- No specific environment variables required (client-side only app)

## Scenarios

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| UI-01 | Sheet Screen - Character Data Display | UI | Equal | No |
| UI-02 | Profile Screen - Portrait and Bio Editing | UI | Equal | No |
| UI-03 | Combat Screen - Combat Management | UI | Equal | No |
| UI-04 | Session Screen - Session Lifecycle | UI | Equal | Yes |
| UI-05 | Notes Screen - Note Management | UI | Equal | Yes |
| UI-06 | Gear Screen - Equipment Management | UI | Equal | No |
| UI-07 | Magic Screen - Spells and Abilities | UI | Equal | No |
| UI-08 | Skills Screen - Skill Management | UI | Equal | No |
| UI-09 | Character Library - Character CRUD | UI | Equal | Yes |
| UI-10 | Reference Screen - Reference Notes | UI | Equal | No |
| UI-11 | Settings Screen - Configuration | UI | Equal | No |
| UI-12 | Navigation - Bottom Nav and Sub-Nav | UI | Equal | No |
| UI-13 | Campaign Create Modal | UI | Equal | Yes |
| UI-14 | Manage Party Drawer | UI | Equal | Yes |
| UI-15 | Quick Note Drawer | UI | Equal | Yes |
| UI-16 | Quick NPC Drawer | UI | Equal | Yes |
| UI-17 | Quick Location Drawer | UI | Equal | Yes |
| UI-18 | Link Note Drawer | UI | Equal | Yes |
| UI-19 | Combat Timeline - Event Logging | UI | Equal | Yes |
| UI-20 | Printable Sheet Screen | UI | Equal | No |
| DB-01 | Character Repository CRUD | Database | Equal | Yes |
| DB-02 | Campaign Repository CRUD | Database | Equal | Yes |
| DB-03 | Session Repository CRUD | Database | Equal | Yes |
| DB-04 | Note Repository CRUD | Database | Equal | Yes |
| DB-05 | Attachment Repository CRUD | Database | Equal | Yes |
| DB-06 | EntityLink Operations | Database | Equal | Yes |
| DB-07 | Party and PartyMember Operations | Database | Equal | Yes |
| DB-08 | Settings Persistence | Database | Equal | Yes |
| DB-09 | Reference Notes CRUD | Database | Equal | Yes |
| DB-10 | Cascade Delete - Note Attachments and Links | Database | Equal | Yes |
| DB-11 | Clear All Data from Settings | Database | Equal | Yes |
| SR-01 | Universal Note Model - Base Schema Validation | Spec | Equal | No |
| SR-02 | MiniSearch Full-Text Search | Spec | Equal | Yes |
| SR-03 | Attachment Type and DB Migration | Spec | Equal | Yes |
| SR-04 | Attachment Repository CRUD Validation | Spec | Equal | Yes |
| SR-05 | useNoteAttachments Hook and UI Components | Spec | Equal | Yes |
| SR-06 | Wire Attachments into Note Flows | Spec | Equal | Yes |
| SR-07 | Export Pipeline - Sidecar and Binary Support | Spec | Equal | Yes |
| EC-01 | Empty State - No Characters | Edge Case | Equal | No |
| EC-02 | Empty State - No Campaigns | Edge Case | Equal | No |
| EC-03 | Empty State - No Notes | Edge Case | Equal | No |
| EC-04 | Max 10 Attachment Limit | Edge Case | Equal | Yes |
| EC-05 | Image Resize Validation | Edge Case | Equal | No |
| EC-06 | Long Text in Note Titles and Bodies | Edge Case | Equal | Yes |
| EC-07 | Form Validation Errors | Edge Case | Equal | No |
| EC-08 | Orphaned Party Members After Character Delete | Edge Case | Equal | Yes |
| EC-09 | Offline and PWA Behavior | Edge Case | Equal | No |
| EC-10 | IndexedDB Quota Limits | Edge Case | Equal | No |
| EC-11 | PWA Install Flow | Edge Case | Equal | No |

See individual scenario files in `.holdout/` directory for full steps and expected results.

## Holdout Scenarios

50 scenarios are stored as holdouts in `.holdout/`. These are invisible to agents during `/forge-run` and only evaluated by `/forge-test-run`.

| ID | Title | Area |
|----|-------|------|
| UI-01 | Sheet Screen - Character Data Display | UI |
| UI-02 | Profile Screen - Portrait and Bio Editing | UI |
| UI-03 | Combat Screen - Combat Management | UI |
| UI-04 | Session Screen - Session Lifecycle | UI |
| UI-05 | Notes Screen - Note Management | UI |
| UI-06 | Gear Screen - Equipment Management | UI |
| UI-07 | Magic Screen - Spells and Abilities | UI |
| UI-08 | Skills Screen - Skill Management | UI |
| UI-09 | Character Library - Character CRUD | UI |
| UI-10 | Reference Screen - Reference Notes | UI |
| UI-11 | Settings Screen - Configuration | UI |
| UI-12 | Navigation - Bottom Nav and Sub-Nav | UI |
| UI-13 | Campaign Create Modal | UI |
| UI-14 | Manage Party Drawer | UI |
| UI-15 | Quick Note Drawer | UI |
| UI-16 | Quick NPC Drawer | UI |
| UI-17 | Quick Location Drawer | UI |
| UI-18 | Link Note Drawer | UI |
| UI-19 | Combat Timeline - Event Logging | UI |
| UI-20 | Printable Sheet Screen | UI |
| DB-01 through DB-11 | Database CRUD and integrity | Database |
| SR-01 through SR-07 | Spec requirement validation | Spec |
| EC-01 through EC-11 | Edge cases and error scenarios | Edge Case |

## Coverage Summary
- Total scenarios: 50
- UI component tests: 20/23 interactive components
- Database table tests: 11/12 tables (metadata tested implicitly)
- Spec requirement tests: 7 from 2 spec files
- Edge case tests: 11
- Sequential scenarios: 28 (must run in order due to shared state mutations)
