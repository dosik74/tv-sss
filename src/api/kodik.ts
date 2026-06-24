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

export async function fetchCatalog(kind: 'all' | 'anime' | 'movies' | 'serials', limit = 30) {
  const res = await fetch(`${getApiBase()}/list?kind=${kind}&limit=${limit}`, {
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Каталог Kodik: ${res.status} ${detail}`);
  }
  const body = await res.json();
  return Array.isArray(body.results) ? body.results : [];
}

export interface KodikTranslationOption {
  id: string;
  type: string;
  name: string;
  series_range?: [number, number];
}

export async function fetchTranslationOptions(params: { id: string; idType: string; }) {
  const query = new URLSearchParams({
    id: params.id,
    id_type: params.idType,
  });
  const res = await fetch(`${getApiBase()}/translations?${query}`, {
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Список озвучек Kodik: ${res.status} ${detail}`);
  }
  const body = await res.json();
  return Array.isArray(body.translations) ? body.translations as KodikTranslationOption[] : [];
}

export async function fetchPlayUrl(params: {
  id: string;
  idType: string;
  seriaNum: number;
  translationId?: string;
  quality?: number;
}) {
  const query = new URLSearchParams({
    id: params.id,
    id_type: params.idType,
    seria_num: String(params.seriaNum),
    translation_id: params.translationId || '0',
    quality: String(params.quality || 720),
  });
  const res = await fetch(`${getApiBase()}/play?${query}`, {
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Плеер Kodik: ${res.status} ${detail}`);
  }
  return res.json() as Promise<{ m3u8_url?: string }>;
}

export async function fetchEmbedUrl(params: { id: string; idType: string }) {
  const query = new URLSearchParams({
    id: params.id,
    id_type: params.idType,
  });
  const res = await fetch(`${getApiBase()}/embed?${query}`, {
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Embed Kodik: ${res.status} ${detail}`);
  }
  return res.json() as Promise<{ embed_url?: string }>;
}

export async function fetchEpisodes(params: { id: string; idType: string }) {
  const query = new URLSearchParams({
    id: params.id,
    id_type: params.idType,
  });
  const res = await fetch(`${getApiBase()}/episodes?${query}`, {
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Список серий Kodik: ${res.status} ${detail}`);
  }
  const body = await res.json();
  return Array.isArray(body.episodes) ? body.episodes : [];
}
