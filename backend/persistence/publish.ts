import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { EventsSnapshot } from '../../src/lib/types';
import { generateSnapshot } from '../normalization/snapshot';
import type { EventRepository } from './repository';
import type { EventOverride } from './types';

const s3 = new S3Client({});
const sns = new SNSClient({});

export async function publishSnapshot(bucket: string, snapshot: EventsSnapshot): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: 'events.json',
    Body: JSON.stringify(snapshot, null, 2),
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'public, max-age=300, stale-while-revalidate=3600',
  }));
}

export function applyOverrides(
  events: EventsSnapshot['events'],
  overrides: EventOverride[],
): EventsSnapshot['events'] {
  const merged = new Map(events.map((event) => [event.id, event]));
  for (const override of overrides) merged.set(override.event.id, override.event);
  return [...merged.values()];
}

export async function publishCurrentSnapshot(
  repository: EventRepository,
  bucket: string,
  now = new Date(),
): Promise<EventsSnapshot> {
  const [events, overrides] = await Promise.all([repository.loadEvents(), repository.loadOverrides()]);
  const snapshot = generateSnapshot(applyOverrides(events, overrides), now);
  await publishSnapshot(bucket, snapshot);
  return snapshot;
}

export async function notify(topicArn: string, subject: string, lines: string[]): Promise<void> {
  if (lines.length === 0) return;
  await sns.send(new PublishCommand({
    TopicArn: topicArn,
    Subject: subject.slice(0, 100),
    Message: lines.join('\n'),
  }));
}
