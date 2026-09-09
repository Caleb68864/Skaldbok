/**
 * Empty-state shown where campaign-scoped content would appear when no campaign
 * is selected, directing the user to the campaign selector.
 *
 * @remarks
 * Names restoring as well as creating. On a genuinely fresh install this is the
 * screen someone who has lost a device sees, and telling them only to create a
 * campaign is what made the restore path read as unavailable — the Import
 * action itself now lives outside the active-campaign gate (see
 * `CampaignHeader`), so both routes out of this state exist.
 */
export function NoCampaignPrompt() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-text-muted">
      <p className="text-base mb-2">
        Create a campaign to get started
      </p>
      <p className="text-sm">
        Tap the campaign selector above to create or select a campaign.
      </p>
      <p className="text-sm mt-2">
        Restoring a backup? Open the menu and choose Import — a campaign bundle brings its
        own campaign with it.
      </p>
    </div>
  );
}
