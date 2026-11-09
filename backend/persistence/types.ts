import type { CommunityEvent } from '../../src/lib/types';
import type { RawEvent } from '../sources/types';

export type ReviewStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface ReviewRecord {
  id: string;
  status: ReviewStatus;
  sourceId: string;
  source: RawEvent['source'];
  userGroupId: string;
  title: string;
  url: string;
  reason: string;
  draft?: RawEvent;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  resolvedAt?: string;
}

export interface EventOverride {
  event: CommunityEvent;
  createdAt: string;
  updatedAt: string;
}

export interface BackfillState {
  year: number;
  from: string;
  userGroupId: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_REVIEWS' | 'PARTIAL';
  listingUrl: string;
  sourceIds: string[];
  visibleUrls: number;
  imported: number;
  ignoredBeforeCutoff: number;
  reviewRequired: number;
  failedUrls: string[];
  completedAt: string;
}
