import React, { forwardRef } from 'react';
import { Play, Star, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export interface AnimeCardProps {
  id: string;
  title: string;
  russianTitle?: string;
  imageUrl: string;
  rating: string;
  year: number;
  episodes?: string;
  genres: string[];
  isActive: boolean;
  isFavorite?: boolean;
  onMouseEnter?: () => void;
  onClick?: () => void;
}

export const AnimeCard = forwardRef<HTMLDivElement, AnimeCardProps>(
  (
    {
      title,
      russianTitle,
      imageUrl,
      rating,
      year,
      episodes,
      genres,
      isActive,
      isFavorite = false,
      onMouseEnter,
      onClick,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className="relative cursor-pointer select-none focus:outline-none"
        onMouseEnter={onMouseEnter}
        onClick={onClick}
      >
        {/* Анимационный контейнер карточки */}
        <motion.div
           animate={{
             scale: isActive ? 1.08 : 1.0,
             y: isActive ? -8 : 0,
           }}
           transition={{ type: 'spring', stiffness: 350, damping: 25 }}
           className={`relative aspect-[16/10] sm:aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900 transition-all duration-300 shadow-lg ${
             isActive
               ? 'ring-4 ring-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.45)] border-transparent z-10'
               : 'ring-1 ring-neutral-800/80 hover:ring-2 hover:ring-neutral-700/80'
           }`}
        >
          {/* Постер тайтла с плавным зумом при фокусе */}
          <div className="absolute inset-0 w-full h-full overflow-hidden bg-neutral-900">
            <motion.img
              src={imageUrl}
              alt={title}
              referrerPolicy="no-referrer"
              animate={{
                scale: isActive ? 1.12 : 1.0,
              }}
              className="w-full h-full object-cover opacity-85 transition-opacity duration-300"
            />
          </div>

          {/* Затемнение/Градиенты для контраста текста */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
          
          {/* Верхняя панель бейджей */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            {/* Рейтинг Кинопоиск/Shikimori */}
            <div className="flex items-center gap-1 bg-black/75 backdrop-blur-md px-2 py-1 rounded-md border border-neutral-800 text-amber-400 font-mono text-[10px] sm:text-xs">
              <Star size={11} className="fill-amber-400 stroke-amber-400" />
              <span>{rating}</span>
            </div>

            {/* Метка "Без рекламы" (Ad-free) или Любимое */}
            {isFavorite ? (
              <div className="bg-blue-500 text-white rounded-md p-1 backdrop-blur-md">
                <Sparkles size={11} className="fill-white" />
              </div>
            ) : (
              <div className="bg-emerald-500/85 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase">
                no-ads
              </div>
            )}
          </div>

          {/* Индикатор воспроизведения при наведении пульта */}
          {isActive && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-blue-500 text-white p-3.5 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.6)]"
              >
                <Play size={20} className="fill-white ml-0.5" />
              </motion.div>
            </div>
          )}

          {/* Нижний блок информации */}
          <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 flex flex-col gap-1 pointer-events-none">
            {/* Жанры */}
            <div className="flex flex-wrap gap-1">
              {genres.slice(0, 2).map((genre, idx) => (
                <span
                  key={idx}
                  className="text-[9px] sm:text-[10px] font-medium text-neutral-400 bg-neutral-900/60 px-1.5 py-0.5 rounded"
                >
                  {genre}
                </span>
              ))}
              <span className="text-[9px] sm:text-[10px] font-medium text-neutral-400 bg-neutral-900/60 px-1.5 py-0.5 rounded">
                {year}
              </span>
            </div>

            {/* Названия */}
            <div className="mt-1">
              <h3 className="text-white text-xs sm:text-sm font-semibold tracking-tight leading-tight truncate">
                {russianTitle || title}
              </h3>
              {russianTitle && (
                <p className="text-[10px] sm:text-xs text-neutral-400 font-medium truncate">
                  {title}
                </p>
              )}
            </div>

            {/* Эпизоды / Формат */}
            {episodes && (
              <div className="text-[9px] sm:text-[10px] text-blue-400 font-mono mt-0.5 font-bold">
                {episodes}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }
);

AnimeCard.displayName = 'AnimeCard';
export default AnimeCard;
