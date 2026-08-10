import type { Campaign } from '../../types/campaign';
import type { Session } from '../../types/session';
import type { Note } from '../../types/note';
import { yamlValue } from './yamlValue';


/**
 * Renders a campaign's top-level index Markdown file.
 *
 * @remarks
 * The landing page of a campaign export: front matter plus wiki-linked sections
 * for sessions, NPCs, and open rumors. Empty sections render an explicit
 * "None yet" line rather than being omitted, so the structure is predictable in
 * the reader's vault.
 */
export function renderCampaignIndex(
  campaign: Campaign,
  sessions: Session[],
  npcs: Note[],
  openRumors: Note[]
): string {
  const frontMatterFields: Record<string, unknown> = {
    title: campaign.name,
    id: campaign.id,
    system: campaign.system,
    status: campaign.status,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
  const frontMatterLines = Object.entries(frontMatterFields)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`);
  const frontMatter = `---\n${frontMatterLines.join('\n')}\n---`;

  const sessionSection = sessions.length > 0
    ? `## Sessions\n\n` + sessions.map(s => `- [[${s.title}]]`).join('\n') + '\n'
    : `## Sessions\n\nNo sessions yet.\n`;

  const npcSection = npcs.length > 0
    ? `## NPCs\n\n` + npcs.map(n => `- [[${n.title}]]`).join('\n') + '\n'
    : `## NPCs\n\nNo NPCs yet.\n`;

  const rumorsSection = openRumors.length > 0
    ? `## Open Rumors\n\n` + openRumors.map(r => `- [[${r.title}]]`).join('\n') + '\n'
    : `## Open Rumors\n\nNo open rumors.\n`;

  return `${frontMatter}\n\n${sessionSection}\n${npcSection}\n${rumorsSection}`;
}
