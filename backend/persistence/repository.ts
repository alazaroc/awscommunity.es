import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { CommunityEvent } from '../../src/lib/types';
import type { SourceState } from '../sources/types';
import type { BackfillState, EventOverride, ReviewRecord } from './types';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });

const reviewId = (userGroupId: string, sourceId: string) => createHash('sha256')
  .update(`${userGroupId}|${sourceId}`)
  .digest('hex')
  .slice(0, 24);

export class EventRepository {
  constructor(private readonly tableName: string) {}

  private async scanPrefix<T>(prefix: string, unwrap: (item: Record<string, unknown>) => T): Promise<T[]> {
    const values: T[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const response = await client.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(pk, :prefix)',
        ExpressionAttributeValues: { ':prefix': prefix },
        ExclusiveStartKey: lastKey,
      }));
      for (const item of response.Items ?? []) values.push(unwrap(item));
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);
    return values;
  }

  async loadEvents(): Promise<CommunityEvent[]> {
    return this.scanPrefix('EVENT#', (item) => {
      const { pk: _pk, sk: _sk, ...event } = item;
      return event as unknown as CommunityEvent;
    });
  }

  async putEvent(event: CommunityEvent): Promise<void> {
    await client.send(new PutCommand({ TableName: this.tableName, Item: { pk: `EVENT#${event.id}`, sk: 'META', ...event } }));
  }

  async loadOverrides(): Promise<EventOverride[]> {
    return this.scanPrefix('OVERRIDE#', (item) => item.override as EventOverride);
  }

  async putOverride(override: EventOverride): Promise<void> {
    await client.send(new PutCommand({
      TableName: this.tableName,
      Item: { pk: `OVERRIDE#${override.event.id}`, sk: 'META', override },
    }));
  }

  async deleteOverride(eventId: string): Promise<void> {
    await client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { pk: `OVERRIDE#${eventId}`, sk: 'META' },
    }));
  }

  async loadReviews(status?: ReviewRecord['status']): Promise<ReviewRecord[]> {
    const reviews = await this.scanPrefix('REVIEW#', (item) => item.review as ReviewRecord);
    return status ? reviews.filter((review) => review.status === status) : reviews;
  }

  async getReview(id: string): Promise<ReviewRecord | undefined> {
    const response = await client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: `REVIEW#${id}`, sk: 'META' },
      ConsistentRead: true,
    }));
    return response.Item?.review as ReviewRecord | undefined;
  }

  async recordReview(candidate: Omit<ReviewRecord, 'id' | 'status' | 'firstSeen' | 'lastSeen' | 'occurrences'>): Promise<ReviewRecord> {
    const id = reviewId(candidate.userGroupId, candidate.sourceId);
    const previous = await this.getReview(id);
    const now = new Date().toISOString();
    const unchangedDismissal = previous?.status === 'DISMISSED'
      && previous.reason === candidate.reason
      && previous.url === candidate.url;
    const review: ReviewRecord = {
      ...candidate,
      id,
      status: unchangedDismissal ? 'DISMISSED' : 'OPEN',
      firstSeen: previous?.firstSeen ?? now,
      lastSeen: now,
      occurrences: (previous?.occurrences ?? 0) + 1,
    };
    await client.send(new PutCommand({
      TableName: this.tableName,
      Item: { pk: `REVIEW#${id}`, sk: 'META', review },
    }));
    return review;
  }

  async setReviewStatus(id: string, status: ReviewRecord['status']): Promise<ReviewRecord> {
    const previous = await this.getReview(id);
    if (!previous) throw new Error(`Review ${id} not found`);
    const now = new Date().toISOString();
    const review: ReviewRecord = {
      ...previous,
      status,
      lastSeen: now,
      ...(status === 'RESOLVED' ? { resolvedAt: now } : {}),
    };
    await client.send(new PutCommand({
      TableName: this.tableName,
      Item: { pk: `REVIEW#${id}`, sk: 'META', review },
    }));
    return review;
  }

  async resolveReview(userGroupId: string, sourceId: string): Promise<void> {
    const id = reviewId(userGroupId, sourceId);
    const review = await this.getReview(id);
    if (review?.status === 'OPEN') await this.setReviewStatus(id, 'RESOLVED');
  }

  async getSourceState(sourceKey: string): Promise<SourceState> {
    const response = await client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: `SOURCE#${sourceKey}`, sk: 'STATE' },
      ConsistentRead: true,
    }));
    return (response.Item?.state as SourceState | undefined) ?? {};
  }

  async putSourceState(sourceKey: string, state: SourceState): Promise<void> {
    await client.send(new PutCommand({
      TableName: this.tableName,
      Item: { pk: `SOURCE#${sourceKey}`, sk: 'STATE', state },
    }));
  }

  async getBackfillState(year: number, userGroupId: string): Promise<BackfillState | undefined> {
    const response = await client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: `BACKFILL#${year}#${userGroupId}`, sk: 'STATE' },
      ConsistentRead: true,
    }));
    return response.Item?.state as BackfillState | undefined;
  }

  async putBackfillState(state: BackfillState): Promise<void> {
    await client.send(new PutCommand({
      TableName: this.tableName,
      Item: { pk: `BACKFILL#${state.year}#${state.userGroupId}`, sk: 'STATE', state },
    }));
  }
}
