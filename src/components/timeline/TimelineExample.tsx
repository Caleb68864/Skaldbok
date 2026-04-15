import { TimelineRoot } from './TimelineRoot';
import { timelineMockItems, timelineMockMarkers, timelineMockTracks } from './mockData';

export function TimelineExample() {
  return (
    <TimelineRoot
      tracks={timelineMockTracks}
      items={timelineMockItems}
      markers={timelineMockMarkers}
      toolbarTitle="Reusable Timeline Demo"
      emptyStateTitle="Nothing to show yet"
      emptyStateDescription="This example timeline is ready for integration once real note adapters are wired in."
    />
  );
}
