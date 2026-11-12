export type EventStatus =
  | 'AUTO_PUBLISHED'
  | 'PENDING_REVIEW'
  | 'MANUAL'
  | 'CANCELLED'
  | 'PAST';

export type EventSourceType =
  | 'meetup-rss'
  | 'meetup-public-page'
  | 'custom-website'
  | 'manual';

export type EventDiscoverySourceType = Exclude<EventSourceType, 'manual'>;

export interface EventSpeaker {
  name: string;
  url?: string;
}

export interface CommunityEvent {
  id: string;
  sourceId: string;
  source: EventSourceType;
  userGroupId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  speakers?: EventSpeaker[];
  startDate: string;
  endDate?: string;
  timezone: string;
  city: string;
  venue?: string;
  url: string;
  status: EventStatus;
  firstSeen: string;
  lastSeen: string;
  contentHash: string;
}

export interface EventsSnapshot {
  generatedAt: string;
  events: CommunityEvent[];
}

export interface SourceDefinition {
  type: EventDiscoverySourceType;
  url?: string;
  enabled?: boolean;
  allowAutomatedFetch?: boolean;
}

export interface UserGroupOrganizer {
  name: string;
  url?: string;
}

export interface UserGroupContact {
  label: string;
  url: string;
}

export interface UserGroup {
  id: string;
  name: string;
  city: string;
  region: string;
  description?: string;
  organizers?: UserGroupOrganizer[];
  contact?: UserGroupContact;
  timezone?: string;
  website: string;
  meetupUrl?: string;
  eventSources: SourceDefinition[];
  socialLinks?: Partial<Record<'linkedin' | 'x' | 'youtube' | 'instagram', string>>;
  active: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}
