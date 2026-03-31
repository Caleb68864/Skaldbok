---
scenario_id: "UI-12"
title: "Bottom nav and character sub-nav routing"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-12: Bottom nav and character sub-nav routing

## Description
Verify the three-tab bottom navigation bar (Session, Notes, Character) routes to the correct screens, the character sub-nav tabs (Sheet, Skills, Gear, Magic, Combat) switch views within the character section, and the More screen links (Settings, Reference, Character Library, Profile) navigate correctly.

## Preconditions
- App is running at localhost (default port)
- At least one campaign exists and is active (so Session and Notes screens render content rather than NoCampaignPrompt)

## Steps
1. Navigate to `/session`
2. Verify the bottom nav has three links: "Session", "Notes", "Character"
3. Verify "Session" link is highlighted (active color, font-weight 600)
4. Verify the Session screen content is visible (campaign name heading)
5. Click the "Notes" link in the bottom nav
6. Verify the URL is now `/notes`
7. Verify "Notes" link is highlighted in the bottom nav
8. Verify the Notes screen action bar is visible (buttons: "Quick Note", "Quick NPC", "Location")
9. Click the "Character" link in the bottom nav
10. Verify the URL starts with `/character`
11. Verify "Character" link is highlighted in the bottom nav
12. Verify the character sub-nav bar is visible with tabs: "Sheet", "Skills", "Gear", "Magic", "Combat"
13. Verify "Sheet" tab is active (accent background color)
14. Click the "Skills" tab in the character sub-nav
15. Verify the URL is `/character/skills`
16. Verify "Skills" tab is now active
17. Click the "Gear" tab in the character sub-nav
18. Verify the URL is `/character/gear`
19. Click the "Magic" tab in the character sub-nav
20. Verify the URL is `/character/magic`
21. Click the "Combat" tab in the character sub-nav
22. Verify the URL is `/character/combat`
23. Click the hamburger menu button (aria-label "Menu") in the campaign header
24. Verify the hamburger menu overlay appears with links: "Settings", "Reference", "Character Library", "Profile"
25. Click "Settings" in the hamburger menu
26. Verify the URL is `/settings` and the Settings heading is visible
27. Navigate to `/character/sheet`
28. Click the hamburger menu button again
29. Click "Reference" in the hamburger menu
30. Verify the URL is `/reference`
31. Navigate to `/character/sheet`
32. Click the hamburger menu button again
33. Click "Character Library" in the hamburger menu
34. Verify the URL is `/library`
35. Navigate to `/character/sheet`
36. Click the hamburger menu button again
37. Click "Profile" in the hamburger menu
38. Verify the URL is `/profile`

## Expected Results
- Bottom nav Session/Notes/Character links navigate to `/session`, `/notes`, `/character/sheet` respectively
- Active bottom nav link is visually highlighted
- Character sub-nav tabs navigate to `/character/sheet`, `/character/skills`, `/character/gear`, `/character/magic`, `/character/combat`
- Active character sub-nav tab has accent background
- Hamburger menu links navigate to `/settings`, `/reference`, `/library`, `/profile`

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All navigation links route to their correct URLs and the active state indicators update accordingly
- **Fail:** Any link navigates to the wrong route, active states do not update, or character sub-nav is missing on character pages
