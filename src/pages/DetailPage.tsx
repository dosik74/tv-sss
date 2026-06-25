import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Heart, 
  Star, 
  Calendar, 
  Clock, 
  Film, 
  Tv, 
  Loader2,
  AlertCircle,
  Share2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getMovieDetails, 
  getTVShowDetails, 
  type TMDBMovieDetails,
  type TMDBTVShowDetails,
  type TMDBGenre
} from '../api/tmdb';
import { 
  searchAlloha
} from '../api/kodik';

export default function DetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<TMDBMovieDetails | TMDBTVShowDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Alloha плеер состояния
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!type || !id) return;

    setIsLoading(true);
    setError(null);

    try {
      const tmdbId = parseInt(id);
      if (type === 'movie') {
        const movieDetails = await getMovieDetails(tmdbId);
        setDetails(movieDetails);
      } else if (type === 'series' || type === 'anime') {
        const tvDetails = await getTVShowDetails(tmdbId);
        setDetails(tvDetails);
      } else {
        throw new Error('Неверный тип контента');
      }
    } catch (err) {
      setError('Не удалось загрузить информацию');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [type, id]);

  const handlePlay = useCallback(async () => {
    if (!details) return;

    setIsPlayerLoading(true);
    setError(null);

    try {
      const isMovie = 'title' in details;
      const mediaType = isMovie ? 'movie' : 'tv';
      
      // Получаем external_ids из TMDB
      const externalIds = (details as any).external_ids || {};
      const imdbId = externalIds.imdb_id;

      console.log('Searching Alloha with:', { imdbId, mediaType });

      const allohaResult = await searchAlloha({
        imdbId: imdbId || undefined,
        mediaType: mediaType,
        season: 1,
        episode: 1,
      });

      console.log('Alloha result:', allohaResult);

      if (allohaResult.embed_url) {
        setEmbedUrl(allohaResult.embed_url);
        setShowPlayer(true);
      } else {
        setError('Видео не найдено в Alloha. Возможно контент недоступен.');
      }
    } catch (err) {
      console.error('Ошибка поиска:', err);
      setError('Не удалось загрузить видео. Попробуйте позже.');
    } finally {
      setIsPlayerLoading(false);
    }
  }, [details]);

  const closePlayer = () => {
    setShowPlayer(false);
    setEmbedUrl(null);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
  };

  const shareContent = () => {
    if (navigator.share && details) {
      const title = 'title' in details ? details.title : details.name;
      navigator.share({
        title: title,
        text: details.overview,
        url: window.location.href,
      });
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-neutral-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center">
        <div className="flex flex-col items-center text-center max-w-md px-4">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <p className="text-red-400 mb-4">{error || 'Контент не найден'}</p>
          <button
            onClick={() => navigate('/search')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Вернуться к поиску
          </button>
        </div>
      </div>
    );
  }

  const isMovie = 'title' in details;
  const title = isMovie ? (details as TMDBMovieDetails).title : (details as TMDBTVShowDetails).name;
  const originalTitle = isMovie 
    ? (details as TMDBMovieDetails).original_title 
    : (details as TMDBTVShowDetails).original_name;
  const releaseDate = isMovie 
    ? (details as TMDBMovieDetails).release_date 
    : (details as TMDBTVShowDetails).first_air_date;
  const runtime = isMovie 
    ? (details as TMDBMovieDetails).runtime 
    : (details as TMDBTVShowDetails).episode_run_time?.[0];
  const seasons = isMovie ? undefined : (details as TMDBTVShowDetails).number_of_seasons;
  const episodes = isMovie ? undefined : (details as TMDBTVShowDetails).number_of_episodes;

  return (
    <div className="min-h-screen bg-black text-neutral-100 font-sans">
      {/* Backdrop */}
      <div className="relative h-[50vh] overflow-hidden">
        {details.backdrop_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w1280${details.backdrop_path}`}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-xl hover:bg-black/70 transition-colors z-10"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Назад</span>
        </button>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 -mt-32 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            <div className="w-64 md:w-80 rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/20">
              {details.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${details.poster_path}`}
                  alt={title}
                  className="w-full aspect-[2/3] object-cover"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-neutral-900 flex items-center justify-center">
                  <Film className="w-16 h-16 text-neutral-700" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-3xl md:text-5xl font-bold mb-2">{title}</h1>
              {originalTitle !== title && (
                <p className="text-xl text-neutral-400 mb-4">{originalTitle}</p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2 bg-blue-600/20 px-3 py-1.5 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">{details.vote_average.toFixed(1)}</span>
                </div>
                
                {releaseDate && (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Calendar className="w-5 h-5" />
                    <span>{new Date(releaseDate).getFullYear()}</span>
                  </div>
                )}

                {runtime && (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Clock className="w-5 h-5" />
                    <span>{runtime} мин.</span>
                  </div>
                )}

                {seasons && (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Tv className="w-5 h-5" />
                    <span>{seasons} сезон{seasons > 1 ? 'а' : ''}, {episodes} эп.</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-neutral-400">
                  <Film className="w-5 h-5" />
                  <span className="capitalize">
                    {type === 'anime' ? 'Аниме' : isMovie ? 'Фильм' : 'Сериал'}
                  </span>
                </div>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-6">
                {details.genres.map((genre: TMDBGenre) => (
                  <span
                    key={genre.id}
                    className="px-3 py-1 bg-neutral-800 rounded-full text-sm text-neutral-300"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              {/* Description */}
              <p className="text-lg text-neutral-300 leading-relaxed mb-8">
                {details.overview || 'Описание отсутствует'}
              </p>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl">
                  <p className="text-red-300">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handlePlay}
                  disabled={isPlayerLoading}
                  className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                >
                  {isPlayerLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Play className="w-6 h-6 fill-current" />
                      Смотреть
                    </>
                  )}
                </button>

                <button
                  onClick={toggleFavorite}
                  className={`flex items-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all ${
                    isFavorite
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  }`}
                >
                  <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
                  {isFavorite ? 'В избранном' : 'В избранное'}
                </button>

                <button
                  onClick={shareContent}
                  className="flex items-center gap-3 px-6 py-4 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-semibold transition-all text-neutral-300"
                >
                  <Share2 className="w-6 h-6" />
                  Поделиться
                </button>
              </div>

              {/* Additional Info */}
              {details.tagline && (
                <div className="mt-8 p-4 bg-neutral-900/50 rounded-xl border border-neutral-800">
                  <p className="text-neutral-400 italic text-center">"{details.tagline}"</p>
                </div>
              )}

              <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-neutral-900/50 rounded-xl">
                  <p className="text-neutral-500 mb-1">Статус</p>
                  <p className="font-semibold">{details.status}</p>
                </div>
                <div className="p-4 bg-neutral-900/50 rounded-xl">
                  <p className="text-neutral-500 mb-1">Оригинальный язык</p>
                  <p className="font-semibold capitalize">{details.original_language}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Player Modal */}
      <AnimatePresence>
        {showPlayer && embedUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-6xl aspect-video bg-neutral-900 rounded-2xl overflow-hidden">
              {/* Close Button */}
              <button
                onClick={closePlayer}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 backdrop-blur-md rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {/* Player Info */}
              <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl">
                <p className="text-white font-medium">{title}</p>
              </div>

              {/* Loading */}
              {isPlayerLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                </div>
              )}

              {/* Embed */}
              {!isPlayerLoading && (
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                  title="Alloha Player"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
