import type { EventSourceType, EventSpeaker, EventStatus, SourceDefinition, UserGroup } from '../../src/lib/types';
import { conditionalFetch } from './http';
import type { EventSource, RawEvent, SourceResult, SourceState } from './types';

const MEETUP_HOSTS = new Set(['meetup.com', 'www.meetup.com']);
const MEETUP_IMAGE_HOSTS = new Set(['secure-content.meetupstatic.com', 'secure.meetupstatic.com']);
const LOCALE_SEGMENT = /^[a-z]{2}-[a-z]{2}$/i;

function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try { blocks.push(JSON.parse(match[1])); } catch { /* A malformed block is ignored; no heuristic repair. */ }
  }
  return blocks;
}

function flatten(value: unknown): Record<string, any>[] {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, any>;
  return [record, ...flatten(record['@graph'])];
}

function eventObjects(html: string): Record<string, any>[] {
  return jsonLdBlocks(html).flatMap(flatten).filter((item) => {
    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
    return types.includes('Event');
  });
}

function explicitDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(value)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function text(value: unknown, maxLength = 10_000): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function values(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function imageCandidates(value: unknown): string[] {
  return values(value).flatMap((candidate) => {
    if (typeof candidate === 'string') return [candidate];
    if (!candidate || typeof candidate !== 'object') return [];
    const record = candidate as Record<string, unknown>;
    return [record.url, record.contentUrl].filter((url): url is string => typeof url === 'string');
  });
}

function meetupImage(value: unknown): string | undefined {
  const candidates = imageCandidates(value).flatMap((candidate) => {
    const url = httpsUrl(candidate);
    if (!url || !MEETUP_IMAGE_HOSTS.has(new URL(url).hostname.toLowerCase())) return [];
    return [url];
  });
  return candidates.find((url) => {
    const dimensions = new URL(url).pathname.match(/(\d+)x(\d+)/);
    return dimensions && Number(dimensions[1]) / Number(dimensions[2]) >= 1.5;
  }) ?? candidates[0];
}

function structuredSpeakers(item: Record<string, any>): EventSpeaker[] | undefined {
  const speakers = values(item.performer ?? item.performers ?? item.speaker).flatMap((candidate) => {
    if (typeof candidate === 'string') return candidate.trim() ? [{ name: candidate.trim() }] : [];
    if (!candidate || typeof candidate !== 'object') return [];
    const record = candidate as Record<string, unknown>;
    const name = text(record.name);
    if (!name) return [];
    const url = httpsUrl(record.url);
    return [{ name, ...(url ? { url } : {}) }];
  });
  const unique = [...new Map(speakers.map((speaker) => [speaker.name.toLocaleLowerCase('es'), speaker])).values()].slice(0, 8);
  return unique.length ? unique : undefined;
}

function schemaStatus(value: unknown): string | undefined {
  const status = text(value);
  return status?.split('/').filter(Boolean).pop();
}

function eventStatus(value: unknown): EventStatus {
  const status = schemaStatus(value);
  if (status === 'EventScheduled') return 'AUTO_PUBLISHED';
  if (status === 'EventCancelled') return 'CANCELLED';
  throw new Error(`Unsupported or missing Schema.org event status: ${status ?? 'unknown'}`);
}

export function meetupGroupSlug(group: UserGroup): string {
  if (!group.meetupUrl) throw new Error(`Meetup URL missing for ${group.id}`);
  const url = new URL(group.meetupUrl);
  if (!MEETUP_HOSTS.has(url.hostname.toLowerCase())) throw new Error(`Invalid Meetup host for ${group.id}`);
  const segments = url.pathname.split('/').filter(Boolean).filter((segment) => !LOCALE_SEGMENT.test(segment));
  const slug = segments[0]?.toLowerCase();
  if (!slug) throw new Error(`Meetup slug missing for ${group.id}`);
  return slug;
}

export interface MeetupEventReference {
  sourceId: string;
  eventId: string;
  url: string;
  title?: string;
}

export function meetupEventReference(value: string, group: UserGroup): MeetupEventReference {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !MEETUP_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) {
    throw new Error(`Unsafe Meetup event URL for ${group.id}`);
  }
  const segments = url.pathname.split('/').filter(Boolean).filter((segment) => !LOCALE_SEGMENT.test(segment));
  const eventIndex = segments.indexOf('events');
  const slug = eventIndex > 0 ? segments[eventIndex - 1]?.toLowerCase() : undefined;
  const eventId = eventIndex >= 0 ? segments[eventIndex + 1] : undefined;
  if (slug !== meetupGroupSlug(group) || !eventId || !/^\d+$/.test(eventId)) {
    throw new Error(`Meetup event URL does not belong to ${group.id}`);
  }
  return {
    sourceId: `meetup:${eventId}`,
    eventId,
    url: `https://www.meetup.com/${slug}/events/${eventId}/`,
  };
}

function organizerMatches(item: Record<string, any>, group: UserGroup): boolean {
  const expected = meetupGroupSlug(group);
  return values(item.organizer).some((organizer) => {
    if (!organizer || typeof organizer !== 'object') return false;
    const url = httpsUrl((organizer as Record<string, unknown>).url);
    if (!url) return false;
    try {
      const segments = new URL(url).pathname.split('/').filter(Boolean).filter((segment) => !LOCALE_SEGMENT.test(segment));
      return MEETUP_HOSTS.has(new URL(url).hostname.toLowerCase()) && segments[0]?.toLowerCase() === expected;
    } catch {
      return false;
    }
  });
}

export class MeetupReviewError extends Error {
  constructor(message: string, readonly draft?: RawEvent) {
    super(message);
    this.name = 'MeetupReviewError';
  }
}

export function parseMeetupEventPage(html: string, group: UserGroup, expectedUrl: string): RawEvent {
  const expected = meetupEventReference(expectedUrl, group);
  const matches = eventObjects(html).filter((item) => {
    const url = text(item.url);
    if (!url) return false;
    try { return meetupEventReference(url, group).eventId === expected.eventId; } catch { return false; }
  });
  if (matches.length !== 1) throw new Error(`Expected one matching JSON-LD Event for ${expected.eventId}, found ${matches.length}`);

  const item = matches[0];
  const title = text(item.name);
  const start = explicitDate(item.startDate);
  const end = explicitDate(item.endDate);
  if (!title || !start || !end || end < start) throw new Error(`Meetup event ${expected.eventId} has incomplete or ambiguous dates`);
  if (!organizerMatches(item, group)) throw new Error(`Meetup event ${expected.eventId} has an unexpected organizer`);

  const location = item.location && typeof item.location === 'object' ? item.location : {};
  const address = location.address && typeof location.address === 'object' ? location.address : {};
  const city = text(address.addressLocality) ?? group.city;
  const venue = text(location.name);

  const draft: RawEvent = {
    sourceId: expected.sourceId,
    source: 'meetup-public-page',
    userGroupId: group.id,
    title,
    description: text(item.description),
    imageUrl: meetupImage(item.image),
    speakers: structuredSpeakers(item),
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    timezone: group.timezone ?? 'Europe/Madrid',
    city,
    venue,
    url: expected.url,
    status: 'PENDING_REVIEW',
  };
  try {
    return { ...draft, status: eventStatus(item.eventStatus) };
  } catch (error) {
    throw new MeetupReviewError(error instanceof Error ? error.message : String(error), draft);
  }
}

export function parseJsonLdEvents(html: string, group: UserGroup, source: EventSourceType): RawEvent[] {
  return eventObjects(html).map((item, index) => {
    const title = text(item.name);
    const start = explicitDate(item.startDate);
    const end = explicitDate(item.endDate);
    const url = httpsUrl(item.url);
    if (!title || !url || !start || (item.endDate && !end)) throw new Error(`JSON-LD event ${index + 1} is incomplete or has an ambiguous date`);
    const location = item.location && typeof item.location === 'object' ? item.location : {};
    const address = location.address && typeof location.address === 'object' ? location.address : {};
    return {
      sourceId: String(item['@id'] ?? url),
      source,
      userGroupId: group.id,
      title,
      description: text(item.description),
      imageUrl: imageCandidates(item.image).map(httpsUrl).find(Boolean),
      speakers: structuredSpeakers(item),
      startDate: start.toISOString(),
      endDate: end?.toISOString(),
      timezone: group.timezone ?? 'Europe/Madrid',
      city: text(address.addressLocality) ?? group.city,
      venue: text(location.name),
      url,
      status: 'PENDING_REVIEW',
    };
  });
}

abstract class JsonLdWebsiteSource implements EventSource {
  abstract readonly type: 'meetup-public-page' | 'custom-website';
  protected requiresExplicitPermission = false;

  async discover(group: UserGroup, definition: SourceDefinition, state: SourceState): Promise<SourceResult> {
    if (!definition.url) throw new Error(`Website URL missing for ${group.id}`);
    if (this.requiresExplicitPermission && !definition.allowAutomatedFetch) {
      throw new Error(`Automated public-page fetching is not approved for ${group.id}`);
    }
    const response = await conditionalFetch(definition.url, state);
    if (response.notModified || !response.body) return { events: [], state: response.state, notModified: true };
    const events = this.type === 'meetup-public-page'
      ? [parseMeetupEventPage(response.body, group, definition.url)]
      : parseJsonLdEvents(response.body, group, this.type);
    return { events, state: response.state };
  }
}

export class MeetupPublicPageSource extends JsonLdWebsiteSource {
  readonly type = 'meetup-public-page' as const;
  protected requiresExplicitPermission = true;
}

export class CustomWebsiteSource extends JsonLdWebsiteSource {
  readonly type = 'custom-website' as const;
}
