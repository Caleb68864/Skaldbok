import { useState, useEffect } from 'react';
import { Plus, Sparkles, X, Dices, ShoppingCart, Gem, Quote, Ear } from 'lucide-react';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import type { PartyMember } from '../../types/party';
import { SkillCheckDrawer } from '../../features/session/actions/SkillCheckDrawer';
import { ShoppingDrawer } from '../../features/session/actions/ShoppingDrawer';
import { LootDrawer } from '../../features/session/actions/LootDrawer';
import { QuoteDrawer } from '../../features/session/actions/QuoteDrawer';
import { RumorDrawer } from '../../features/session/actions/RumorDrawer';
import { cn } from '@/lib/utils';
import type { ResolvedMember } from '../fields/PartyPicker';

/**
 * Union of all quick-action drawer identifiers that the FAB can open.
 *
 * - `'skill-check'` — Log a skill check roll for one or more party members.
 * - `'shopping'`   — Record a shopping transaction.
 * - `'loot'`       — Distribute loot to party members.
 * - `'quote'`      — Save a memorable in-session quote.
 * - `'rumor'`      — Record a rumor heard during the session.
 */
type ActionType = 'skill-check' | 'shopping' | 'loot' | 'quote' | 'rumor';

/**
 * Static metadata for each quick-action menu item rendered by the FAB.
 * Keeps `id` and display `label` in sync without duplication.
 */
const ACTION_ITEMS: { id: ActionType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'skill-check', label: 'Skill Check', icon: Dices },
  { id: 'shopping', label: 'Shopping', icon: ShoppingCart },
  { id: 'loot', label: 'Loot', icon: Gem },
  { id: 'quote', label: 'Quote', icon: Quote },
  { id: 'rumor', label: 'Rumor', icon: Ear },
];

/**
 * Global Floating Action Button (FAB) that surfaces quick-action drawers
 * during an active session.
 *
 * @remarks
 * The FAB is always mounted inside {@link ShellLayout} so it appears on every
 * route. Pressing the button when no session is active shows a toast instead
 * of opening the menu.
 *
 * When a session is active, pressing the FAB reveals a vertically-stacked
 * action menu. Selecting an item closes the menu and opens the corresponding
 * drawer component. A transparent backdrop is rendered behind the menu so a
 * tap outside dismisses it.
 *
 * Party member resolution is performed once on mount (and whenever the active
 * party changes). If the campaign has no party, the currently active character
 * is used as the sole "member". The selection resets to the active character
 * each time a drawer opens.
 *
 * @example
 * // Rendered automatically by ShellLayout — no props required.
 * <GlobalFAB />
 */
export function GlobalFAB() {
  const { activeSession, activeParty, activeCharacterInCampaign } = useCampaignContext();
  const { character } = useActiveCharacter();
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<ActionType | null>(null);
  const [resolvedMembers, setResolvedMembers] = useState<ResolvedMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Resolve party members
  useEffect(() => {
    const members = activeParty?.members ?? [];
    if (members.length === 0) {
      if (character) {
        setResolvedMembers([{ id: '__self__', name: character.name, character }]);
        setSelectedMembers(['__self__']);
      }
      return;
    }

    let mounted = true;
    Promise.all(
      members.map(async (m: PartyMember) => {
        if (m.linkedCharacterId) {
          const char = await getCharacterById(m.linkedCharacterId);
          if (char) return { id: m.id, name: char.name, character: char };
        }
        return { id: m.id, name: m.name ?? 'Unknown', character: null };
      })
    ).then(results => {
      if (!mounted) return;
      setResolvedMembers(results);
      const activeId = activeCharacterInCampaign?.id;
      if (activeId && results.some(r => r.id === activeId)) {
        setSelectedMembers([activeId]);
      } else if (results.length > 0) {
        setSelectedMembers([results[0].id]);
      }
    });
    return () => { mounted = false; };
  }, [activeParty, character, activeCharacterInCampaign]);

  // Re-select active character when drawer opens
  useEffect(() => {
    if (!activeDrawer) return;
    const activeId = activeCharacterInCampaign?.id;
    if (activeId && resolvedMembers.some(r => r.id === activeId)) {
      setSelectedMembers([activeId]);
    } else if (resolvedMembers.length > 0) {
      setSelectedMembers([resolvedMembers[0].id]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDrawer]);

  /**
   * Handles a press on the FAB itself.
   *
   * If no session is currently active, shows a toast message instructing the
   * user to start a session first. Otherwise toggles the action menu open/closed.
   */
  const handleFABPress = () => {
    if (!activeSession) {
      showToast('Start a session first');
      return;
    }
    setMenuOpen(v => !v);
  };

  /**
   * Called when the user taps one of the action menu items.
   *
   * Closes the pop-up menu and sets the active drawer so the corresponding
   * bottom-sheet slides in.
   *
   * @param id - The {@link ActionType} identifier of the selected action.
   */
  const handleActionSelect = (id: ActionType) => {
    setMenuOpen(false);
    setActiveDrawer(id);
  };

  /** Closes whichever drawer is currently open by resetting `activeDrawer` to `null`. */
  const closeDrawer = () => {
    setActiveDrawer(null);
  };

  /**
   * Props shared by every action drawer.
   * Includes the resolved member list, the current selection, and the
   * callbacks for updating the selection and closing the drawer on success.
   */
  const sharedProps = {
    members: resolvedMembers,
    selectedMembers,
    onSelectMembers: setSelectedMembers,
    onLogged: closeDrawer,
  };

  return (
    <>
      {/* Backdrop to close menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40"
        />
      )}

      {/* Action menu */}
      {menuOpen && (
        <div className="fixed bottom-[136px] right-4 z-40 flex flex-col gap-2 items-end">
          {ACTION_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleActionSelect(item.id)}
                className="flex items-center gap-2 min-h-[44px] px-4 bg-surface border border-border rounded-full text-text cursor-pointer text-sm font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.15)] whitespace-nowrap"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={handleFABPress}
        aria-label={activeSession ? 'Open quick actions' : 'Start a session first'}
        className={cn(
          'fixed bottom-[68px] right-4 z-40 w-14 h-14 rounded-full bg-accent text-[var(--color-on-accent,#fff)] border-none shadow-[0_4px_16px_rgba(0,0,0,0.3)] cursor-pointer flex items-center justify-center transition-transform',
          menuOpen && 'rotate-45',
        )}
      >
        {menuOpen ? (
          <X className="h-6 w-6" />
        ) : activeSession ? (
          <Sparkles className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </button>

      {/* Action drawers */}
      <SkillCheckDrawer
        open={activeDrawer === 'skill-check'}
        onClose={closeDrawer}
        {...sharedProps}
      />
      <ShoppingDrawer
        open={activeDrawer === 'shopping'}
        onClose={closeDrawer}
        {...sharedProps}
      />
      <LootDrawer
        open={activeDrawer === 'loot'}
        onClose={closeDrawer}
        {...sharedProps}
      />
      <QuoteDrawer
        open={activeDrawer === 'quote'}
        onClose={closeDrawer}
        {...sharedProps}
      />
      <RumorDrawer
        open={activeDrawer === 'rumor'}
        onClose={closeDrawer}
        onLogged={closeDrawer}
      />
    </>
  );
}
