import {
  coerceProviderRefFromMediaType,
  coerceProviderRef,
  formatProviderRef,
  parseEpisodeIdSuffix,
  parseProviderRefStrict,
  type MediaType,
  type ProviderRef,
} from '@crispy-streaming/media-core';

export type AppMediaType = 'movie' | 'series';

function isRawNumericId(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

function toCoreMediaType(type: string): MediaType | null {
  const lowered = type.trim().toLowerCase();
  if (lowered === 'movie' || lowered === 'film') return 'movie';
  if (lowered === 'series' || lowered === 'show' || lowered === 'tv') return 'series';
  return null;
}

function toProviderKind(type: AppMediaType | string): 'movie' | 'show' {
  const core = toCoreMediaType(String(type));
  return core === 'movie' ? 'movie' : 'show';
}

export function parseAppEpisodeSuffix(id: string | number): { baseId: string; season?: number; episode?: number } {
  return parseEpisodeIdSuffix(String(id));
}

export function isStrictMediaId(id: string | number): boolean {
  const parsed = parseEpisodeIdSuffix(String(id));
  return parseProviderRefStrict(parsed.baseId) != null;
}

/**
 * Returns strict `provider:kind:id` (plus optional `:<season>:<episode>`).
 *
 * Accepts existing strict ids, or legacy ids like `tmdb:550`, `tt0137523`, etc.
 */
export function toStrictMediaId(id: string | number, type: AppMediaType | string): string | null {
  const kind = toProviderKind(type);
  // Disallow raw numeric guessing (e.g. "550"), require an explicit provider or strict id.
  if (typeof id === 'number') return null;
  const suffix = parseEpisodeIdSuffix(String(id));
  if (isRawNumericId(suffix.baseId) && !String(id).includes(':')) return null;
  const ref = coerceProviderRefFromMediaType(suffix.baseId, kind === 'movie' ? 'movie' : 'series');
  if (!ref) return null;

  const base = formatProviderRef(ref);
  if (typeof suffix.season === 'number' && typeof suffix.episode === 'number') {
    return `${base}:${suffix.season}:${suffix.episode}`;
  }
  return base;
}

export function toStrictBaseMediaId(id: string | number, type: AppMediaType | string): string | null {
  const strict = toStrictMediaId(id, type);
  if (!strict) return null;
  return parseEpisodeIdSuffix(strict).baseId;
}

export function toStrictProviderRef(id: string | number, type: AppMediaType | string): ProviderRef | null {
  const kind = toProviderKind(type);
  // Disallow raw numeric guessing; require explicit provider or strict id.
  if (typeof id === 'number') return null;
  const suffix = parseEpisodeIdSuffix(String(id));
  if (isRawNumericId(suffix.baseId) && !String(id).includes(':')) return null;
  const ref = coerceProviderRefFromMediaType(suffix.baseId, kind === 'movie' ? 'movie' : 'series');
  if (!ref) return null;
  if (typeof suffix.season === 'number' && typeof suffix.episode === 'number') {
    return { ...ref, season: suffix.season, episode: suffix.episode };
  }
  return ref;
}

export function makeEpisodeId(baseId: string, season: number, episode: number): string {
  return `${baseId}:${season}:${episode}`;
}

export function toImdbIdForExternalLookup(id: string | number, type: AppMediaType | string): string | null {
  const kind = toProviderKind(type);
  const suffix = parseEpisodeIdSuffix(String(id));
  const ref = coerceProviderRef(suffix.baseId, kind);
  if (!ref) return null;
  if (ref.provider !== 'imdb') return null;
  return ref.id;
}
