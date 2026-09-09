import { cn } from '../../lib/utils';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { GameIcon } from '../../components/primitives/GameIcon';
import { RepeatableRows } from '../../components/fields/RepeatableRows';

/** One row of a declared table panel: string values keyed by column. */
type RepeatableRow = Record<string, string>;
import type { SheetPanelDefinition, SheetPanelSection } from '../../types/system';

/** Props for {@link SystemDataPanel}. */
export interface SystemDataPanelProps {
  panel: SheetPanelDefinition;
  /** Reads a `systemData` string by key. */
  readText: (key: string) => string;
  /** Writes a `systemData` string by key. */
  writeText: (key: string, value: string) => void;
  /** Reads a `systemData` row array by key. */
  readRows: (key: string) => RepeatableRow[];
  /** Writes a `systemData` row array by key. */
  writeRows: (key: string, rows: RepeatableRow[]) => void;
  /** Whether the fields accept edits, from the sheet's play-mode guard. */
  editable: boolean;
  /** Class applied to a section heading, so declared panels match the sheet. */
  headingClass: string;
  /** Class applied to an input, from the sheet's shared helper. */
  inputClass: (editable: boolean) => string;
}

/**
 * Renders one ruleset-declared sheet panel.
 *
 * @remarks
 * Replaces four hand-written panels — Traveller's Careers and Augments, Savage
 * Worlds' Edges and Hindrances — which were ~175 lines of JSX inside
 * `SheetScreen` plus their column layouts as module constants. Every one bound
 * a `systemData` key to either a text area or a table of rows, so the shape was
 * always declarable; it just was not declared.
 *
 * The markup is deliberately identical to what those panels emitted, so a
 * system that declares its panels renders exactly as before.
 */
export function SystemDataPanel({
  panel,
  readText,
  writeText,
  readRows,
  writeRows,
  editable,
  headingClass,
  inputClass,
}: SystemDataPanelProps) {
  // A single unlabelled text block is its own panel body — Edges and
  // Hindrances — rather than a heading over a box.
  const single =
    panel.sections.length === 1 && panel.sections[0].kind === 'text' && !panel.sections[0].label
      ? panel.sections[0]
      : null;

  return (
    <SectionPanel
      title={panel.title}
      icon={panel.icon ? <GameIcon name={panel.icon} size={18} /> : undefined}
      collapsible
      defaultOpen
    >
      {single ? (
        <TextSection
          section={single}
          readText={readText}
          writeText={writeText}
          editable={editable}
          inputClass={inputClass}
        />
      ) : (
        <div className="flex flex-col gap-[var(--space-lg)]">
          {panel.sections.map(section => (
            <div key={`${section.kind}:${section.key}`}>
              {section.kind === 'rows' ? (
                <>
                  {section.heading && <h4 className={headingClass}>{section.heading}</h4>}
                  <RepeatableRows
                    columns={section.columns}
                    rows={readRows(section.key)}
                    onChange={rows => writeRows(section.key, rows)}
                    editable={editable}
                    addLabel={section.addLabel}
                    emptyLabel={section.emptyLabel}
                  />
                </>
              ) : (
                <TextSection
                  section={section}
                  readText={readText}
                  writeText={writeText}
                  editable={editable}
                  inputClass={inputClass}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

/** One free-text block bound to a `systemData` string. */
function TextSection({
  section,
  readText,
  writeText,
  editable,
  inputClass,
}: {
  section: Extract<SheetPanelSection, { kind: 'text' }>;
  readText: (key: string) => string;
  writeText: (key: string, value: string) => void;
  editable: boolean;
  inputClass: (editable: boolean) => string;
}) {
  return (
    <>
      {section.label && (
        <label
          htmlFor={`sysdata-${section.key}`}
          className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]"
        >
          {section.label}
        </label>
      )}
      <textarea
        id={`sysdata-${section.key}`}
        aria-label={section.label ?? section.key}
        className={cn(
          inputClass(editable),
          editable ? 'field--editable' : 'field--locked',
        )}
        style={{ minHeight: `${section.minHeight ?? 80}px` }}
        placeholder={section.placeholder}
        value={readText(section.key)}
        disabled={!editable}
        onChange={e => writeText(section.key, e.target.value)}
      />
    </>
  );
}
