export type PromotionMode = 'none' | 'banner' | 'hero';
export type CommunityDayStatus = 'preparing' | 'announced' | 'cfp' | 'tickets' | 'agenda' | 'completed';

export interface CommunityDayEdition {
  year: number;
  location: string;
  date?: string;
  url: string;
}

export interface CommunityDayConfig {
  year: number;
  location?: string;
  date?: string;
  url: string;
  enabled: boolean;
  promotionMode: PromotionMode;
  status: CommunityDayStatus;
  ctaUrls?: Partial<Record<CommunityDayStatus, string>>;
}

export const communityDay: CommunityDayConfig = {
  enabled: true,
  year: 2027,
  url: '/community-day',
  promotionMode: 'banner',
  status: 'preparing',
  ctaUrls: {
    preparing: '/community-day',
  },
};

export const communityDayEditions: CommunityDayEdition[] = [
  { year: 2026, location: 'Santiago de Compostela', date: '2026-10-17', url: 'https://2026.awscommunity.es' },
  { year: 2025, location: 'Zaragoza', date: '2025-11-15', url: 'https://2025.awscommunity.es' },
  { year: 2024, location: 'Gijón', date: '2024-10-19', url: 'https://2024.awscommunity.es' },
  { year: 2023, location: 'Barcelona', url: 'https://2023.awscommunity.es' },
];

const statusCopy: Record<CommunityDayStatus, { eyebrow: string; message: string; cta: string }> = {
  preparing: { eyebrow: 'Próxima edición', message: 'Estamos preparando la edición de 2027. Todavía no hay fecha ni ciudad anunciadas', cta: 'Conocer el Community Day' },
  announced: { eyebrow: 'Próxima edición', message: 'Descubre la próxima edición', cta: 'Descubrir la edición' },
  cfp: { eyebrow: 'Call for Papers abierto', message: 'Comparte tu experiencia con la comunidad', cta: 'Enviar una charla' },
  tickets: { eyebrow: 'Inscripciones abiertas', message: 'Reserva tu plaza para el evento', cta: 'Conseguir entrada' },
  agenda: { eyebrow: 'Agenda publicada', message: 'Explora todas las sesiones', cta: 'Ver la agenda' },
  completed: { eyebrow: 'Gracias, comunidad', message: 'Revive la última edición', cta: 'Revivir el evento' },
};

export function getCommunityDayCopy(config: CommunityDayConfig = communityDay) {
  return statusCopy[config.status];
}

export function getCommunityDayCtaUrl(config: CommunityDayConfig = communityDay) {
  return config.ctaUrls?.[config.status] ?? config.url;
}

export function validateCommunityDay(config: CommunityDayConfig): string[] {
  const errors: string[] = [];
  const isValidUrl = (value: string) => {
    if (value.startsWith('/') && !value.startsWith('//')) return true;
    try { new URL(value); return true; } catch { return false; }
  };

  if (!Number.isInteger(config.year) || config.year < 2023) errors.push('year must be a valid edition year');
  if (config.status !== 'preparing' && !config.location?.trim()) errors.push('location is required');
  if (!isValidUrl(config.url)) errors.push('url must be absolute or site-relative');
  const ctaUrl = config.ctaUrls?.[config.status];
  if (ctaUrl && !isValidUrl(ctaUrl)) errors.push(`ctaUrls.${config.status} must be absolute or site-relative`);
  return errors;
}
