# Scenario 05: Campaign/Bundle Import (.skaldbok.json)

## Steps

1. Navigate to `/session`
2. Dismiss stale session warning if present
3. Click "Import (.skaldbok.json)" button
4. Upload a valid bundle file (or verify import preview appears)
5. Confirm import

## Expected

- Import preview modal shows entity counts
- Import completes with success toast

## Note

This test requires a valid BundleEnvelope file. The sample character files are raw CharacterRecords, not bundles. We will test the import flow UI and verify it handles the format gracefully.
