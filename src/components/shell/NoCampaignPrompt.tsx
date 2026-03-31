export function NoCampaignPrompt() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
      }}
    >
      <p style={{ fontSize: '16px', marginBottom: '8px' }}>
        Create a campaign to get started
      </p>
      <p style={{ fontSize: '14px' }}>
        Tap the campaign selector above to create or select a campaign.
      </p>
    </div>
  );
}
