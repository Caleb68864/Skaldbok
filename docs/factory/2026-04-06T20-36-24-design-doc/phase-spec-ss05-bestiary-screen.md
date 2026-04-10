# Phase Spec — SS-05: Bestiary Screen

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 1.2 — Feature A: Bestiary Screen
**Depends on:** SS-04 (repositories) must be completed first. SS-02 (Zod schemas) must be completed first.
**Delivery order note:** Step 5 in execution sequence.

---

## Objective

Build a campaign-scoped CRUD UI for creature templates. The screen must support searching by name/tag, filtering by category, browsing cards, and tapping to view/edit a full stat block. The Bestiary must be accessible from the session screen (when a campaign is active) and from main navigation.

---

## Files to Create

- `src/features/bestiary/BestiaryScreen.tsx` — **create new**
- `src/features/bestiary/CreatureTemplateCard.tsx` — **create new**
- `src/features/bestiary/CreatureTemplateForm.tsx` — **create new**
- `src/features/bestiary/useBestiary.ts` — **create new**

## Files to Modify

- Navigation file (locate the main nav — likely `src/navigation/` or `src/App.tsx`) — add Bestiary route/tab
- Session screen (locate `src/screens/SessionScreen.tsx` or similar) — add "Bestiary" button when campaign is active

---

## Implementation Steps

### Step 1: Inspect existing patterns

Before writing, inspect one existing screen + hook pair (e.g., Notes or Characters) to match:
- How the active campaign ID is retrieved from context/store
- Navigation patterns (React Navigation or similar)
- Card component patterns
- Form component patterns (modal vs. drawer vs. inline)
- Toast/feedback patterns
- Tailwind v4 + shadcn/ui component usage

### Step 2: Implement `useBestiary.ts`

```typescript
// src/features/bestiary/useBestiary.ts
import { useState, useEffect, useCallback } from 'react';
import { CreatureTemplate } from '../../types/creatureTemplate';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';

type CategoryFilter = 'all' | 'monster' | 'npc' | 'animal';

export function useBestiary(campaignId: string) {
  const [templates, setTemplates] = useState<CreatureTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showArchived, setShowArchived] = useState(false);

  const loadTemplates = useCallback(async () => {
    const all = await creatureTemplateRepository.listByCampaign(campaignId);
    setTemplates(all);
  }, [campaignId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const filtered = templates.filter((t) => {
    if (!showArchived && t.status === 'archived') return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const create = useCallback(
    async (data: Omit<CreatureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>) => {
      await creatureTemplateRepository.create(data);
      await loadTemplates();
    },
    [loadTemplates]
  );

  const update = useCallback(
    async (id: string, patch: Partial<CreatureTemplate>) => {
      await creatureTemplateRepository.update(id, patch);
      await loadTemplates();
    },
    [loadTemplates]
  );

  const archive = useCallback(
    async (id: string) => {
      await creatureTemplateRepository.archive(id);
      await loadTemplates();
    },
    [loadTemplates]
  );

  return {
    templates: filtered,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    showArchived,
    setShowArchived,
    create,
    update,
    archive,
  };
}
```

### Step 3: Implement `CreatureTemplateCard.tsx`

A card component that displays:
- Creature name (bold)
- Category badge (monster / npc / animal)
- HP, Armor, Movement summary line
- Tags (as chips)
- Tap → navigate to stat block view or open detail modal

Match the existing card style (shadcn/ui Card or equivalent).

### Step 4: Implement `CreatureTemplateForm.tsx`

A form component (modal, drawer, or screen — match existing form patterns) with fields:
- Name (required text input)
- Category (select: monster / npc / animal)
- Role, Affiliation (optional text)
- HP, Armor, Movement (number inputs)
- Attacks (repeating group: name, damage, range, skill, special)
- Abilities (repeating group: name, description)
- Skills (repeating group: name, value)
- Tags (tag input)
- Image URL (optional)
- Save / Cancel buttons

Pre-populate all fields when editing an existing template.

### Step 5: Implement `BestiaryScreen.tsx`

```tsx
// src/features/bestiary/BestiaryScreen.tsx
// Renders:
// - Search input (top)
// - Category filter tabs/buttons: All | Monster | NPC | Animal
// - "Show archived" toggle
// - Scrollable list of CreatureTemplateCards
// - FAB or button: "New Creature" → opens CreatureTemplateForm
// - Tapping a card → opens stat block view (inline expanded or navigate to detail screen)
```

The stat block view (expanded from card or separate screen) must display:
- Name, category, role, affiliation
- HP, Armor, Movement
- Attacks table (name, damage, range, skill, special)
- Abilities list
- Skills list
- Tags
- Edit button → opens CreatureTemplateForm pre-populated
- Archive button (with confirmation)

### Step 6: Wire navigation entry points

1. **Session screen** — add a "Bestiary" button that is visible only when `campaignId` is set. Tapping navigates to `BestiaryScreen`.
2. **Main navigation** — add a Bestiary tab/item in the main nav (match existing nav pattern — do not break existing tabs).

---

## Verification Commands

```bash
npx tsc --noEmit
npm run build
```

**Manual verification:**
- Navigate to Bestiary from session screen (campaign must be active).
- Navigate to Bestiary from main nav.
- Create a new creature template — verify it appears in the list.
- Search by name — list narrows correctly.
- Search by tag — list narrows correctly.
- Filter by category — list narrows correctly.
- Tap a template card — stat block view shows all fields.
- Edit a template — changes persist.
- Archive a template — it disappears from default view; reappears with "Show archived" toggled on.

---

## Acceptance Criteria

- [ ] `BestiaryScreen` renders list of creature templates for active campaign
- [ ] Search filters templates by name and tags (case-insensitive)
- [ ] Category filter (`all` / `monster` / `npc` / `animal`) narrows list correctly
- [ ] Tapping a template opens stat block view with all fields (HP, armor, movement, attacks, abilities, skills)
- [ ] "New Creature" flow opens `CreatureTemplateForm`, saves, and new template appears in list
- [ ] Editing updates template; archiving hides from default list view
- [ ] Archived templates accessible via "Show archived" toggle
- [ ] Bestiary accessible from session screen when campaign is active
- [ ] Bestiary accessible from main navigation
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npm run build` passes with no errors

---

## Constraints

- No new npm dependencies
- Use existing UI components (shadcn/ui, Tailwind v4, Lucide icons)
- Match existing screen/card/form/navigation patterns exactly
- Do not break any existing navigation tabs or routes
- Campaign-scoped: always pass active `campaignId` to `useBestiary`
