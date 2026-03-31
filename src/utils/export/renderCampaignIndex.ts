import type { Campaign } from '../../types/campaign';
import type { Session } from '../../types/session';
import type { Note } from '../../types/note';

function yamlValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return '\n' + val.map(item => `  - ${yamlValue(item)}`).join('\n');
  }
  const str = String(val);
  if (str.includes(':') || str.includes('"') || str.includes("'") || str.includes('\n') || str.includes('#')) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

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
