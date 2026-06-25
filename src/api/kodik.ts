const API_BASE = '/api';

export function getApiBase(): string {
  return API_BASE.replace(/\/$/, '');
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function searchAlloha(params: {
  imdbId?: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
}) {
  const query = new URLSearchParams({
    media_type: params.mediaType,
    season: String(params.season || 1),
    episode: String(params.episode || 1),
  });
  if (params.imdbId) {
    query.append('imdb_id', params.imdbId);
  }
  const res = await fetch(`${getApiBase()}/search_alloha?${query}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Поиск в Alloha: ${res.status} ${detail}`);
  }
  const body = await res.json();
  return body;
}
