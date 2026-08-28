import { BUILDINGS } from '../core/config';
import type { ResourceId } from '../core/types';

export type GlyphName = 'coin' | 'bolt' | 'flask' | 'solar' | 'wind' | 'refinery' | 'lab';

export const GLYPHS: Record<GlyphName, string> = {
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><path d="M12 8v8M9.5 10.5h5M9.5 13.5h5"/>',
  bolt: '<path d="M13 2 4.5 14h6L11 22l8.5-12h-6z"/>',
  flask: '<path d="M9.5 3v5L4 19a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3L14.5 8V3"/><path d="M7.5 3h9"/>',
  solar:
    '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8.9 4v16M13.1 4v16M4 8.9h16M4 13.1h16"/><path d="M4 4l1.5 1.5M19 4l-1.5 1.5M4 20l1.5-1.5M19 20l-1.5-1.5"/>',
  wind:
    '<path d="M12 3v13"/><path d="M12 13.5c4 0 6-2 6-4.5 0-3-3-4-4.5-3.5C13 7 14 9 8 10"/><path d="M12 16.5c-4 0-6 2-6 4.5 0 3 3 4 4.5 3.5C11 20 10 18 16 17"/><path d="M4 21h16M9 21v1.5M15 21v1.5"/>',
  refinery:
    '<rect x="6" y="4" width="12" height="16" rx="1"/><path d="M6 9h12M6 18.5h12"/><path d="M18 12h3.5v3H18"/><path d="M4 8H2v3h2"/><circle cx="12" cy="6.5" r="1.4"/>',
  lab:
    '<path d="M10 3v4l-5.5 9A2 2 0 0 0 6.2 19h11.6a2 2 0 0 0 1.7-3L14 7V3"/><path d="M8.5 3h7"/><circle cx="9.2" cy="14.5" r="0.9"/><circle cx="12.1" cy="16.5" r="0.9"/><circle cx="14.8" cy="12.5" r="0.9"/>',
};

export function icon(name: GlyphName, size = 18): string {
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${GLYPHS[name]}</svg>`;
}

const RESOURCE_GLYPH: Record<ResourceId, GlyphName> = {
  money: 'coin',
  energy: 'bolt',
  research: 'flask',
};

export function resourceIcon(id: ResourceId, size = 16): string {
  return icon(RESOURCE_GLYPH[id], size);
}

export function buildingIcon(id: string, size = 16): string {
  const def = BUILDINGS.find((b) => b.id === id);
  if (!def) return icon('solar', size);
  switch (def.icon) {
    case 'wind':
      return icon('wind', size);
    case 'refinery':
      return icon('refinery', size);
    case 'lab':
      return icon('lab', size);
    default:
      return icon('solar', size);
  }
}