// Browser-side access to the public S3 snapshot. One request per page, shared by
// every component that refreshes from it.

import { parseEventsSnapshot } from './events';
import type { EventsSnapshot } from './types';

const requests = new Map<string, Promise<EventsSnapshot | undefined>>();

/** Fetches and validates the snapshot; resolves undefined on any failure. */
export function loadSnapshot(url: string): Promise<EventsSnapshot | undefined> {
  let request = requests.get(url);
  if (!request) {
    request = fetch(url, { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((value) => (value === undefined ? undefined : parseEventsSnapshot(value)))
      .catch((error: unknown) => {
        console.warn('Events snapshot unavailable; keeping the static version.', error);
        return undefined;
      });
    requests.set(url, request);
  }
  return request;
}
