import { useNavigate } from 'react-router-dom';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useEncounterList } from '../encounters/useEncounterList';
import { NoCampaignPrompt } from '../../components/shell/NoCampaignPrompt';
import { BestiaryScreen } from './BestiaryScreen';

/**
 * Route-level wrapper for BestiaryScreen that provides the active campaign ID.
 * Renders NoCampaignPrompt if no campaign is active.
 */
export function BestiaryScreenRoute() {
  const navigate = useNavigate();
  const { activeCampaign, activeSession } = useCampaignContext();
  const { activeEncounter } = useEncounterList(activeSession?.id ?? null);

  if (!activeCampaign) {
    return <NoCampaignPrompt />;
  }

  return (
    <BestiaryScreen
      campaignId={activeCampaign.id}
      activeEncounterId={activeEncounter?.id}
      onClose={() => navigate(-1)}
    />
  );
}
