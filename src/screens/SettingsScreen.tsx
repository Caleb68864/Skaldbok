import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../context/AppStateContext';
import { Card } from '../components/primitives/Card';
import { Button } from '../components/primitives/Button';
import { Modal } from '../components/primitives/Modal';
import { db } from '../storage/db/client';
import type { ThemeName } from '../theme/themes';
import { DEFAULT_BOTTOM_NAV_TABS } from '../features/settings/useAppSettings';

const BOTTOM_NAV_TAB_LABELS = ['Sheet', 'Skills', 'Gear', 'Magic', 'Combat', 'Reference', 'Profile'] as const;

const THEMES: { value: ThemeName; label: string; description: string }[] = [
  { value: 'dark', label: 'Dark', description: 'Deep grays with golden accents' },
  { value: 'parchment', label: 'Parchment', description: 'Warm fantasy-inspired tones' },
  { value: 'light', label: 'Light', description: 'Clean whites and light grays' },
];

export default function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useAppState();
  const navigate = useNavigate();
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');

  async function handleClearAll() {
    if (confirmText !== 'DELETE') return;
    await db.characters.clear();
    await db.referenceNotes.clear();
    await db.appSettings.clear();
    setClearStep(0);
    setConfirmText('');
    navigate('/library');
  }

  return (
    <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <h1 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)' }}>Settings</h1>

      {/* Theme */}
      <Card>
        <h2 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text)', marginBottom: 'var(--space-md)' }}>Theme</h2>
        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          {THEMES.map(t => (
            <button
              key={t.value}
              onClick={() => { setTheme(t.value); updateSettings({ theme: t.value }).catch(console.error); }}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: 'var(--space-md)',
                border: theme === t.value ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: theme === t.value ? 'var(--color-surface-alt)' : 'transparent',
                color: 'var(--color-text)',
                cursor: 'pointer',
                textAlign: 'left',
                minHeight: 'var(--touch-target-min)',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 'var(--space-xs)' }}>{t.label}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{t.description}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Mode */}
      <Card>
        <h2 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text)', marginBottom: 'var(--space-md)' }}>Default Mode</h2>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          {(['play', 'edit'] as const).map(m => (
            <button
              key={m}
              onClick={() => updateSettings({ mode: m }).catch(console.error)}
              style={{
                flex: 1,
                padding: 'var(--space-md)',
                border: settings.mode === m ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: settings.mode === m ? 'var(--color-surface-alt)' : 'transparent',
                color: 'var(--color-text)',
                cursor: 'pointer',
                minHeight: 'var(--touch-target-min)',
                fontWeight: settings.mode === m ? 'bold' : 'normal',
                textTransform: 'uppercase',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </Card>

      {/* Bottom Navigation */}
      <Card>
        <h2 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text)', marginBottom: 'var(--space-sm)' }}>
          Bottom Navigation
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
          Choose which tabs appear in the bottom navigation bar. Hidden tabs remain accessible via the ☰ menu.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
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
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-sm) var(--space-md)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-surface-alt)',
                  minHeight: 'var(--touch-target-min)',
                }}
              >
                <span style={{ color: 'var(--color-text)', fontWeight: 'var(--weight-medium)' }}>
                  {tabLabel}
                </span>
                <button
                  onClick={() => {
                    const updated = { ...currentTabs, [key]: !isVisible };
                    updateSettings({ bottomNavTabs: updated }).catch(console.error);
                  }}
                  aria-label={`${isVisible ? 'Hide' : 'Show'} ${tabLabel} tab in bottom navigation`}
                  aria-pressed={isVisible}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '64px',
                    minHeight: 'var(--touch-target-min)',
                    padding: '0 var(--space-sm)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    background: isVisible ? 'var(--color-success)' : 'var(--color-surface)',
                    color: isVisible ? 'var(--color-bg)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  {isVisible ? 'ON' : 'OFF'}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Import / Export */}
      <Card>
        <h2 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text)', marginBottom: 'var(--space-md)' }}>Import / Export</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
          Import and export characters from the Character Library.
        </p>
        <Button variant="secondary" onClick={() => navigate('/library')}>Go to Character Library</Button>
      </Card>

      {/* About */}
      <Card>
        <h2 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text)', marginBottom: 'var(--space-sm)' }}>About</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Skaldbok v1.0 — The Adventurer's Ledger</p>
      </Card>

      {/* Danger zone */}
      <Card>
        <h2 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-danger)', marginBottom: 'var(--space-md)' }}>Danger Zone</h2>
        <Button variant="danger" onClick={() => setClearStep(1)}>Clear All Data</Button>
      </Card>

      {/* Clear confirmation step 1 */}
      <Modal open={clearStep === 1} onClose={() => setClearStep(0)} title="Are you sure?"
        actions={<>
          <Button variant="secondary" onClick={() => setClearStep(0)}>Cancel</Button>
          <Button variant="danger" onClick={() => setClearStep(2)}>Continue</Button>
        </>}>
        <p style={{ color: 'var(--color-text)' }}>This will delete all characters and notes. This cannot be undone.</p>
      </Modal>

      {/* Clear confirmation step 2 */}
      <Modal open={clearStep === 2} onClose={() => { setClearStep(0); setConfirmText(''); }} title="Final Confirmation"
        actions={<>
          <Button variant="secondary" onClick={() => { setClearStep(0); setConfirmText(''); }}>Cancel</Button>
          <Button variant="danger" onClick={handleClearAll} disabled={confirmText !== 'DELETE'}>Delete Everything</Button>
        </>}>
        <div>
          <p style={{ color: 'var(--color-text)', marginBottom: 'var(--space-md)' }}>Type <strong>DELETE</strong> to confirm:</p>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            style={{ width: '100%', padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 'var(--font-size-md)' }}
          />
        </div>
      </Modal>
    </div>
  );
}
