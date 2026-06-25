import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Film, Tv, Sparkles, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { searchMulti, discoverMovies, discoverTVShows, mapTMDBToUnified, deduplicateResults } from '../api/tmdb';

type ContentType = 'all' | 'movie' | 'series' | 'anime';

interface UnifiedContent {
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
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [contentType, setContentType] = useState<ContentType>('all');
  const [results, setResults] = useState<UnifiedContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const contentTypes = [
    { id: 'all' as ContentType, label: 'Все', icon: Sparkles },
    { id: 'movie' as ContentType, label: 'Фильмы', icon: Film },
    { id: 'series' as ContentType, label: 'Сериалы', icon: Tv },
    { id: 'anime' as ContentType, label: 'Аниме', icon: Sparkles },
  ];

  const fetchResults = useCallback(async (query: string, type: ContentType, pageNum: number = 1) => {
    if (!query.trim() && type === 'all') {
      // Если нет запроса и тип "все", показываем популярное
      setIsLoading(true);
      setError(null);
      try {
        const [movies, tvShows] = await Promise.all([
          discoverMovies(pageNum),
          discoverTVShows(pageNum),
        ]);

        const unified = [
          ...movies.map(mapTMDBToUnified),
          ...tvShows.map(mapTMDBToUnified),
        ];

        const deduplicated = deduplicateResults(unified);
        
        if (pageNum === 1) {
          setResults(deduplicated);
        } else {
          setResults(prev => deduplicateResults([...prev, ...deduplicated]));
        }

        setHasMore(deduplicated.length > 0);
      } catch (err) {
        setError('Не удалось загрузить контент');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const searchResults = await searchMulti(query, pageNum);
      
      let filtered = searchResults;
      if (type === 'movie') {
        filtered = searchResults.filter(item => item.media_type === 'movie');
      } else if (type === 'series') {
        filtered = searchResults.filter(item => item.media_type === 'tv');
      } else if (type === 'anime') {
        filtered = searchResults.filter(item => 
          item.media_type === 'tv' && item.original_language === 'ja'
        );
      }

      const unified = filtered.map(mapTMDBToUnified);
      const deduplicated = deduplicateResults(unified);

      if (pageNum === 1) {
        setResults(deduplicated);
      } else {
        setResults(prev => deduplicateResults([...prev, ...deduplicated]));
      }

      setHasMore(deduplicated.length > 0);
    } catch (err) {
      setError('Не удалось выполнить поиск');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setPage(1);
      fetchResults(searchQuery, contentType, 1);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, contentType, fetchResults]);

  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchResults(searchQuery, contentType, nextPage);
    }
  };

  const handleCardClick = (item: UnifiedContent) => {
    navigate(`/detail/${item.type}/${item.tmdbId}`);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Search Input */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск фильмов, сериалов, аниме..."
              className="w-full bg-neutral-900/50 border border-neutral-700 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content Type Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {contentTypes.map((type) => {
              const IconComponent = type.icon;
              const isActive = contentType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => {
                    setContentType(type.id);
                    setPage(1);
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-neutral-400">Загрузка...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => fetchResults(searchQuery, contentType, 1)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        ) : results.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="w-16 h-16 text-neutral-700 mb-4" />
            <p className="text-neutral-400 text-lg">
              {searchQuery ? 'Ничего не найдено' : 'Введите запрос для поиска'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              <AnimatePresence>
                {results.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleCardClick(item)}
                    className="group relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer bg-neutral-900"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.russianTitle}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white font-medium text-sm line-clamp-2 mb-1">
                          {item.russianTitle}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-neutral-300">
                          <span className="bg-blue-600/80 px-2 py-0.5 rounded">
                            {item.type === 'movie' ? 'Фильм' : item.type === 'series' ? 'Сериал' : 'Аниме'}
                          </span>
                          <span>{item.year}</span>
                          <span className="flex items-center gap-1">
                            ⭐ {item.rating}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {hasMore && results.length > 0 && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-8 py-3 bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    'Загрузить еще'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
