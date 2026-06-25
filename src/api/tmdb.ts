const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '2dca580c2a14b55200e784d157207b4d';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
  original_language: string;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBSearchResult {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids: number[];
  original_language: string;
}

export interface TMDBMovieDetails extends TMDBMovie {
  genres: TMDBGenre[];
  runtime: number;
  status: string;
  tagline: string;
  imdb_id?: string;
}

export interface TMDBTVShowDetails extends TMDBTVShow {
  genres: TMDBGenre[];
  episode_run_time: number[];
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  tagline: string;
}

function getImageUrl(path: string | null, size: 'w500' | 'w780' | 'original' = 'w500'): string {
  if (!path) return 'https://via.placeholder.com/500x750/1a1a2e/ffffff?text=No+Image';
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

async function tmdbFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', TMDB_API_KEY);
  url.searchParams.append('language', 'ru-RU');
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }
  return response.json();
}

export async function searchMulti(query: string, page: number = 1): Promise<TMDBSearchResult[]> {
  const data = await tmdbFetch('/search/multi', { query, page: String(page) });
  return data.results?.filter((item: TMDBSearchResult) => 
    item.media_type === 'movie' || item.media_type === 'tv'
  ) || [];
}

export async function discoverMovies(page: number = 1): Promise<TMDBMovie[]> {
  const data = await tmdbFetch('/discover/movie', { page: String(page), 'sort_by': 'popularity.desc' });
  return data.results || [];
}

export async function discoverTVShows(page: number = 1): Promise<TMDBTVShow[]> {
  const data = await tmdbFetch('/discover/tv', { page: String(page), 'sort_by': 'popularity.desc' });
  return data.results || [];
}

export async function getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
  return tmdbFetch(`/movie/${movieId}`, { append_to_response: 'credits,videos,external_ids' });
}

export async function getTVShowDetails(tvId: number): Promise<TMDBTVShowDetails> {
  return tmdbFetch(`/tv/${tvId}`, { append_to_response: 'credits,videos,external_ids' });
}

export async function getGenres(): Promise<TMDBGenre[]> {
  const [movieGenres, tvGenres] = await Promise.all([
    tmdbFetch('/genre/movie/list'),
    tmdbFetch('/genre/tv/list')
  ]);
  
  const allGenres = [...(movieGenres.genres || []), ...(tvGenres.genres || [])];
  const uniqueGenres = Array.from(
    new Map(allGenres.map((g: TMDBGenre) => [g.id, g])).values()
  );
  
  return uniqueGenres;
}

export function mapTMDBToUnified(item: TMDBSearchResult | TMDBMovie | TMDBTVShow): {
  id: string;
  tmdbId: number;
  title: string;
  russianTitle: string;
  imageUrl: string;
  bannerUrl: string;
  rating: string;
  year: number;
  genres: number[];
  description: string;
  type: 'movie' | 'series' | 'anime';
  releaseDate: string;
  originalLanguage: string;
} {
  const isMovie = 'title' in item;
  const isTV = 'name' in item;
  
  const title = isMovie ? (item as TMDBMovie).title : (item as TMDBTVShow).name;
  const originalTitle = isMovie ? (item as TMDBMovie).original_title : (item as TMDBTVShow).original_name;
  const date = isMovie ? (item as TMDBMovie).release_date : (item as TMDBTVShow).first_air_date;
  const year = date ? new Date(date).getFullYear() : 0;
  
  // Определяем тип контента (аниме если оригинальный язык японский)
  const originalLanguage = item.original_language || 'en';
  const type: 'movie' | 'series' | 'anime' = 
    originalLanguage === 'ja' ? 'anime' : 
    isMovie ? 'movie' : 'series';

  return {
    id: `tmdb-${item.id}-${type}`,
    tmdbId: item.id,
    title: originalTitle || title,
    russianTitle: title,
    imageUrl: getImageUrl(item.poster_path, 'w500'),
    bannerUrl: getImageUrl(item.backdrop_path, 'w780'),
    rating: item.vote_average ? item.vote_average.toFixed(1) : '0',
    year,
    genres: item.genre_ids || [],
    description: item.overview || '',
    type,
    releaseDate: date || '',
    originalLanguage
  };
}

// Функция для дедупликации результатов (исключает дубликаты по TMDB ID)
export function deduplicateResults(items: any[]): any[] {
  const seen = new Set<number>();
  return items.filter(item => {
    const tmdbId = item.tmdbId || item.id;
    if (seen.has(tmdbId)) return false;
    seen.add(tmdbId);
    return true;
  });
}
