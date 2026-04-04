import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../context/AppStateContext';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAutosave } from '../hooks/useAutosave';
import { Card } from '../components/primitives/Card';
import { Button } from '../components/primitives/Button';
import { Modal } from '../components/primitives/Modal';
import { db } from '../storage/db/client';
import * as characterRepository from '../storage/repositories/characterRepository';
import type { ThemeName } from '../theme/themes';
import { DEFAULT_BOTTOM_NAV_TABS } from '../features/settings/useAppSettings';
import { nowISO } from '../utils/dates';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { cn } from '../lib/utils';

const BOTTOM_NAV_TAB_LABELS = ['Sheet', 'Skills', 'Gear', 'Magic', 'Combat', 'Reference', 'Profile'] as const;

const COMBAT_PANELS: { key: string; label: string }[] = [
  { key: 'weaponRack', label: 'Weapon Rack' },
  { key: 'heroicAbilities', label: 'Heroic Abilities' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'deathRolls', label: 'Death Rolls' },
  { key: 'restRecovery', label: 'Rest & Recovery' },
];

const THEMES: { value: ThemeName; label: string; description: string }[] = [
  { value: 'dark', label: 'Dark', description: 'Deep grays with golden accents' },
  { value: 'parchment', label: 'Parchment', description: 'Warm fantasy-inspired tones' },
  { value: 'light', label: 'Light', description: 'Clean whites and light grays' },
];

export default function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useAppState();
  const { character, updateCharacter } = useActiveCharacter();
  const navigate = useNavigate();
  const { canInstall, install: installPwa } = usePwaInstall();
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');

  useAutosave(character, characterRepository.save, 1000);

  function handleCombatPanelToggle(panelKey: string) {
    if (!character) return;
    const current = character.uiState.combatPanelVisibility ?? {};
    const isOn = current[panelKey] !== false;
    const updated: Record<string, boolean> = { ...current, [panelKey]: !isOn };
    updateCharacter({
      uiState: { ...character.uiState, combatPanelVisibility: updated },
      updatedAt: nowISO(),
    });
  }

  async function handleClearAll() {
    if (confirmText !== 'DELETE') return;
    await db.characters.clear();
    await db.referenceNotes.clear();
    await db.appSettings.clear();
    await db.campaigns.clear();
    await db.sessions.clear();
    await db.notes.clear();
    await db.entityLinks.clear();
    await db.parties.clear();
    await db.partyMembers.clear();
    await db.attachments.clear();
    setClearStep(0);
    setConfirmText('');
    navigate('/library');
  }

  return (
    <div className="p-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
      <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)]">Settings</h1>

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

      {/* Bottom Navigation */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-sm)]">
          Bottom Navigation
        </h2>
        <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-md)]">
          Choose which tabs appear in the bottom navigation bar. Hidden tabs remain accessible via the ☰ menu.
        </p>
        <div className="flex flex-col gap-3">
          {BOTTOM_NAV_TAB_LABELS.map(tabLabel => {
            const key = tabLabel.toLowerCase();
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

      {/* Combat Panels */}
      <Card>
        <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-sm)]">
          Combat Panels
        </h2>
        {character ? (
          <>
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-md)]">
              Choose which panels appear on the Combat screen.
            </p>
            <div className="flex flex-col gap-3">
              {COMBAT_PANELS.map(panel => {
                const visibility = character.uiState.combatPanelVisibility ?? {};
                const isOn = visibility[panel.key] !== false;
                return (
                  <div
                    key={panel.key}
                    className="flex justify-between items-center px-[var(--space-md)] py-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] min-h-[var(--touch-target-min)]"
                  >
                    <span className="text-[var(--color-text)] font-[var(--weight-medium)]">
                      {panel.label}
                    </span>
                    <button
                      onClick={() => handleCombatPanelToggle(panel.key)}
                      aria-label={`${isOn ? 'Hide' : 'Show'} ${panel.label} panel in combat`}
                      aria-pressed={isOn}
                      className={cn(
                        'inline-flex items-center justify-center min-w-16 min-h-[var(--touch-target-min)] px-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer font-bold text-[length:var(--font-size-sm)]',
                        isOn
                          ? 'bg-[var(--color-success)] text-[var(--color-bg)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                      )}
                    >
                      {isOn ? 'ON' : 'OFF'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            Select a character to configure combat panels.
          </p>
        )}
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
