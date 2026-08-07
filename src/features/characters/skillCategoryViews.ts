import type { CharacterSkill } from '../../types/character';
import type { SkillCategory, SkillDefinition } from '../../types/system';

/** One category as the skills list renders it: its visible rows and open state. */
export interface SkillCategoryView {
  category: SkillCategory;
  /** Rows surviving both the relevant/all filter and the name search. */
  skills: SkillDefinition[];
  open: boolean;
}

export interface SkillCategoryViewOptions {
  categories: SkillCategory[];
  characterSkills: Record<string, CharacterSkill>;
  /** The active engine's relevance predicate — never reimplement it here. */
  isRelevant: (skill: CharacterSkill | undefined) => boolean;
  filter: 'all' | 'relevant';
  /** Raw search box contents; trimmed and lower-cased internally. */
  search: string;
  /** Per-category open state the user has explicitly set. Sparse. */
  openOverrides: Record<string, boolean>;
}

/**
 * Groups a system's skills into the collapsible, searchable categories the
 * Skills screen renders.
 *
 * @remarks
 * Traveller's full Mongoose 2022 list is 103 skills across 7 categories, which
 * turned "All" into one unbroken scroll with no way to find anything. The
 * relevant/all chips alone were adequate at 35.
 *
 * Two rules are load-bearing:
 *
 * - **A search never hides a hit.** An active query forces every category with
 *   a match open, regardless of the default, so typing a skill name always
 *   reveals it rather than silently filtering behind a collapsed heading.
 * - **A user's explicit toggle always wins** over the computed default, in both
 *   directions.
 *
 * `relevantCount` reads the category's whole skill list rather than the visible
 * rows. That is currently unobservable — the `query.length > 0` clause already
 * forces open whenever filtering could narrow the set, and with no query the two
 * counts are equal under either filter — so no test pins it. It is kept because
 * it is the correct base if that clause is ever relaxed. Do not read it as
 * tested behaviour.
 *
 * Empty categories are dropped: a heading that expands to nothing is noise, and
 * the caller reports the "nothing here" state once for the screen.
 */
export function buildSkillCategoryViews({
  categories,
  characterSkills,
  isRelevant,
  filter,
  search,
  openOverrides,
}: SkillCategoryViewOptions): SkillCategoryView[] {
  const query = search.trim().toLowerCase();

  return categories
    .map(category => {
      const base = filter === 'relevant'
        ? category.skills.filter(skill => isRelevant(characterSkills[skill.id]))
        : category.skills;
      const skills = query
        ? base.filter(skill => skill.name.toLowerCase().includes(query))
        : base;
      const relevantCount = category.skills.filter(skill => isRelevant(characterSkills[skill.id])).length;
      const open = openOverrides[category.id] ?? (query.length > 0 || relevantCount > 0);
      return { category, skills, open };
    })
    .filter(view => view.skills.length > 0);
}

/** Total rows across every visible category — 0 means the screen is empty. */
export function countVisibleSkills(views: SkillCategoryView[]): number {
  return views.reduce((sum, view) => sum + view.skills.length, 0);
}
