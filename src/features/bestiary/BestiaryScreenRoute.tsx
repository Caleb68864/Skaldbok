import { useCampaignContext } from '../campaign/CampaignContext';
import { NoCampaignPrompt } from '../../components/shell/NoCampaignPrompt';
import { BestiaryScreen } from './BestiaryScreen';

/**
 * Route-level wrapper for BestiaryScreen that provides the active campaign ID.
 * Renders NoCampaignPrompt if no campaign is active.
 */
export function BestiaryScreenRoute() {
  const { activeCampaign } = useCampaignContext();

  if (!activeCampaign) {
    return <NoCampaignPrompt />;
  }

  return <BestiaryScreen campaignId={activeCampaign.id} />;
}
