import type { RouteStop } from '../../types/routeStop';
import { readNumericField, totalDistance } from '../routeMath';

/** Field declaration as the route planner supplies it. */
export interface RouteFieldSpec {
  id: string;
  label: string;
  type?: 'text' | 'textarea' | 'number';
}

/**
 * Renders a frontmatter value, quoting only when the content needs it.
 *
 * @remarks
 * Same shape as the helper in `renderSession`, `renderNote`,
 * `renderCampaignIndex`, `renderAttachmentSidecar` and `renderLedger` — each
 * carries a private copy. See the note in `docs/converge/` about extracting
 * them into one module.
 */
function yamlValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  const str = String(val);
  if (
    str.includes(':') ||
    str.includes('"') ||
    str.includes("'") ||
    str.includes('\n') ||
    str.includes('#')
  ) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n+/g, ' ')}"`;
  }
  return str;
}

/** Escapes a value for a Markdown table cell, where a raw pipe would split the row. */
function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/**
 * Renders a campaign's route as Markdown.
 *
 * @remarks
 * Columns and their headings come from the system's own `routePlanner.fields`
 * declaration, so this renderer contains no ruleset vocabulary — a Traveller
 * route exports UWP and parsec columns because Traveller declares them, not
 * because this file knows what a UWP is.
 *
 * `textarea` fields are pulled out of the table and rendered underneath each
 * stop: free-text notes in a table cell make the whole thing unreadable.
 *
 * @param campaignName - Title for the document.
 * @param label - The planner's own name for the route, e.g. "Jump Route".
 * @param stops - The route, already in order.
 * @param fields - The system's declared fields, in declaration order.
 * @param distanceFieldId - Which field to total, if the system declares one.
 */
export function renderRouteToMarkdown(
  campaignName: string,
  label: string,
  stops: RouteStop[],
  fields: RouteFieldSpec[],
  distanceFieldId?: string,
): string {
  const nameField = fields.find(f => f.id === 'name');
  const columnFields = fields.filter(f => f.id !== 'name' && f.type !== 'textarea');
  const proseFields = fields.filter(f => f.id !== 'name' && f.type === 'textarea');
  const total = totalDistance(stops, distanceFieldId);
  const distanceLabel = distanceFieldId
    ? fields.find(f => f.id === distanceFieldId)?.label
    : undefined;

  const lines: string[] = [];
  lines.push('---');
  lines.push('type: route');
  lines.push(`campaign: ${yamlValue(campaignName)}`);
  lines.push(`stops: ${stops.length}`);
  if (distanceLabel) lines.push(`total_distance: ${total}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${campaignName} — ${label}`);
  lines.push('');

  if (stops.length === 0) {
    lines.push('_No stops yet._');
    lines.push('');
    return lines.join('\n');
  }

  const headers = ['#', nameField?.label ?? 'Name', ...columnFields.map(f => f.label)];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

  stops.forEach((stop, index) => {
    const cells = [
      String(index + 1),
      cell(stop.name || '—'),
      ...columnFields.map(f => cell(stop.values[f.id] ?? '—')),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  });

  lines.push('');
  if (distanceLabel) {
    lines.push(`**${distanceLabel} total: ${total}**`);
    lines.push('');
  }

  const withProse = stops.filter(stop =>
    proseFields.some(f => (stop.values[f.id] ?? '').trim() !== ''),
  );
  if (withProse.length > 0) {
    lines.push('## Notes');
    lines.push('');
    for (const stop of withProse) {
      lines.push(`### ${stop.name || 'Unnamed'}`);
      lines.push('');
      for (const field of proseFields) {
        const value = (stop.values[field.id] ?? '').trim();
        if (value === '') continue;
        if (proseFields.length > 1) lines.push(`**${field.label}**`);
        lines.push(value);
        lines.push('');
      }
    }
  }

  // Surfaced so an unparseable distance is visible in the export rather than
  // silently counting as zero in the total above.
  if (distanceFieldId) {
    const unreadable = stops.filter(stop => {
      const raw = (stop.values[distanceFieldId] ?? '').trim();
      return raw !== '' && readNumericField(stop.values, distanceFieldId) === 0 && raw !== '0';
    });
    if (unreadable.length > 0) {
      lines.push(
        `_${unreadable.length} stop(s) have a ${distanceLabel ?? 'distance'} that could not be read as a number and count as 0 in the total._`,
      );
      lines.push('');
    }
  }

  return lines.join('\n');
}
