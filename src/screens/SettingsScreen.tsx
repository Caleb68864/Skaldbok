import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../context/AppStateContext';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAutosave } from '../hooks/useAutosave';
import { Card } from '../components/primitives/Card';
import { Button } from '../components/primitives/Button';
import { StorageSafetyCard } from '../features/settings/StorageSafetyCard';
import { Modal } from '../components/primitives/Modal';
import { db } from '../storage/db/client';
import * as characterRepository from '../storage/repositories/characterRepository';
import { type ThemeName, THEME_LIST, THEME_DISPLAY_NAMES } from '../theme/themes';
import { DEFAULT_BOTTOM_NAV_TABS } from '../features/settings/useAppSettings';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useSystemEngine } from '../features/systems/engine';
import { cn } from '../lib/utils';

/**
 * Bottom-nav rows that are the same in every ruleset.
 *
 * @remarks
 * `id` is the persisted settings key and must never be derived from `label` —
 * renaming a label would otherwise orphan the user's stored preference. The
 * abilities/magic row is inserted separately because its label (and its very
 * existence) comes from the active system's engine.
 */
const STATIC_BOTTOM_NAV_TABS: { id: string; label: string }[] = [
  { id: 'sheet', label: 'Sheet' },
  { id: 'skills', label: 'Skills' },
  { id: 'gear', label: 'Gear' },
];

const TRAILING_BOTTOM_NAV_TABS: { id: string; label: string }[] = [
  { id: 'combat', label: 'Combat' },
  { id: 'reference', label: 'Reference' },
  { id: 'profile', label: 'Profile' },
];

/** Rich per-theme descriptions; labels come from THEME_DISPLAY_NAMES. */
const THEME_DESCRIPTIONS: Partial<Record<ThemeName, string>> = {
  dark: 'Deep grays with golden accents',
  parchment: 'Warm fantasy-inspired tones',
  light: 'Clean whites and light grays',
  'starfarers-cockpit': "Brushed steel & chrome, hard machined edges, HUD lettering",
  'deep-space': 'Space-black and navy with amber + cyan accents',
  databank: 'Cool slate/white with electric blue accents',
  'neon-sprawl': 'Cyberpunk near-black with magenta + neon-cyan accents',
  'traveller-dark': 'The little black book — slate bars, chamfered headers, spine red',
  'traveller-light': 'The printed 2026 sheet — white page, slate headers, ruled lines',
};

// Derived from THEME_LIST (the source of truth) rather than a hand-maintained
// literal, so a theme added to the type/list can never again be silently
// unreachable in the picker (notebook-paper was missing before).
const THEMES: { value: ThemeName; label: string; description: string }[] = THEME_LIST.map(value => ({
  value,
  label: THEME_DISPLAY_NAMES[value],
  description: THEME_DESCRIPTIONS[value] ?? '',
}));

/**
 * App settings screen: theme, bottom-nav tab selection, PWA install, and the
 * destructive "clear all data" flow.
 *
 * @remarks
 * The bottom-nav choices are assembled from `STATIC_BOTTOM_NAV_TABS` plus an
 * engine-driven abilities/magic row plus `TRAILING_BOTTOM_NAV_TABS`, so the tab
 * set adapts to the active ruleset. "Clear all data" is a deliberately staged,
 * type-to-confirm flow (`clearStep`) because it wipes IndexedDB irreversibly.
 */
export default function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useAppState();
  const { character, clearCharacter } = useActiveCharacter();
  const navigate = useNavigate();
  const { canInstall, install: installPwa } = usePwaInstall();
  const engine = useSystemEngine();
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');

  useAutosave(character, characterRepository.save, 1000);

  const abilitiesLabel = engine.labels.abilitiesScreen;

  /**
   * Bottom-nav rows for the active system. The `magic` row keeps its stable
   * `magic` id (so stored preferences survive a label rename) and is dropped
   * entirely for systems without an abilities/magic screen.
   */
  const bottomNavTabs = useMemo(
    () => [
      ...STATIC_BOTTOM_NAV_TABS,
      ...(abilitiesLabel ? [{ id: 'magic', label: abilitiesLabel }] : []),
      ...TRAILING_BOTTOM_NAV_TABS,
    ],
    [abilitiesLabel],
  );


  async function handleClearAll() {
    if (confirmText !== 'DELETE') return;
    // clearCharacter() already awaits flushAll(), so pending character autosaves
    // are flushed before we clear state. No double-flush needed here.
    // The activeCharacterId=null settings write is also awaited inside
    // clearCharacter() so it can't queue behind the rw-transaction lock.
    await clearCharacter();
    await db.transaction(
      'rw',
      [
        db.characters,
        db.referenceNotes,
        db.appSettings,
        db.metadata,
        db.campaigns,
        db.sessions,
        db.notes,
        db.entityLinks,
        db.parties,
        db.partyMembers,
        db.attachments,
        db.creatureTemplates,
        db.encounters,
        db.kb_nodes,
        db.kb_edges,
        db.inventoryContainers,
      ],
      async () => {
        await db.characters.clear();
        await db.referenceNotes.clear();
        await db.appSettings.clear();
        await db.metadata.clear();
        await db.campaigns.clear();
        await db.sessions.clear();
        await db.notes.clear();
        await db.entityLinks.clear();
        await db.parties.clear();
        await db.partyMembers.clear();
        await db.attachments.clear();
        await db.creatureTemplates.clear();
        await db.encounters.clear();
        await db.kb_nodes.clear();
        await db.kb_edges.clear();
        await db.inventoryContainers.clear();
      }
    );
    setClearStep(0);
    setConfirmText('');
    window.location.replace('/library');
  }

  return (
    <div className="p-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="min-h-11 min-w-11 flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--color-text)]" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)] m-0">Settings</h1>
      </div>

      {/* Install App */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-sm)]">Install App</h2>
        {canInstall ? (
          <>
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-md)]">
              Install Skaldbok to your device for offline use.
            </p>
            <Button variant="primary" onClick={installPwa}>Install Skaldbok</Button>
          </>
        ) : (
          <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            To install: open the browser menu (⋮ or share icon) and look for "Install app" or "Add to Home Screen".
          </p>
        )}
      </Card>

      {/* Theme */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-md)]">Theme</h2>
        <div className="flex gap-[var(--space-md)] flex-wrap">
          {THEMES.map(t => (
            <button
              key={t.value}
              onClick={() => { setTheme(t.value); updateSettings({ theme: t.value }).catch(console.error); }}
              className={cn(
                'flex-1 min-w-[120px] p-[var(--space-md)] rounded-[var(--radius-md)] text-[var(--color-text)] cursor-pointer text-left min-h-[var(--touch-target-min)]',
                theme === t.value
                  ? 'border-2 border-[var(--color-primary)] bg-[var(--color-surface-alt)]'
                  : 'border border-[var(--color-border)] bg-transparent'
              )}
            >
              <div className="font-bold mb-[var(--space-xs)]">{t.label}</div>
              <div className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">{t.description}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Mode */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-md)]">Default Mode</h2>
        <div className="flex gap-[var(--space-md)]">
          {(['play', 'edit'] as const).map(m => (
            <button
              key={m}
              onClick={() => updateSettings({ mode: m }).catch(console.error)}
              className={cn(
                'flex-1 p-[var(--space-md)] rounded-[var(--radius-md)] text-[var(--color-text)] cursor-pointer min-h-[var(--touch-target-min)] uppercase',
                settings.mode === m
                  ? 'border-2 border-[var(--color-primary)] bg-[var(--color-surface-alt)] font-bold'
                  : 'border border-[var(--color-border)] bg-transparent font-normal'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </Card>

      {/* Session Log Button */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-sm)]">Session Log Button</h2>
        <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-md)]">
          Show the floating session-log button in the corner. Hide it if you want a clean character sheet — the log is still reachable from More → Session Log.
        </p>
        <div className="flex justify-between items-center px-[var(--space-md)] py-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] min-h-[var(--touch-target-min)]">
          <span className="text-[var(--color-text)] font-[var(--weight-medium)]">Show session log button</span>
          <button
            onClick={() => updateSettings({ showGlobalFAB: settings.showGlobalFAB === false }).catch(console.error)}
            aria-pressed={settings.showGlobalFAB !== false}
            className={cn(
              'inline-flex items-center justify-center min-w-16 min-h-[var(--touch-target-min)] px-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer font-bold text-[length:var(--font-size-sm)]',
              settings.showGlobalFAB !== false
                ? 'bg-[var(--color-success)] text-[var(--color-bg)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
            )}
          >
            {settings.showGlobalFAB !== false ? 'ON' : 'OFF'}
          </button>
        </div>
      </Card>

      {/* Bottom Navigation */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-sm)]">
          Bottom Navigation
        </h2>
        <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-md)]">
          Choose which tabs appear in the bottom navigation bar. Hidden tabs remain accessible via the ☰ menu.
        </p>
        <div className="flex flex-col gap-3">
          {bottomNavTabs.map(({ id: key, label: tabLabel }) => {
            const currentTabs: Record<string, boolean> = {
              ...DEFAULT_BOTTOM_NAV_TABS,
              ...(settings.bottomNavTabs ?? {}),
            };
            const isVisible = currentTabs[key] ?? DEFAULT_BOTTOM_NAV_TABS[key] ?? false;
            return (
              <div
                key={key}
                className="flex justify-between items-center px-[var(--space-md)] py-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] min-h-[var(--touch-target-min)]"
              >
                <span className="text-[var(--color-text)] font-[var(--weight-medium)]">
                  {tabLabel}
                </span>
                <button
                  onClick={() => {
                    const updated = { ...currentTabs, [key]: !isVisible };
                    updateSettings({ bottomNavTabs: updated }).catch(console.error);
                  }}
                  aria-label={`${isVisible ? 'Hide' : 'Show'} ${tabLabel} tab in bottom navigation`}
                  aria-pressed={isVisible}
                  className={cn(
                    'inline-flex items-center justify-center min-w-16 min-h-[var(--touch-target-min)] px-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer font-bold text-[length:var(--font-size-sm)]',
                    isVisible
                      ? 'bg-[var(--color-success)] text-[var(--color-bg)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                  )}
                >
                  {isVisible ? 'ON' : 'OFF'}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Print Character Sheet */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-sm)]">Print Character Sheet</h2>
        <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-md)]">
          Open a print-friendly version of the active character sheet.
        </p>
        <Button variant="secondary" onClick={() => navigate('/print')} disabled={!character}>
          Print Character Sheet
        </Button>
      </Card>

      {/* Import / Export */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-md)]">Import / Export</h2>
        <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-md)]">
          Import and export characters from the Character Library.
        </p>
        <Button variant="secondary" onClick={() => navigate('/library')}>Go to Character Library</Button>
      </Card>

      {/* Data safety — the only place the user can see whether their one copy is safe */}
      <StorageSafetyCard />

      {/* About */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-sm)]">About</h2>
        <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">Skaldbok v1.0 — The Adventurer's Ledger</p>
      </Card>

      {/* Danger zone */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-danger)] mb-[var(--space-md)]">Danger Zone</h2>
        <Button variant="danger" onClick={() => setClearStep(1)}>Clear All Data</Button>
      </Card>

      {/* Clear confirmation step 1 */}
      <Modal open={clearStep === 1} onClose={() => setClearStep(0)} title="Are you sure?"
        actions={<>
          <Button variant="secondary" onClick={() => setClearStep(0)}>Cancel</Button>
          <Button variant="danger" onClick={() => setClearStep(2)}>Continue</Button>
        </>}>
        <p className="text-[var(--color-text)]">This will delete all characters and notes. This cannot be undone.</p>
      </Modal>

      {/* Clear confirmation step 2 */}
      <Modal open={clearStep === 2} onClose={() => { setClearStep(0); setConfirmText(''); }} title="Final Confirmation"
        actions={<>
          <Button variant="secondary" onClick={() => { setClearStep(0); setConfirmText(''); }}>Cancel</Button>
          <Button variant="danger" onClick={handleClearAll} disabled={confirmText !== 'DELETE'}>Delete Everything</Button>
        </>}>
        <div>
          <p className="text-[var(--color-text)] mb-[var(--space-md)]">Type <strong>DELETE</strong> to confirm:</p>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            className="w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)]"
          />
        </div>
      </Modal>
    </div>
  );
}
