---
title: "UI Overhaul Test Plan"
project: "Skaldmark"
date: 2026-04-03
type: test-plan
tags:
  - test-plan
  - skaldmark
  - ui-overhaul
---

# Test Plan: UI Overhaul

## Meta
- Project: Skaldmark
- Date: 2026-04-03
- Author: Forge
- Spec Source: Codebase scan + design plan
- Scope: Full UI overhaul — Tailwind + Lucide + shadcn/ui
- Test Tool: Playwright (MCP)
- App URL: https://localhost:4173

## Prerequisites
- App built and preview server running at https://localhost:4173
- Test data: at least one campaign with an active character and session
- All three themes available (dark, parchment, light)

## Scenarios

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| UI-01 | Sheet screen renders with all sections | Screens | High | No |
| UI-02 | Skills screen renders | Screens | High | No |
| UI-03 | Gear screen renders | Screens | Medium | No |
| UI-04 | Magic screen renders | Screens | Medium | No |
| UI-05 | Session screen renders with log | Screens | High | No |
| UI-06 | Reference screen renders with tabs | Screens | Medium | No |
| UI-07 | Settings screen renders all options | Screens | Medium | No |
| UI-08 | Character Library screen renders | Screens | High | No |
| UI-09 | BottomNav shows Lucide icons and navigates | Shell | High | No |
| UI-10 | CharacterSubNav tabs switch content | Shell | High | No |
| UI-11 | CampaignHeader shows campaign info | Shell | High | No |
| UI-12 | GlobalFAB opens quick actions | Shell | High | No |
| UI-13 | Dialog opens and closes (keyboard + click) | Components | High | No |
| UI-14 | Theme switching works without reload | Components | High | No |
| UI-15 | Responsive layout — Galaxy S25 phone | Responsive | High | No |
| UI-16 | Responsive layout — iPad tablet | Responsive | High | No |
| UI-17 | Responsive layout — Galaxy A9 tablet | Responsive | Medium | No |
| UI-18 | Responsive layout — Desktop | Responsive | Medium | No |
| UI-19 | No inline styles remain in components | Audit | High | No |
| UI-20 | Touch targets meet 44px minimum | Audit | High | No |

## Coverage Summary
- Total scenarios: 20
- Screen tests: 8
- Shell component tests: 4
- Component tests: 2
- Responsive tests: 4
- Audit tests: 2
- Sequential scenarios: 0
