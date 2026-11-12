import { describe, expect, it } from 'vitest';
import { groupDescription, localizedPath, localeFromPath, switchLocalePath, t } from '../src/lib/i18n';
import { shortDate, yearCaption } from '../src/lib/history';

import type { CommunityEvent } from '../src/lib/types';

const event = {
  startDate: '2026-11-10T18:00:00.000Z',
  timezone: 'Europe/Madrid',
} as CommunityEvent;

describe('localization', () => {
  it('translates UI copy and interpolates values', () => {
    expect(t('en', 'filterResults', { count: 3 })).toBe('3 events');
    expect(t('es', 'filterResults', { count: 3 })).toBe('3 eventos');
  });

  it('localizes Winter and the Halloween community journey', () => {
    expect(t('es', 'themeWinter')).toBe('Invierno');
    expect(t('en', 'themeWinter')).toBe('Winter');
    expect(t('es', 'halloweenGuideTitle')).toBe('La comunidad sigue despierta');
    expect(t('en', 'halloweenGuideTitle')).toBe('The community stays awake');
  });

  it('maps equivalent routes between language families', () => {
    expect(localizedPath('en', '/events')).toBe('/en/events');
    expect(switchLocalePath('/en/user-groups/madrid/', 'es')).toBe('/user-groups/madrid/');
    expect(switchLocalePath('/user-groups/madrid/', 'en')).toBe('/en/user-groups/madrid/');
    expect(localeFromPath('/en/events/')).toBe('en');
    expect(localeFromPath('/events/')).toBe('es');
  });

  it('uses localized dates and group descriptions', () => {
    expect(yearCaption(2026, 2, 'en')).toBe('2026 · 2 events');
    expect(shortDate(event, 'en')).toBe('10 Nov');
    expect(groupDescription('madrid', 'en', 'fallback')).toContain('AWS users');
    expect(groupDescription('madrid', 'es', 'fallback')).toBe('fallback');
  });
});
