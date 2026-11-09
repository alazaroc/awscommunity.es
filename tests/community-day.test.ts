import { describe, expect, it } from 'vitest';
import { communityDay, getCommunityDayCopy, getCommunityDayCtaUrl, validateCommunityDay } from '../config/community-day';

describe('Community Day configuration', () => {
  it('keeps promotion mode under explicit organizer control', () => {
    expect(['none', 'banner', 'hero']).toContain(communityDay.promotionMode);
    expect(validateCommunityDay(communityDay)).toEqual([]);
  });

  it('adapts copy and URL to status', () => {
    const config = { ...communityDay, status: 'cfp' as const, ctaUrls: { cfp: 'https://2027.awscommunity.es/cfp' } };
    expect(getCommunityDayCopy(config).cta).toBe('Enviar una charla');
    expect(getCommunityDayCtaUrl(config)).toBe('https://2027.awscommunity.es/cfp');
  });

  it('describes an unannounced edition without inventing details', () => {
    expect(communityDay.status).toBe('preparing');
    expect(communityDay.location).toBeUndefined();
    expect(communityDay.date).toBeUndefined();
    expect(getCommunityDayCopy().message).toContain('Todavía no hay fecha ni ciudad anunciadas');
  });

  it('accepts site-relative destinations and rejects malformed URLs', () => {
    expect(validateCommunityDay({ ...communityDay, url: '/community-day' })).toEqual([]);
    expect(validateCommunityDay({ ...communityDay, url: 'not-a-url' }))
      .toContain('url must be absolute or site-relative');
  });
});
