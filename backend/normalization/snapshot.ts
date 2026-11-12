import type { CommunityEvent, EventsSnapshot } from '../../src/lib/types';
import { transitionPast } from './events';

/**
 * Public statuses. PAST is included so the site can show event history; it is safe
 * because only AUTO_PUBLISHED and MANUAL events ever transition to PAST.
 */
const PUBLIC_STATUSES = new Set<CommunityEvent['status']>(['AUTO_PUBLISHED', 'MANUAL', 'PAST']);

export function generateSnapshot(events: CommunityEvent[], now = new Date()): EventsSnapshot {
  return {
    generatedAt: now.toISOString(),
    events: events
      .map((event) => transitionPast(event, now))
      .filter((event) => PUBLIC_STATUSES.has(event.status))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  };
}
