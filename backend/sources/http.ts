import { createHash } from 'node:crypto';
import type { HttpState } from './types';

export interface HttpResult<T extends HttpState = HttpState> {
  body?: string;
  notModified: boolean;
  state: T;
}

export async function conditionalFetch<T extends HttpState>(url: string, state: T): Promise<HttpResult<T>> {
  const headers = new Headers({
    accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.8',
    'user-agent': 'CloudCommunitySpain-EventDiscovery/1.0 (+https://awscommunity.es/about)',
  });
  if (state.etag) headers.set('if-none-match', state.etag);
  if (state.lastModified) headers.set('if-modified-since', state.lastModified);

  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  const checkedAt = new Date().toISOString();
  if (response.status === 304) {
    return { notModified: true, state: { ...state, lastCheckedAt: checkedAt, consecutiveFailures: 0 } };
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);

  const body = await response.text();
  const contentHash = createHash('sha256').update(body).digest('hex');
  const nextState: T = {
    ...state,
    etag: response.headers.get('etag') ?? state.etag,
    lastModified: response.headers.get('last-modified') ?? state.lastModified,
    contentHash,
    lastCheckedAt: checkedAt,
    lastSuccessAt: checkedAt,
    consecutiveFailures: 0,
  };
  return { body, notModified: contentHash === state.contentHash, state: nextState };
}
