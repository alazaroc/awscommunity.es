import type { CommunityEvent } from './types';
import type { Locale } from './i18n';
import { localeTag } from './i18n';

export function upcomingEventsSchema(events: CommunityEvent[], locale: Locale, site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: locale === 'en' ? 'Upcoming AWS community events in Spain' : 'Próximos eventos de la comunidad AWS en España',
    url: new URL(locale === 'en' ? '/en/events/' : '/events/', site).toString(),
    numberOfItems: events.length,
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Event',
        name: event.title,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        eventStatus: event.status === 'CANCELLED' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        url: event.url,
        inLanguage: localeTag(locale),
        location: {
          '@type': 'Place',
          name: event.venue || event.city,
          address: { '@type': 'PostalAddress', addressLocality: event.city, addressCountry: 'ES' },
        },
        organizer: { '@type': 'Organization', name: 'AWS Community Spain', url: site.toString() },
      },
    })),
  };
}
