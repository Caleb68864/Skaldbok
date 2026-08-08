import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as characterRepository from '../storage/repositories/characterRepository';
import { useCharacterActions } from '../features/characters/useCharacterActions';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { exportCharacter, importCharacter } from '../utils/importExport';
import type { CharacterRecord } from '../types/character';
import { Card } from '../components/primitives/Card';
import { Button } from '../components/primitives/Button';
import { Modal } from '../components/primitives/Modal';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';
import { useAppState } from '../context/AppStateContext';
import { AppLogo } from '../components/primitives/AppLogo';
import { DEFAULT_SYSTEM_ID, getSelectableSystems, BUNDLED_SYSTEMS } from '../systems/registry';

/**
 * The first couple of identity values to show under a character's name.
 *
 * @remarks
 * This card read `metadata.kin` and `metadata.profession` — Dragonbane's
 * identity field ids, hardcoded in a screen that lists characters from every
 * system. A Traveller character (callsign/species/homeworld) and a Savage
 * Worlds one (concept/rank/ancestry) have neither, so their cards showed the
 * system name and nothing else however much identity they had filled in.
 *
 * Reads the system's own `identityFields` in declaration order, so each ruleset
 * volunteers what identifies a character. Returns nothing rather than guessing
 * when the system is not bundled — a user-authored system should show its name,
 * not two arbitrary metadata values.
 */
function summariseIdentity(character: CharacterRecord): string[] {
  const system = BUNDLED_SYSTEMS.find(s => s.id === character.systemId);
  return (system?.identityFields ?? [])
    .map(field => character.metadata?.[field.id])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .slice(0, 2);
}
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { createParty, addPartyMember } from '../storage/repositories/partyRepository';
import { updateCampaign } from '../storage/repositories/campaignRepository';

/**
 * Landing screen listing every saved character, with create / duplicate / delete /
 * import / export and "make active" actions.
 *
 * @remarks
 * Creating a character defaults its ruleset to the active campaign's system (see
 * `campaignSystemId`) and, when a campaign is active, adds it to that
 * campaign's party so encounters pick it up automatically — party failures are
 * swallowed so a party hiccup never reads as "character creation failed". Deletes
 * route through {@link useCharacterActions} (soft delete); the list reloads from the
 * repository after each mutation.
 */
export default function CharacterLibraryScreen() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CharacterRecord | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [systemInput, setSystemInput] = useState(DEFAULT_SYSTEM_ID);
  const [pendingSetActiveId, setPendingSetActiveId] = useState<string | null>(null);
  const [pendingSetActiveName, setPendingSetActiveName] = useState<string>('');
  const { character: activeCharacter, setCharacter } = useActiveCharacter();
  const { createCharacter, duplicateCharacter, deleteCharacter } = useCharacterActions();
  const { showToast } = useToast();
  const { updateSettings } = useAppState();
  const { activeCampaign, activeParty, refreshParty } = useCampaignContext();
  const navigate = useNavigate();

  /**
   * The system a new character should default to.
   *
   * @remarks
   * A campaign declares its ruleset, and that is what decides the character
   * sheet, so creating a character inside a Traveller campaign should not
   * silently hand back a Dragonbane sheet. The picker stays editable for the
   * one-off case (an NPC from another system, a character created with no
   * campaign selected). Falls back to the default when the campaign names a
   * system that is not bundled.
   */
  const campaignSystemId =
    activeCampaign && getSelectableSystems().some(s => s.id === activeCampaign.system)
      ? activeCampaign.system
      : DEFAULT_SYSTEM_ID;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCharacters = useCallback(async () => {
    const all = await characterRepository.getAll();
    setCharacters(all);
  }, []);

  useEffect(() => {
    loadCharacters().catch(console.error);
  }, [loadCharacters]);

  function handleCreate() {
    setNameInput('');
    setSystemInput(campaignSystemId);
    setShowNamePrompt(true);
  }

  /**
   * Adds a freshly created character to the active campaign's party.
   *
   * @remarks
   * A character made inside a campaign is a member of that campaign's party by
   * definition. Without this, "Include active party" on a new encounter
   * silently yields zero participants and the only fix is buried in
   * Menu → Manage Party. Party membership is still editable there.
   *
   * Failure is non-fatal: the character exists, so a party hiccup must not
   * surface as "character creation failed".
   */
  async function addToActiveParty(characterId: string, name: string) {
    if (!activeCampaign) return;
    try {
      let partyId = activeParty?.id;
      if (!partyId) {
        const party = await createParty({
          campaignId: activeCampaign.id,
          name: `${activeCampaign.name} Party`,
        });
        await updateCampaign(activeCampaign.id, { activePartyId: party.id });
        partyId = party.id;
      }
      await addPartyMember({ partyId, linkedCharacterId: characterId, name, isActivePlayer: false });
      await refreshParty();
    } catch (e) {
      console.error('CharacterLibraryScreen: could not add character to party', e);
    }
  }

  async function handleCreateConfirm() {
    const trimmed = nameInput.trim();
    if (!trimmed) return; // Guard: should not reach here with save disabled, but safety net
    setShowNamePrompt(false);
    const hadActiveCharacter = activeCharacter !== null;
    try {
      const newChar = await createCharacter(trimmed, systemInput);
      await loadCharacters();
      await addToActiveParty(newChar.id, trimmed);
      if (!hadActiveCharacter) {
        // First character: auto-activate (AC3.1)
        await setCharacter(newChar.id);
        await updateSettings({ mode: 'edit' });
        showToast('Character created and set as active', 'success');
        navigate('/character/sheet');
      } else {
        // Subsequent character: offer Set Active? via inline banner (AC3.2)
        setPendingSetActiveId(newChar.id);
        setPendingSetActiveName(trimmed);
        showToast('Character created', 'success');
      }
    } catch (e) {
      showToast(String(e), 'error');
    }
  }

  async function handlePendingSetActive() {
    if (!pendingSetActiveId) return;
    await setCharacter(pendingSetActiveId);
    await updateSettings({ mode: 'edit' });
    setPendingSetActiveId(null);
    setPendingSetActiveName('');
    showToast('Active character updated', 'success');
    navigate('/character/sheet');
  }

  function dismissPendingSetActive() {
    setPendingSetActiveId(null);
    setPendingSetActiveName('');
  }

  function handleCreateCancel() {
    setShowNamePrompt(false);
    setNameInput('');
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateCharacter(id);
      await loadCharacters();
      showToast('Character duplicated', 'success');
    } catch (e) {
      showToast(String(e), 'error');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteCharacter(deleteTarget.id);
      setDeleteTarget(null);
      await loadCharacters();
      showToast('Character deleted', 'success');
    } catch (e) {
      showToast(String(e), 'error');
    }
  }

  async function handleSetActive(id: string) {
    await setCharacter(id);
    navigate('/sheet');
  }

  function handleExport(char: CharacterRecord) {
    exportCharacter(char);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importCharacter(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (result.success) {
      await loadCharacters();
      if (result.warning) {
        showToast(`Imported. Note: ${result.warning}`, 'warning');
      } else {
        showToast('Character imported successfully', 'success');
      }
    } else {
      showToast(result.error ?? 'Import failed.', 'error');
    }
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="min-h-11 min-w-11 flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--color-text)]" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <AppLogo size="md" />
          <div>
            <p className="m-0 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">Skaldbok</p>
            <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)] m-0">Character Library</h1>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import Character</Button>
          <Button variant="primary" onClick={handleCreate}>+ New Character</Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Set Active? banner — shown when a second+ character is created (AC3.2, AC3.3) */}
      {pendingSetActiveId && (
        <div
          className="flex items-center justify-between gap-[var(--space-sm)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 mb-[var(--space-md)]"
        >
          <span className="text-[var(--color-text)] text-sm">
            {pendingSetActiveName} created — Set Active?
          </span>
          <div className="flex gap-3 shrink-0">
            <Button size="sm" variant="primary" onClick={handlePendingSetActive}>Set Active &amp; Edit</Button>
            <Button size="sm" variant="secondary" onClick={dismissPendingSetActive}>Dismiss</Button>
          </div>
        </div>
      )}

      {characters.length === 0 && (
        <div className="text-center text-[var(--color-text-muted)] mt-[var(--space-xl)]">
          <p className="mb-[var(--space-md)]">No characters yet. Create your first character to get started.</p>
          <Button variant="primary" size="lg" onClick={handleCreate}>Create your first character</Button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {characters.map(char => {
          const isActive = activeCharacter?.id === char.id;
          return (
            <Card
              key={char.id}
              className={cn(
                'p-5',
                isActive
                  ? 'border-2 border-[var(--color-primary)]'
                  : 'border border-[var(--color-border)]'
              )}
            >
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-1">
                    {char.name || 'Unnamed Character'}
                    {isActive && <span className="ml-2 text-[length:var(--font-size-sm)] text-[var(--color-primary)]">(Active)</span>}
                  </h2>
                  <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
                    {[
                      getSelectableSystems().find(s => s.id === char.systemId)?.displayName ?? char.systemId,
                      ...summariseIdentity(char),
                    ].filter(Boolean).join(' · ') || 'No details'}
                  </p>
                  <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mt-1">
                    Updated: {new Date(char.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {!isActive && (
                    <Button size="sm" variant="primary" onClick={() => handleSetActive(char.id)}>Set Active &amp; Open</Button>
                  )}
                  {isActive && (
                    <Button size="sm" variant="primary" onClick={() => navigate('/character/sheet')}>Open Sheet</Button>
                  )}
                  <Button size="sm" onClick={() => handleExport(char)}>Export</Button>
                  <Button size="sm" onClick={() => handleDuplicate(char.id)}>Duplicate</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(char)}>Delete</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={showNamePrompt}
        onClose={handleCreateCancel}
        title="New Character"
        actions={
          <>
            <Button variant="secondary" onClick={handleCreateCancel}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleCreateConfirm}
              disabled={nameInput.trim().length === 0}
            >
              Create
            </Button>
          </>
        }
      >
        <p className="text-[var(--color-text-muted)] mb-3 text-sm">
          Enter a name for your character and choose a game system.
        </p>
        <input
          type="text"
          placeholder="Character name"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim().length > 0) handleCreateConfirm(); }}
          autoFocus
          className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
        />
        {/*
          The campaign owns the ruleset, so when one is active the character
          inherits it silently — asking twice invites a Traveller campaign full
          of Dragonbane sheets. The picker only appears with no campaign
          selected, where there is nothing to inherit from.
        */}
        {activeCampaign ? (
          <p className="mt-3 text-[var(--color-text-muted)] text-sm">
            Game system:{' '}
            <span className="text-[var(--color-text)]">
              {getSelectableSystems().find(s => s.id === campaignSystemId)?.displayName}
            </span>{' '}
            — from campaign “{activeCampaign.name}”.
          </p>
        ) : (
          <label className="mt-3 block text-[var(--color-text-muted)] text-sm">
            Game system
            <select
              aria-label="Game system"
              value={systemInput}
              onChange={e => setSystemInput(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
            >
              {getSelectableSystems().map(s => (
                <option key={s.id} value={s.id}>{s.displayName}</option>
              ))}
            </select>
          </label>
        )}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Character"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>Delete</Button>
          </>
        }
      >
        <p className="text-[var(--color-text)]">
          Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
      </Modal>

    </div>
  );
}
