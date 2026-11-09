import { writeFile } from 'node:fs/promises';

const url = process.env.PUBLIC_EVENTS_SNAPSHOT_URL;
if (!url) {
  console.log('No PUBLIC_EVENTS_SNAPSHOT_URL configured; keeping the versioned fallback.');
  process.exit(0);
}

const safeHttpsUrl = (value) => {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
};

const validEvent = (event) => event && typeof event === 'object'
  && typeof event.id === 'string'
  && typeof event.sourceId === 'string'
  && typeof event.source === 'string'
  && typeof event.userGroupId === 'string'
  && typeof event.title === 'string'
  && typeof event.startDate === 'string'
  && !Number.isNaN(new Date(event.startDate).valueOf())
  && typeof event.timezone === 'string'
  && typeof event.city === 'string'
  && typeof event.status === 'string'
  && safeHttpsUrl(event.url)
  && (event.imageUrl === undefined || safeHttpsUrl(event.imageUrl))
  && (event.speakers === undefined || (Array.isArray(event.speakers) && event.speakers.length <= 8
    && event.speakers.every((speaker) => speaker && typeof speaker.name === 'string'
      && (speaker.url === undefined || safeHttpsUrl(speaker.url)))));

const response = await fetch(url, { headers: { accept: 'application/json' } });
if (!response.ok) throw new Error(`Snapshot download failed with HTTP ${response.status}`);
const snapshot = await response.json();
if (!snapshot || typeof snapshot.generatedAt !== 'string' || Number.isNaN(new Date(snapshot.generatedAt).valueOf())
  || !Array.isArray(snapshot.events) || !snapshot.events.every(validEvent)) {
  throw new Error('Snapshot has an invalid shape or unsafe event fields');
}
await writeFile(new URL('../src/data/events.json', import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Downloaded ${snapshot.events.length} public events.`);
