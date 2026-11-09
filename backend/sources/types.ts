import type { EventSourceType, EventSpeaker, EventStatus, SourceDefinition, UserGroup } from '../../src/lib/types';

export interface RawEvent {
  sourceId: string;
  source: EventSourceType;
  userGroupId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  speakers?: EventSpeaker[];
  startDate: string;
  endDate?: string;
  timezone?: string;
  city?: string;
  venue?: string;
  url: string;
  status?: EventStatus;
}

export interface ReviewCandidate {
  sourceId: string;
  source: EventSourceType;
  userGroupId: string;
  title: string;
  url: string;
  reason: string;
  draft?: RawEvent;
}

export interface HttpState {
  etag?: string;
  lastModified?: string;
  contentHash?: string;
  consecutiveFailures?: number;
  lastCheckedAt?: string;
  lastSuccessAt?: string;
}

export interface TrackedMeetupEvent {
  sourceId: string;
  title?: string;
  url: string;
  discoveredAt: string;
  endDate?: string;
  status?: EventStatus;
  http: HttpState;
}

export interface SourceState extends HttpState {
  seenSourceIds?: string[];
  trackedMeetupEvents?: TrackedMeetupEvent[];
}

export interface SourceResult {
  events: RawEvent[];
  reviewCandidates?: ReviewCandidate[];
  state: SourceState;
  notModified?: boolean;
}

export interface EventSource {
  readonly type: SourceDefinition['type'];
  discover(group: UserGroup, definition: SourceDefinition, state: SourceState): Promise<SourceResult>;
}
