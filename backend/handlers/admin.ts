import { userGroups } from '../../config/user-groups';
import type { UserGroup } from '../../src/lib/types';
import { normalizeEvent, transitionPast } from '../normalization/events';
import { EventRepository } from '../persistence/repository';
import { publishCurrentSnapshot } from '../persistence/publish';
import type { EventOverride } from '../persistence/types';
import { conditionalFetch } from '../sources/http';
import { meetupEventReference, parseMeetupEventPage } from '../sources/public-page';
import type { RawEvent } from '../sources/types';

interface AdminRequest {
  action:
    | 'reviews.list'
    | 'reviews.approve'
    | 'reviews.dismiss'
    | 'events.import-url'
    | 'events.upsert'
    | 'overrides.clear';
  id?: string;
  eventId?: string;
  groupId?: string;
  url?: string;
  event?: RawEvent;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function requiredValue<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === '') throw new Error(`${label} is required`);
  return value;
}

function groupById(id: string): UserGroup {
  const group = userGroups.find((candidate) => candidate.id === id && candidate.active);
  if (!group) throw new Error(`Unknown or inactive user group ${id}`);
  return group;
}

async function saveOverride(repository: EventRepository, raw: RawEvent): Promise<EventOverride> {
  const now = new Date();
  const status = raw.status === 'CANCELLED' ? 'CANCELLED' as const : 'MANUAL' as const;
  const event = normalizeEvent({ ...raw, source: 'manual', status }, now);
  const previous = (await repository.loadOverrides()).find((candidate) => candidate.event.id === event.id);
  const override: EventOverride = {
    event,
    createdAt: previous?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await repository.putOverride(override);
  return override;
}

export const handler = async (request: AdminRequest): Promise<unknown> => {
  if (!request?.action) throw new Error('Admin action is required');
  const repository = new EventRepository(required('EVENTS_TABLE'));
  const bucket = required('SNAPSHOT_BUCKET');

  switch (request.action) {
    case 'reviews.list':
      return { reviews: await repository.loadReviews('OPEN') };

    case 'reviews.approve': { // Approval is only safe when discovery retained a complete structured draft.
      const id = requiredValue(request.id, 'Review id');
      const review = await repository.getReview(id);
      if (!review) throw new Error(`Review ${id} not found`);
      if (!review.draft) throw new Error(`Review ${id} has no complete draft; use events.upsert with explicit fields`);
      const override = await saveOverride(repository, review.draft);
      await repository.setReviewStatus(id, 'RESOLVED');
      const snapshot = await publishCurrentSnapshot(repository, bucket);
      return { override, published: snapshot.events.length };
    }

    case 'reviews.dismiss': {
      const review = await repository.setReviewStatus(requiredValue(request.id, 'Review id'), 'DISMISSED');
      return { review };
    }

    case 'events.import-url': {
      const group = groupById(requiredValue(request.groupId, 'User group id'));
      const url = requiredValue(request.url, 'Event URL');
      const canonicalUrl = meetupEventReference(url, group).url;
      const page = await conditionalFetch(canonicalUrl, {});
      if (!page.body) throw new Error('Public event page returned no content');
      const raw = parseMeetupEventPage(page.body, group, canonicalUrl);
      const event = transitionPast(normalizeEvent(raw));
      await repository.putEvent(event);
      await repository.resolveReview(event.userGroupId, event.sourceId);
      const snapshot = await publishCurrentSnapshot(repository, bucket);
      return { event, published: snapshot.events.length };
    }

    case 'events.upsert': {
      const override = await saveOverride(repository, requiredValue(request.event, 'Event'));
      const snapshot = await publishCurrentSnapshot(repository, bucket);
      return { override, published: snapshot.events.length };
    }

    case 'overrides.clear': {
      const eventId = requiredValue(request.eventId, 'Event id');
      await repository.deleteOverride(eventId);
      const snapshot = await publishCurrentSnapshot(repository, bucket);
      return { eventId, published: snapshot.events.length };
    }
  }
};
