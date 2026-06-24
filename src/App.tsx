import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Tv,
  Heart,
  History as HistoryIcon,
  User,
  Play,
  Pause,
  LogOut,
  Volume2,
  Clock,
  ArrowLeft,
  AlertCircle,
  Check,
  Gamepad2,
  Sparkles,
  Search,
  MonitorPlay,
  RotateCcw,
  SkipForward,
  BookmarkCheck,
  Plus,
  Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Инициализация Firebase
import {
  db,
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// Пространственная навигация и моковые данные аниме
import { useTVNavigation, TVZone } from './hooks/useTVNavigation';
import { Anime, ANIMES_MOCK_DATA } from './mockData';
import { AnimeCard } from './components/AnimeCard';
import { checkBackendHealth, fetchCatalog, fetchEmbedUrl, fetchTranslationOptions, KodikTranslationOption, fetchEpisodes } from './api/kodik';

function isMultiEpisode(anime: Anime): boolean {
  return anime.type === 'series' || (anime.episodesTotal != null && anime.episodesTotal > 1);
}

function resolveKodikPlayParams(anime: Anime): { idType: string; idValue: string } {
  const idType = anime.idType || (anime.kinopoiskId ? 'kinopoisk' : anime.shikimoriId ? 'shikimori' : anime.imdbId ? 'imdb' : 'kodik');
  const idValue = idType === 'kinopoisk'
    ? String(anime.kinopoiskId || '')
    : idType === 'shikimori'
    ? String(anime.shikimoriId || '')
    : idType === 'imdb'
    ? String(anime.imdbId || '')
    : String(anime.kodikId || anime.id);
  return { idType, idValue };
}

// Модель настроек пользователя
interface UserProfileData {
  favorites: string[]; // Список ID избранных аниме
  history: Array<{
    animeId: string;
    watchedAt: string;
    progressPercent: number;
    currentTime: number;
    duration: number;
    title: string;
    russianTitleString: string;
    imageUrl: string;
  }>;
}

export default function App() {
  // Список аниме (эмуляция Shikimori API)
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [featuredAnime, setFeaturedAnime] = useState<Anime | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Состояние авторизации
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<UserProfileData>({ favorites: [], history: [] });

  // Ввод для кастомной авторизации в Smart TV UI
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Синематик плеер
  const [activeVideo, setActiveVideo] = useState<Anime | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Anime | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(1);
  const [isPlayerLoading, setIsPlayerLoading] = useState<boolean>(false);
  const [isHudVisible, setIsHudVisible] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [selectedQuality, setSelectedQuality] = useState<number>(720);
  const [selectedTranslationId, setSelectedTranslationId] = useState<string>('0');
  const [translationOptions, setTranslationOptions] = useState<KodikTranslationOption[]>([]);
  const [translationsLoading, setTranslationsLoading] = useState<boolean>(false);
  const [translationsError, setTranslationsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const qualityOptions = [360, 480, 720, 1080];
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Текущий активный индекс бокового меню (Вкладка)
  const [currentTab, setCurrentTab] = useState<number>(0);

  // Всплывающие уведомления (Toast)
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Вкладки Sidebar меню:
  // 0 - Аниме
  // 1 - Фильмы
  // 2 - Сериалы
  // 3 - Избранное (Мой Список)
  // 4 - История просмотров
  // 5 - Личный кабинет / Настройки
  const sidebarItems = [
    { label: 'Аниме', icon: Tv, id: 'anime' },
    { label: 'Фильмы', icon: Film, id: 'movie' },
    { label: 'Сериалы', icon: MonitorPlay, id: 'series' },
    { label: 'Избранное', icon: Heart, id: 'favorites' },
    { label: 'История', icon: HistoryIcon, id: 'history' },
    { label: 'Аккаунт', icon: User, id: 'account' },
  ];

  // Динамические параметры сетки
  const gridCols = 4; // 4 колонки в сеткe каталога
  const activeSidebarIndex = 5; // Индекс зоны аккаунта

  // Вспомогательная функция показа оповещения на экране ТВ (Toast)
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  // Синхронизация локальных данных с Firestore при изменении бэкапа
  const syncWithCloudAndLocal = useCallback(async (userId: string, updatedData: UserProfileData) => {
    setUserData(updatedData);
    if (!userId) {
      localStorage.setItem('anime_tv_profile', JSON.stringify(updatedData));
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, updatedData, { merge: true });
    } catch (err) {
      console.warn('Ошибка сохранения в Firestore, пишем в LocalStorage:', err);
      localStorage.setItem('anime_tv_profile', JSON.stringify(updatedData));
    }
  }, []);

  // --- ФУНКЦИОНАЛ ИЗБРАННОГО ---
  const toggleFavorite = useCallback((animeId: string) => {
    const isFav = userData.favorites.includes(animeId);
    let updatedFavs: string[];

    if (isFav) {
      updatedFavs = userData.favorites.filter((id) => id !== animeId);
      showToast('Удалено из избранного');
    } else {
      updatedFavs = [...userData.favorites, animeId];
      showToast('Добавлено в Мой Список');
    }

    const updatedData = { ...userData, favorites: updatedFavs };
    syncWithCloudAndLocal(user ? user.uid : '', updatedData);
  }, [userData, user, syncWithCloudAndLocal, showToast]);

  // --- СОХРАНЕНИЕ ПРОГРЕССА В ИСТОРИЮ ---
  const saveProgressToHistory = useCallback((anime: Anime, current: number, total: number) => {
    if (!anime) return;
    const percent = Math.min(Math.round((current / total) * 100), 100);
    
    // Создаем запись истории
    const newEntry = {
      animeId: anime.id,
      watchedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('ru-RU'),
      progressPercent: percent,
      currentTime: Math.round(current),
      duration: Math.round(total),
      title: anime.title,
      russianTitleString: anime.russianTitle,
      imageUrl: anime.imageUrl,
    };

    // Фильтруем прошлые просмотры этого же тайтла, чтобы поднять его наверх списка
    const filteredHistory = userData.history.filter((h) => h.animeId !== anime.id);
    const updatedHistory = [newEntry, ...filteredHistory].slice(0, 20); // храним до 20 записей

    const updatedData = { ...userData, history: updatedHistory };
    syncWithCloudAndLocal(user ? user.uid : '', updatedData);
  }, [userData, user, syncWithCloudAndLocal]);

  const mapKodikItemToAnime = useCallback((item: any): Anime => {
    // Если это уже нормализованный ответ сервера /list, используем его напрямую.
    if (item && item.imageUrl && item.title && item.idType) {
      return {
        id: String(item.id || item.kodikId || item.kinopoiskId || item.shikimoriId || item.imdbId || item.title),
        kodikId: item.kodikId,
        idType: item.idType,
        title: item.title,
        russianTitle: item.russianTitle || item.title,
        imageUrl: item.imageUrl || item.bannerUrl || '',
        bannerUrl: item.bannerUrl || item.imageUrl || '',
        rating: String(item.rating || ''),
        year: Number(item.year || 0) || 0,
        episodes: item.episodes || 'Фильм',
        episodesTotal: Number(item.episodesTotal || item.episodes_total || item.episodes_aired || 0) || undefined,
        genres: Array.isArray(item.genres) ? item.genres : [],
        description: item.description || '',
        studio: item.studio || 'Kodik',
        duration: item.duration || '',
        videoUrl: item.videoUrl || '',
        type: item.type || 'anime',
        kinopoiskId: item.kinopoiskId || item.kinopoisk_id,
        shikimoriId: item.shikimoriId || item.shikimori_id,
        imdbId: item.imdbId || item.imdb_id,
        translationId: item.translationId || item.translation?.id || undefined,
        seriaNum: Number(item.seriaNum || item.seria_num || 0) || 0,
      };
    }

    const material = item.material_data || {};
    let poster = material.poster_url || (item.screenshots?.[0] ?? '') || item.imageUrl || '';
    if (typeof poster === 'string' && poster.startsWith('//')) {
      poster = 'https:' + poster;
    }
    const bannerUrl = material.anime_poster_url || poster || item.bannerUrl || '';
    const title = material.title_en || item.title_orig || item.title || item.other_title || item.title || '';
    const russianTitle = material.title || item.title || item.other_title || title || '';
    const kodikType = item.type || '';
    const type = ['anime', 'anime-serial'].includes(kodikType)
      ? 'anime'
      : ['foreign-movie', 'russian-movie', 'multi-part-film'].includes(kodikType)
      ? 'movie'
      : ['foreign-serial', 'russian-serial', 'cartoon-serial', 'documentary-serial'].includes(kodikType)
      ? 'series'
      : kodikType.includes('serial')
      ? 'series'
      : kodikType.includes('movie')
      ? 'movie'
      : 'anime';

    const idType = item.idType || (item.id ? 'kodik' : item.kinopoisk_id ? 'kinopoisk' : item.shikimori_id ? 'shikimori' : item.imdb_id ? 'imdb' : 'kodik');
    const rating = material.kinopoisk_rating || material.imdb_rating || material.shikimori_rating || item.rating || '';
    const year = item.year || material.year || 0;
    const durationValue = material.duration || item.duration;
    const duration = typeof durationValue === 'number'
      ? `${Math.round(durationValue)} мин.`
      : typeof durationValue === 'string'
      ? durationValue
      : '';

    let genres = material.all_genres || material.genres || item.genres || [];
    if (typeof genres === 'string') genres = [genres];
    if (!Array.isArray(genres)) genres = [];

    const studioData = material.anime_studios || material.studios || material.producers || item.studio || '';
    const studio = Array.isArray(studioData) ? studioData.slice(0, 2).join(', ') : studioData || 'Kodik';
    const episodes = type === 'movie'
      ? 'Фильм'
      : material.episodes_aired
      ? `${material.episodes_aired} эп.`
      : material.episodes_total
      ? `${material.episodes_total} эп.`
      : item.episodes || '1 эп.';

    return {
      id: item.id || String(item.kinopoisk_id || item.shikimori_id || item.imdb_id || title || russianTitle || 'kodik-item'),
      kodikId: item.id || item.kodikId,
      idType,
      title,
      russianTitle,
      imageUrl: poster || '',
      bannerUrl,
      rating: String(rating || ''),
      year: Number(year) || 0,
      episodes,
      episodesTotal: Number(item.episodesTotal || material.episodes_total || material.episodes_aired || item.episodes_total || item.episodes_aired || item.episodes || 0) || undefined,
      genres,
      description: material.description || material.anime_description || item.description || '',
      studio,
      duration,
      videoUrl: item.videoUrl || '',
      type,
      kinopoiskId: item.kinopoisk_id || item.kinopoiskId,
      shikimoriId: item.shikimori_id || item.shikimoriId,
      imdbId: item.imdb_id || item.imdbId,
      translationId: item.translation?.id ? String(item.translation.id) : item.translationId || undefined,
      seriaNum: Number(item.seriaNum || item.seria_num || 0) || 0,
    };
  }, []);

  // --- ОТКРЫТИЕ ПЛЕЕРА ---
  const openMaterialDetail = useCallback((anime: Anime) => {
    setSelectedMaterial(anime);
    setSelectedEpisode(isMultiEpisode(anime) ? 1 : 0);
  }, []);

  const closeMaterialDetail = useCallback(() => {
    setSelectedMaterial(null);
    setSelectedEpisode(0);
    if (tvNavRef.current) {
      tvNavRef.current.setActiveZone('grid');
    }
  }, []);

  useEffect(() => {
    const loadTranslationOptions = async () => {
      if (!selectedMaterial) {
        setTranslationOptions([]);
        setTranslationsError(null);
        return;
      }

      const { idType, idValue } = resolveKodikPlayParams(selectedMaterial);
      if (!idValue) {
        setTranslationOptions([]);
        setTranslationsError('Не найден ID для получения списка переводов.');
        return;
      }

      setTranslationsLoading(true);
      setTranslationsError(null);
      try {
        const options = await fetchTranslationOptions({ id: idValue, idType });
        setTranslationOptions(options);
      } catch (err) {
        console.warn('Не удалось получить список озвучек Kodik:', err);
        setTranslationOptions([]);
        setTranslationsError('Не удалось загрузить список переводов.');
      } finally {
        setTranslationsLoading(false);
      }
    };

    if (selectedMaterial) {
      setSelectedTranslationId(selectedMaterial.translationId || '0');
      setSelectedQuality(720);
      setPlaybackSpeed(1);
      loadTranslationOptions();
    } else {
      setTranslationOptions([]);
      setTranslationsError(null);
    }
  }, [selectedMaterial]);

  const playVideo = useCallback(async (
    anime: Anime,
    episode: number = 0,
    translationId: string | undefined = undefined,
    quality: number = 720,
  ) => {
    const multiEpisode = isMultiEpisode(anime);
    const actualEpisode = multiEpisode ? Math.max(episode || 1, 1) : 0;
    const targetAnime = { ...anime, seriaNum: actualEpisode } as Anime;
    const { idType, idValue } = resolveKodikPlayParams(targetAnime);
    const chosenTranslation = translationId ?? targetAnime.translationId;

    if (!idValue) {
      showToast(`Не найден ID для ${targetAnime.russianTitle}. Попробуйте другой тайтл.`);
      return;
    }

    setIsPlayerLoading(true);
    try {
      const data = await fetchEmbedUrl({ id: idValue, idType });
      if (!data.embed_url) {
        throw new Error('Kodik не вернул embed URL');
      }
      const newAnime = { ...targetAnime, videoUrl: data.embed_url, translationId: chosenTranslation } as Anime;
      setActiveVideo(newAnime);
      setSelectedEpisode(actualEpisode);
      setIsPlaying(true);
      showToast(`Запуск: ${targetAnime.russianTitle}${actualEpisode > 0 ? ` — серия ${actualEpisode}` : ''}`);
    } catch (err) {
      console.warn('Не удалось получить embed Kodik:', err);
      showToast(`Не удалось запустить ${targetAnime.russianTitle}. Проверьте, что backend запущен.`);
    } finally {
      setIsPlayerLoading(false);
    }
  }, [showToast]);

  const updateActiveVideoStream = useCallback(async () => {
    if (!activeVideo) return;

    const { idType, idValue } = resolveKodikPlayParams(activeVideo);
    if (!idValue) {
      showToast('Не удалось обновить поток: отсутствует ID.');
      return;
    }

    setIsPlayerLoading(true);
    try {
      const data = await fetchEmbedUrl({ id: idValue, idType });
      if (!data.embed_url) {
        throw new Error('Kodik не вернул embed URL');
      }
      const newAnime = { ...activeVideo, videoUrl: data.embed_url, translationId: selectedTranslationId } as Anime;
      setActiveVideo(newAnime);
      showToast(`Поток обновлён`);
    } catch (err) {
      console.warn('Не удалось обновить embed Kodik:', err);
      showToast('Не удалось обновить поток. Проверьте соединение с backend.');
    } finally {
      setIsPlayerLoading(false);
    }
  }, [activeVideo, selectedTranslationId, showToast]);

  // Получение отфильтрованных тайтлов по выбранной вкладке (Общий ID/тип по сайту)
  const getFilteredAnimes = useCallback(() => {
    let results: Anime[] = [];
    if (currentTab === 0) {
      // Аниме
      results = animes.filter((a) => a.type === 'anime');
    } else if (currentTab === 1) {
      // Фильмы
      results = borderSafeFilter(animes, 'movie');
    } else if (currentTab === 2) {
      // Сериалы
      results = borderSafeFilter(animes, 'series');
    } else if (currentTab === 3) {
      // Избранное
      results = animes.filter((a) => userData.favorites.includes(a.id));
    } else if (currentTab === 4) {
      // История просмотра
      const historyIds = userData.history.map((h) => h.animeId);
      results = animes
        .filter((a) => historyIds.includes(a.id))
        .sort((a, b) => historyIds.indexOf(a.id) - historyIds.indexOf(b.id));
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return results;
    }

    return results.filter((anime) => {
      const searchable = [anime.russianTitle, anime.title, anime.id, ...(anime.genres || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [currentTab, animes, userData, searchQuery]);

  // Вспомогательная функция для безопасного фильтра по типу
  function borderSafeFilter(list: Anime[], type: 'anime' | 'movie' | 'series') {
    return list.filter((a) => a.type === type);
  }

  const filteredMovies = getFilteredAnimes();

  const showDetailPage = !!selectedMaterial;

  const episodeButtons = useMemo(() => {
    if (!selectedMaterial || !isMultiEpisode(selectedMaterial) || !selectedMaterial.episodesTotal) {
      return [] as number[];
    }
    const total = Math.min(selectedMaterial.episodesTotal, 24);
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [selectedMaterial]);

  const selectedMaterialVariant = useMemo(() => {
    if (!selectedMaterial) return null;
    return { ...selectedMaterial, seriaNum: selectedEpisode } as Anime;
  }, [selectedMaterial, selectedEpisode]);

  // Реф на ТВ навигацию для безопасного разрешения кольцевой зависимости
  const tvNavRef = useRef<any>(null);

  // Кастомный хук ТВ-навигации
  const currentZoneItemsCount = 
    activeVideo ? 1 : // Если плеер запущен, навигация переходит на органы управления плеером
    filteredMovies.length;

  const handleTVSelect = useCallback((zone: TVZone, index: number) => {
    // Пользователь нажал кнопку Выбрать (Enter/ОК) на пульте ТВ
    if (zone === 'sidebar') {
      // Клик по вкладке сайдбара переключает экраны автоматически
    } else if (zone === 'banner') {
      const bannerItem = filteredMovies[0];
      if (bannerItem) {
        if (index === 0) {
          playVideo(bannerItem);
        } else if (index === 1) {
          toggleFavorite(bannerItem.id);
        }
      }
    } else if (zone === 'grid') {
      // Клик на карточку аниме / фильма / сериала
      const gridItem = filteredMovies[index];
      if (gridItem) {
        openMaterialDetail(gridItem);
      }
    }
  }, [filteredMovies, openMaterialDetail, playVideo, toggleFavorite]);

  const handleTVBack = useCallback(() => {
    if (activeVideo) {
      setActiveVideo(null);
      setIsPlaying(false);
      showToast('Видео остановлено');
    } else if (tvNavRef.current && tvNavRef.current.activeZone !== 'sidebar') {
      // Иначе переводим фокус на боковой сайдбар
      tvNavRef.current.setActiveZone('sidebar');
    }
  }, [activeVideo, showToast]);

  // Подключение хука управления с пульта
  const tvNav = useTVNavigation({
    gridCols: gridCols,
    // Вычисляем количество элементов для каждого экрана
    gridTotalItems: currentZoneItemsCount,
    sidebarTotalItems: sidebarItems.length,
    bannerTotalItems: (currentTab === 0 || currentTab === 1 || currentTab === 2) && filteredMovies.length > 0 ? 2 : 0, // У баннера 2 кнопки (Смотреть, Избранное)
    onEnterPress: handleTVSelect,
    onBackPress: handleTVBack,
  });

  tvNavRef.current = tvNav;

  // Синхронизация текущей активной вкладки
  useEffect(() => {
    if (tvNav?.activeIndexes?.sidebar !== undefined) {
      setCurrentTab(tvNav.activeIndexes.sidebar);
    }
  }, [tvNav?.activeIndexes?.sidebar]);

  // Эмуляция первоначальной загрузки списка тайтлов (имитация Shikimori/AniList API)
  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const backendOk = await checkBackendHealth();
      if (!backendOk) {
        throw new Error('Backend Kodik не запущен. Запустите run_dev.bat или python -m uvicorn server.app:app --port 8001');
      }
      const rawResults = await fetchCatalog('all', 30);
      const results = rawResults.map(mapKodikItemToAnime);
      if (results.length === 0) {
        throw new Error('Kodik вернул пустой каталог.');
      }
      setAnimes(results);
      setFeaturedAnime(results[0] || null);

      const animeCount = results.filter((item) => item.type === 'anime').length;
      const movieCount = results.filter((item) => item.type === 'movie').length;
      const seriesCount = results.filter((item) => item.type === 'series').length;
      if (animeCount === 0) {
        if (movieCount > 0) {
          setCurrentTab(1);
        } else if (seriesCount > 0) {
          setCurrentTab(2);
        }
      }
    } catch (err) {
      console.warn(err);
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка загрузки каталога';
      setFetchError(message);
      setAnimes(ANIMES_MOCK_DATA);
      setFeaturedAnime(ANIMES_MOCK_DATA[0] || null);
      showToast('Kodik недоступен — показаны демо-данные.');
    } finally {
      setIsLoading(false);
    }
  }, [mapKodikItemToAnime, showToast]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Локальная инициализация базы из LocalStorage при запуске
  useEffect(() => {
    const local = localStorage.getItem('anime_tv_profile');
    if (local) {
      try {
        setUserData(JSON.parse(local));
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  // Слушатель состояния авторизации Firebase Auth
  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            setUserData(snap.data() as UserProfileData);
          } else {
            // Если профиля в облаке нет, заливаем локальный
            const local = localStorage.getItem('anime_tv_profile');
            const dataToUpload = local ? JSON.parse(local) : { favorites: [], history: [] };
            await setDoc(userRef, dataToUpload);
            setUserData(dataToUpload);
          }
          showToast(`Вошли как ${currentUser.email}`);
        } catch (err) {
          console.warn('Firestore не настроен или ошибка чтения:', err);
        }
      } else {
        // Возвращаем данные из локалсторж
        const local = localStorage.getItem('anime_tv_profile');
        if (local) {
          setUserData(JSON.parse(local));
        }
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, [showToast]);

  // Обработчик автоскрытия HUD плеера
  const startHudTimeout = useCallback(() => {
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    setIsHudVisible(true);
    hudTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsHudVisible(false);
      }
    }, 4000);
  }, [isPlaying]);

  // Форматирование времени воспроизведения (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- ФОРМЫ АВТОРИЗАЦИИ (FIREBASE TV) ---
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setAuthError('Заполните все поля ввода!');
      return;
    }
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setAuthSuccessMsg('Вы успешно вошли на Вашем Google TV!');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка входа. Проверьте реквизиты.');
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setAuthError('Заполните поля!');
      return;
    }
    if (password.length < 6) {
      setAuthError('Пароль должен быть не менее 6 знаков!');
      return;
    }
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setAuthSuccessMsg('Аккаунт Google TV успешно создан!');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка регистрации.');
    }
  };

  // Быстрый демо-вход в 1 клик для удобства тестирования на Smart TV
  const handleDemoSignIn = async () => {
    setAuthError(null);
    setAuthSuccessMsg(null);
    // Генерируем случайного гостя или входим в фиксированный тестовый аккаунт
    const demoEmail = 'googletv_tester@demo.cc';
    const demoPassword = 'tester_googletv';
    try {
      await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      setAuthSuccessMsg('Вы вошли в Тестовый профиль Google TV!');
    } catch (err) {
      // Если аккаунт еще не создан, регистрируем его налету
      try {
        await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
        setAuthSuccessMsg('Создан новый Тестовый профиль!');
      } catch (regErr: any) {
        setAuthError('Не удалось войти в демо: ' + regErr.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserData({ favorites: [], history: [] });
      showToast('Успешный выход из аккаунта');
    } catch (err: any) {
      showToast('Ошибка при выходе');
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 font-sans overflow-x-hidden selection:bg-blue-500 selection:text-white">
      
      {/* 1. БОКОВОЕ МЕНЮ GOOGLE TV (SIDEBAR) */}
      <nav
        className={`fixed top-0 left-0 bottom-0 z-40 flex flex-col justify-between py-8 px-4 border-r border-neutral-900 transition-all duration-300 ease-out md:block hidden ${
          tvNav.activeZone === 'sidebar'
            ? 'w-64 bg-neutral-950/98 shadow-2xl shadow-blue-950/10'
            : 'w-20 bg-neutral-950/45 backdrop-blur-md'
        }`}
      >
        {/* Креативный аниме-логотип */}
        <div className="flex items-center gap-3 px-2 mb-10 overflow-hidden">
          <div className="min-w-10 h-10 rounded-lg bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Tv size={22} className="stroke-white" />
          </div>
          <span
            className={`font-bold text-lg tracking-wider bg-gradient-to-r from-white via-neutral-100 to-blue-400 bg-clip-text text-transparent duration-300 transition-opacity ${
              tvNav.activeZone === 'sidebar' ? 'opacity-100' : 'opacity-0 w-0'
            }`}
          >
            ANIME<span className="text-blue-500">TV</span>
          </span>
        </div>

        {/* Пункты меню (Сайдбар) */}
        <div className="flex flex-col gap-3">
          {sidebarItems.map((item, index) => {
            const IconComponent = item.icon;
            const isSelected = currentTab === index;
            const isFocused = tvNav.activeZone === 'sidebar' && isSelected;

            return (
              <button
                key={index}
                ref={(el) => tvNav.registerRef('sidebar', index, el)}
                onClick={() => {
                  tvNav.setActiveItem('sidebar', index);
                  tvNav.setActiveZone('grid');
                }}
                onMouseEnter={() => tvNav.setActiveItem('sidebar', index)}
                className={`w-full flex items-center gap-4 py-3.5 px-3.5 rounded-xl transition-all duration-300 pointer-events-auto text-left outline-none ${
                  isFocused
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-102 font-semibold'
                    : isSelected
                    ? 'bg-neutral-900 text-blue-400 font-semibold border-l-4 border-blue-500'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50'
                }`}
              >
                <IconComponent size={20} className={isFocused ? 'stroke-white' : ''} />
                <span
                  className={`text-sm tracking-wide duration-300 transition-opacity truncate ${
                    tvNav.activeZone === 'sidebar' ? 'opacity-100' : 'opacity-0 w-0'
                  }`}
                >
                  {item.label}
                </span>
                {item.label === 'Избранное' && userData.favorites.length > 0 && tvNav.activeZone === 'sidebar' && (
                  <span className="ml-auto bg-neutral-800 text-neutral-300 text-xs px-2 py-0.5 rounded-full font-mono">
                    {userData.favorites.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Низ сайдбара - статус аккаунта */}
        <div className="px-2 mt-auto">
          {tvNav.activeZone === 'sidebar' ? (
            <div className="bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/80">
              <p className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mb-0.5">Google TV Stream</p>
              <p className="text-xs text-neutral-300 font-medium truncate">
                {user ? user.email : 'Гостевой Профиль'}
              </p>
              {user && (
                <button
                  onClick={handleLogout}
                  className="mt-2.5 w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-1.5 px-2 rounded text-[10px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5"
                >
                  <LogOut size={11} /> Выйти
                </button>
              )}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-blue-500 mx-auto">
              <User size={16} />
            </div>
          )}
        </div>
      </nav>

      {/* МОБИЛЬНЫЙ / КОМПАКТНЫЙ NAV HEADER */}
      <header className="md:hidden flex items-center justify-between p-4 bg-neutral-950 border-b border-neutral-900 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Tv size={16} />
          </div>
          <span className="font-bold text-base tracking-wide text-white">
            ANIME<span className="text-blue-500">TV</span>
          </span>
        </div>
        <div className="flex gap-1.5">
          {sidebarItems.map((item, index) => {
            const Icon = item.icon;
            const isSelected = currentTab === index;
            return (
              <button
                key={index}
                onClick={() => {
                  tvNav.setActiveItem('sidebar', index);
                  tvNav.setActiveZone('grid');
                }}
                className={`p-2 rounded-lg transition-colors ${
                  isSelected ? 'bg-blue-500 text-white' : 'text-neutral-400 hover:bg-neutral-900'
                }`}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </header>

      {/* 2. ОСНОВНОЙ КОНТЕНТ (GRID / DETAIL VIEW) */}
      <main className="md:pl-24 lg:pl-28 min-h-screen pb-16 flex flex-col transition-all duration-300">
        {isLoading ? (
          // Экран скелетон-загрузки (Shikimori API Loading Simulation)
          <div className="flex-1 flex flex-col justify-center items-center py-24 px-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
              className="text-blue-500 mb-6"
            >
              <Tv size={48} className="animate-pulse" />
            </motion.div>
            <h2 className="text-lg font-medium text-neutral-300 animate-pulse font-mono uppercase tracking-widest">
              Загрузка каталога Kodik...
            </h2>
            <p className="text-xs text-neutral-500 mt-2 font-mono">Фильмы, сериалы и аниме через Kodik API</p>
          </div>
        ) : (
          <div className="flex-1 px-4 sm:px-6 md:px-8 pt-6 sm:pt-10 flex flex-col">
            {fetchError && (
              <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-sm font-semibold text-amber-100">Каталог Kodik недоступен</p>
                    <p className="text-xs text-amber-200/80 mt-1">{fetchError}</p>
                  </div>
                </div>
                <button
                  onClick={loadCatalog}
                  className="shrink-0 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 transition"
                >
                  Повторить
                </button>
              </div>
            )}
            
            {/* ЭКРАН 0, 1, 2: ДИНАМИЧЕСКИЕ КАТЕГОРИИ (ОБЩИЕ КАТАЛОГИ С БАННЕРОМ И СЕТКОЙ) */}
            {(currentTab === 0 || currentTab === 1 || currentTab === 2) && (
              <div className="flex flex-col gap-6 sm:gap-10">
                {showDetailPage ? (
                  <section className="w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800/80 shadow-2xl p-6 sm:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row">
                      <div className="w-full lg:w-2/5 rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-inner">
                        <img
                          src={selectedMaterial?.bannerUrl || selectedMaterial?.imageUrl}
                          alt={selectedMaterial?.russianTitle}
                          className="w-full h-96 object-cover"
                        />
                        <div className="p-6 space-y-4">
                          <h2 className="text-2xl font-extrabold text-white">{selectedMaterial?.russianTitle}</h2>
                          <p className="text-sm text-neutral-400">{selectedMaterial?.title}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 text-blue-200 px-3 py-1 text-[11px] uppercase tracking-[0.2em] font-bold">
                              {selectedMaterial?.type}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 text-neutral-300 px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                              {selectedMaterial?.year}
                            </span>
                            {selectedMaterial?.duration && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 text-neutral-300 px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                                {selectedMaterial?.duration}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-4">
                            <button
                              onClick={() => selectedMaterial && playVideo(selectedMaterial, selectedEpisode, selectedTranslationId, selectedQuality)}
                              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 transition"
                            >
                              Смотреть{isMultiEpisode(selectedMaterial!) && selectedEpisode > 0 ? ` ${selectedEpisode} серию` : ''}
                            </button>
                            <button
                              onClick={() => selectedMaterial && toggleFavorite(selectedMaterial.id)}
                              className="w-full rounded-2xl border border-neutral-700 text-neutral-100 hover:bg-neutral-900 transition py-3"
                            >
                              {userData.favorites.includes(selectedMaterial?.id || '') ? 'Убрать из списка' : 'В избранное'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="w-full lg:w-3/5 flex flex-col gap-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-2">
                            <p className="text-neutral-400 uppercase tracking-widest text-[11px]">Описание</p>
                            <h3 className="text-xl font-bold text-white">О тайтле</h3>
                          </div>
                          <button
                            onClick={closeMaterialDetail}
                            className="text-sm uppercase tracking-[0.24em] text-neutral-400 hover:text-white"
                          >
                            Назад в каталог
                          </button>
                        </div>
                        <p className="text-neutral-300 leading-relaxed text-sm sm:text-base">{selectedMaterial?.description || 'Описание недоступно.'}</p>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-neutral-900 rounded-3xl p-4 border border-neutral-800">
                            <p className="text-xs text-neutral-400 uppercase tracking-[0.3em] mb-2">Жанры</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedMaterial?.genres.map((genre, idx) => (
                                <span key={idx} className="text-[11px] text-neutral-200 bg-neutral-800 rounded-full px-3 py-1">
                                  {genre}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="bg-neutral-900 rounded-3xl p-4 border border-neutral-800">
                            <p className="text-xs text-neutral-400 uppercase tracking-[0.3em] mb-2">Студия</p>
                            <p className="text-sm text-neutral-200">{selectedMaterial?.studio || 'Kodik'}</p>
                          </div>
                        </div>

                        {selectedMaterial && isMultiEpisode(selectedMaterial) && episodeButtons.length > 0 && (
                          <div className="bg-neutral-900 rounded-3xl p-4 border border-neutral-800">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-xs text-neutral-400 uppercase tracking-[0.3em]">Эпизоды</p>
                              <span className="text-[11px] text-neutral-500">{selectedMaterial.episodesTotal} всего</span>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                              {episodeButtons.map((episode) => (
                                <button
                                  key={episode}
                                  onClick={() => setSelectedEpisode(episode)}
                                  className={`rounded-2xl py-3 text-sm font-semibold transition ${
                                    episode === selectedEpisode ? 'bg-blue-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                                  }`}
                                >
                                  {episode}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-neutral-900 rounded-3xl p-4 border border-neutral-800">
                            <p className="text-xs text-neutral-400 uppercase tracking-[0.3em] mb-3">Параметры</p>
                            <div className="space-y-3 text-sm text-neutral-300">
                              <p><span className="text-neutral-500">ID:</span> {selectedMaterial?.id}</p>
                              <p><span className="text-neutral-500">Тип:</span> {selectedMaterial?.type}</p>
                              <p><span className="text-neutral-500">Источник:</span> {selectedMaterial?.idType}</p>
                              <p><span className="text-neutral-500">Перевод:</span> {!selectedTranslationId || selectedTranslationId === '0' ? 'По умолчанию' : selectedTranslationId}</p>
                            </div>
                          </div>
                          <div className="bg-neutral-900 rounded-3xl p-4 border border-neutral-800">
                            <p className="text-xs text-neutral-400 uppercase tracking-[0.3em] mb-3">Настройки плеера</p>
                            <div className="grid gap-3">
                              <label className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">Озвучка / перевод</label>
                              {translationsLoading ? (
                                <div className="rounded-2xl bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm text-neutral-300">
                                  Загружается список переводов...
                                </div>
                              ) : translationOptions.length > 0 ? (
                                <div className="grid gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTranslationId('0')}
                                    className={`text-left rounded-2xl px-4 py-3 text-sm font-semibold transition ${selectedTranslationId === '0' ? 'bg-blue-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                                  >
                                    Auto / По умолчанию
                                  </button>
                                  {translationOptions.map((option) => (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() => setSelectedTranslationId(option.id)}
                                      className={`text-left rounded-2xl px-4 py-3 text-sm font-semibold transition ${selectedTranslationId === option.id ? 'bg-blue-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                                    >
                                      {option.name} {option.type ? `(${option.type})` : ''}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <input
                                  value={selectedTranslationId}
                                  onChange={(e) => setSelectedTranslationId(e.target.value)}
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  placeholder="ID перевода / 0"
                                />
                              )}
                              <label className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">Качество</label>
                              <div className="grid grid-cols-4 gap-2">
                                {qualityOptions.map((quality) => (
                                  <button
                                    key={quality}
                                    onClick={() => setSelectedQuality(quality)}
                                    className={`rounded-2xl py-2 text-xs font-semibold transition ${
                                      quality === selectedQuality ? 'bg-blue-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                                    }`}
                                  >
                                    {quality}p
                                  </button>
                                ))}
                              </div>
                              <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-3 text-[12px] text-neutral-400">
                                {translationOptions.length > 0
                                  ? 'Выберите нужную озвучку или субтитры. Кнопка Auto вернёт стандартную версию.'
                                  : 'Если список переводов недоступен, введите ID перевода вручную или оставьте «0» для стандартной версии.'}
                              </div>
                              {translationsError ? (
                                <div className="rounded-2xl bg-rose-950 border border-rose-800 p-3 text-[12px] text-rose-300">
                                  {translationsError}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : filteredMovies.length > 0 ? (
                  <>
                    <section
                      ref={(el) => tvNav.registerRef('banner', 0, el)}
                      className="relative w-full rounded-2xl overflow-hidden aspect-[16/9] md:aspect-[21/9] bg-neutral-950 border border-neutral-800/80 shadow-2xl"
                    >
                      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${filteredMovies[0].bannerUrl})` }}>
                        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/30" />
                      </div>

                      <div className="absolute inset-y-0 left-0 w-full md:w-3/5 p-6 sm:p-10 md:p-12 flex flex-col justify-center gap-3 md:gap-4">
                        <div className="flex items-center gap-2.5">
                          <span className="bg-blue-600 text-white text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded uppercase flex items-center gap-1.5">
                            <Sparkles size={11} className="fill-white" /> ЭКСКЛЮЗИВ
                          </span>
                          <span className="text-xs font-semibold text-neutral-400 font-mono">
                            {filteredMovies[0].studio} • {filteredMovies[0].year}
                          </span>
                        </div>

                        <div>
                          <h1 className="text-white text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
                            {filteredMovies[0].russianTitle}
                          </h1>
                          <p className="text-xs sm:text-sm text-neutral-400 font-medium italic mt-1 font-mono">
                            {filteredMovies[0].title}
                          </p>
                        </div>

                        <p className="text-neutral-300 text-xs sm:text-sm leading-relaxed max-w-lg hidden sm:line-clamp-3">
                          {filteredMovies[0].description}
                        </p>

                        <div className="flex items-center gap-4 mt-2">
                          <button
                            ref={(el) => tvNav.registerRef('banner', 0, el)}
                            onClick={() => playVideo(filteredMovies[0])}
                            onMouseEnter={() => tvNav.setActiveItem('banner', 0)}
                            className={`flex items-center gap-2 py-2.5 sm:py-3.5 px-6 sm:px-8 rounded-xl font-bold tracking-wide text-xs sm:text-sm transition-all duration-300 outline-none ${
                              tvNav.activeZone === 'banner' && tvNav.activeIndexes.banner === 0
                                ? 'bg-blue-500 text-white scale-105 shadow-xl shadow-blue-600/40'
                                : 'bg-white text-black hover:bg-neutral-100'
                            }`}
                          >
                            <Play size={16} className="fill-current" />
                            <span>Смотреть</span>
                          </button>

                          <button
                            ref={(el) => tvNav.registerRef('banner', 1, el)}
                            onClick={() => toggleFavorite(filteredMovies[0].id)}
                            onMouseEnter={() => tvNav.setActiveItem('banner', 1)}
                            className={`flex items-center gap-2 py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl font-bold tracking-wide text-xs sm:text-sm transition-all duration-300 outline-none ${
                              tvNav.activeZone === 'banner' && tvNav.activeIndexes.banner === 1
                                ? 'bg-neutral-800 text-white scale-105 shadow-xl shadow-black/80 ring-2 ring-neutral-600'
                                : 'bg-neutral-900/80 backdrop-blur text-neutral-300 hover:text-white border border-neutral-800'
                            }`}
                          >
                            <Plus size={16} className={userData.favorites.includes(filteredMovies[0].id) ? 'stroke-blue-500' : ''} />
                            <span>
                              {userData.favorites.includes(filteredMovies[0].id) ? 'В Списке' : 'В Избранное'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <h2 className="text-lg md:text-xl font-bold text-white tracking-wide mb-2">
                            {currentTab === 0 ? 'Популярное Аниме' : currentTab === 1 ? 'Популярные Фильмы' : 'Популярные Сериалы'}
                          </h2>
                          <span className="text-xs text-blue-500 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Plus size={12} /> БЕЗ РЕКЛАМЫ (AD-FREE)
                          </span>
                        </div>
                        <div className="relative w-full sm:w-auto">
                          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                          <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-80 pl-11 pr-4 py-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder:text-neutral-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            placeholder="Поиск по названию, озвучке или жанру"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {filteredMovies.map((anime, index) => {
                          const isActive = tvNav.activeZone === 'grid' && tvNav.activeIndexes.grid === index;

                          return (
                            <AnimeCard
                              key={anime.id}
                              ref={(el) => tvNav.registerRef('grid', index, el)}
                              id={anime.id}
                              title={anime.title}
                              russianTitle={anime.russianTitle}
                              imageUrl={anime.imageUrl}
                              rating={anime.rating}
                              year={anime.year}
                              episodes={anime.episodes}
                              genres={anime.genres}
                              isActive={isActive}
                              isFavorite={userData.favorites.includes(anime.id)}
                              onMouseEnter={() => tvNav.setActiveItem('grid', index)}
                              onClick={() => openMaterialDetail(anime)}
                            />
                          );
                        })}
                      </div>
                    </section>
                  </>
                ) : (
                  <section>
                    <div className="text-center py-20">
                      <h3 className="text-xl font-semibold text-white">Каталог пуст</h3>
                      <p className="text-sm text-neutral-400 mt-2">Сейчас нет доступных тайтлов в этой категории.</p>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ЭКРАН 3: ИЗБРАННОЕ / МОЙ СПИСОК */}
            {currentTab === 3 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                    <Heart className="fill-blue-500 text-blue-500" size={24} />
                    <span>Мой Список Избранного</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1">Тайтлы, которые вы сохранили для быстрого просмотра без рекламы.</p>
                </div>

                {filteredMovies.length === 0 ? (
                  // Пустой экран Избранного
                  <div className="flex-1 flex flex-col justify-center items-center py-20 bg-neutral-950/20 rounded-2xl border border-dashed border-neutral-900 px-4">
                    <Heart className="text-neutral-700 stroke-[1.5] mb-4 animate-pulse" size={64} />
                    <h3 className="text-base font-semibold text-neutral-300">Список пока пуст</h3>
                    <p className="text-xs text-neutral-500 text-center mt-2 max-w-sm">
                      Вы можете пометить любое аниме в каталоге, находясь на плитке и выбрав меню добавления в Избранное.
                    </p>
                    <button
                      onClick={() => {
                        tvNav.setActiveItem('sidebar', 0);
                        tvNav.setActiveZone('grid');
                      }}
                      className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-5 rounded-xl text-xs sm:text-sm tracking-wide transition"
                    >
                      Перейти в Каталог
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {filteredMovies.map((anime, index) => {
                      const isActive = tvNav.activeZone === 'grid' && tvNav.activeIndexes.grid === index;

                      return (
                        <AnimeCard
                          key={anime.id}
                          ref={(el) => tvNav.registerRef('grid', index, el)}
                          id={anime.id}
                          title={anime.title}
                          russianTitle={anime.russianTitle}
                          imageUrl={anime.imageUrl}
                          rating={anime.rating}
                          year={anime.year}
                          episodes={anime.episodes}
                          genres={anime.genres}
                          isActive={isActive}
                          isFavorite={true}
                          onMouseEnter={() => tvNav.setActiveItem('grid', index)}
                          onClick={() => openMaterialDetail(anime)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ЭКРАН 4: ИСТОРИЯ ПРОСМОТРА С ПРОГРЕСС-БАРОМ */}
            {currentTab === 4 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                    <HistoryIcon className="text-blue-500" size={24} />
                    <span>История Просмотра</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1">Тайтлы, которые вы ранее запускали со своим текущим процентом просмотра.</p>
                </div>

                {userData.history.length === 0 ? (
                  // Пустая история просмотров
                  <div className="flex-1 flex flex-col justify-center items-center py-20 bg-neutral-950/20 rounded-2xl border border-dashed border-neutral-900 px-4">
                    <MonitorPlay className="text-neutral-700 stroke-[1.5] mb-4" size={64} />
                    <h3 className="text-base font-semibold text-neutral-300">История отсутствует</h3>
                    <p className="text-xs text-neutral-500 text-center mt-2 max-w-sm">
                      Вы пока не запускали ни одного аниме. Нажмите ОК/Выбрать на карточке для воспроизведения без задержек.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {userData.history.map((hist, index) => {
                      const associatedAnime = animes.find((a) => a.id === hist.animeId);
                      const isFocused = tvNav.activeZone === 'grid' && tvNav.activeIndexes.grid === index;

                      return (
                        <div
                          key={hist.animeId}
                          ref={(el) => tvNav.registerRef('grid', index, el)}
                          onMouseEnter={() => tvNav.setActiveItem('grid', index)}
                          onClick={() => {
                            if (associatedAnime) playVideo(associatedAnime);
                          }}
                          className={`w-full bg-neutral-950 p-4 rounded-xl border transition-all duration-300 flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4 cursor-pointer ${
                            isFocused
                              ? 'border-blue-500 ring-2 ring-blue-950/40 scale-[1.01]'
                              : 'border-neutral-900/60 hover:border-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <img
                              src={hist.imageUrl}
                              alt={hist.title}
                              className="w-16 h-20 object-cover rounded-md border border-neutral-800 pointer-events-none"
                            />
                            <div>
                              <h3 className="text-white text-sm sm:text-base font-bold leading-tight">{hist.russianTitleString}</h3>
                              <p className="text-xs text-neutral-400 italic mb-1.5">{hist.title}</p>
                              
                              <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
                                <Clock size={11} />
                                <span>Прогресс: {formatTime(hist.currentTime)} / {formatTime(hist.duration)} ({hist.progressPercent}%)</span>
                              </div>
                            </div>
                          </div>

                          <div className="w-full sm:w-auto flex flex-col items-end gap-2 text-right">
                            <span className="text-[10px] text-neutral-500 font-mono sm:block hidden">{hist.watchedAt}</span>
                            <div className="w-full sm:w-48 bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full"
                                style={{ width: `${hist.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ЭКРАН 5: ФИРМЕННЫЙ ЛИЧНЫЙ КАБИНЕТ (FIREBASE LOGIN / REGISTER) */}
            {currentTab === 5 && (
              <div className="flex-1 flex justify-center items-center py-6 sm:py-10">
                <div className="w-full max-w-lg bg-neutral-950 p-6 sm:p-8 rounded-2xl border border-neutral-900 shadow-xl flex flex-col gap-6">
                  
                  <div className="text-center">
                    <User className="text-blue-500 mx-auto mb-3" size={40} />
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                      {user ? 'Аккаунт Google TV Stream' : 'Авторизация в AnimeTV'}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-1">
                      {user
                        ? 'Ваша история просмотров и избранные тайтлы синхронизированы в Cloud Firestore.'
                        : 'Зарегистрируйте аккаунт, чтобы сохранять избранное и историю на любом Smart TV.'}
                    </p>
                  </div>

                  {user ? (
                    // Вид при авторизованном пользователе
                    <div className="flex flex-col gap-4">
                      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                        <p className="text-neutral-400 text-xs font-mono uppercase tracking-wider mb-1">Статус подключения</p>
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                          <Check size={16} />
                          <span>Облако подключено (Firestore Sync)</span>
                        </div>
                      </div>

                      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800/60 flex flex-col gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-neutral-500 font-mono">UID Клиента:</span>
                          <span className="text-neutral-300 font-mono truncate max-w-xs">{user.uid}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500 font-mono">Электронная почта:</span>
                          <span className="text-neutral-200 font-bold">{user.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500 font-mono">Избранных тайтлов:</span>
                          <span className="text-blue-400 font-bold">{userData.favorites.length} шт.</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500 font-mono">Запусков в истории:</span>
                          <span className="text-neutral-200 font-bold">{userData.history.length} шт.</span>
                        </div>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm uppercase tracking-wider transition flex items-center justify-center gap-2"
                      >
                        <LogOut size={16} /> Выйти из аккаунта
                      </button>
                    </div>
                  ) : (
                    // Форма Входа / Регистрации
                    <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="flex flex-col gap-4">
                      
                      {authError && (
                        <div className="bg-red-950/40 border border-red-800 p-3 rounded-lg flex items-center gap-2 text-xs text-red-300">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{authError}</span>
                        </div>
                      )}

                      {authSuccessMsg && (
                        <div className="bg-emerald-950/40 border border-emerald-800 p-3 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
                          <Check size={14} className="shrink-0" />
                          <span>{authSuccessMsg}</span>
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className="text-neutral-400 text-xs font-mono">Email / Электронная почта</label>
                        <input
                          type="email"
                          placeholder="example@tv.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-neutral-200"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-neutral-400 text-xs font-mono">Пароль</label>
                        <input
                          type="password"
                          placeholder="Не менее 6 символов"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-neutral-200"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-2">
                        {/* Основное действие */}
                        <button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition"
                        >
                          {isRegisterMode ? 'Создать' : 'Войти'}
                        </button>

                        {/* Переключатель режима Регистрация/Вход */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsRegisterMode(!isRegisterMode);
                            setAuthError(null);
                          }}
                          className="bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white py-2.5 rounded-xl text-xs uppercase tracking-wider transition font-semibold"
                        >
                          {isRegisterMode ? 'Уже есть профиль' : 'Регистрация'}
                        </button>
                      </div>

                      {/* Быстрый бесшовный TV демо-вход */}
                      <button
                        type="button"
                        onClick={handleDemoSignIn}
                        className="mt-2 w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2"
                      >
                        <Gamepad2 size={15} /> Тестовый 1-Click ТВ вход
                      </button>

                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Загрузка потока Kodik */}
      <AnimatePresence>
        {isPlayerLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center gap-4"
          >
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }} className="text-blue-500">
              <Play size={40} />
            </motion.div>
            <p className="text-sm text-neutral-300 font-mono uppercase tracking-widest">Получение потока Kodik...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. ПОЛНОЭКРАННЫЙ СИНЕМАТИК ВИДЕОПЛЕЕР (CINEMATIC PLAYER MODAL) */}
      <AnimatePresence>
        {activeVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col justify-between"
          >
            {/* Kodik embed player */}
            <iframe
              src={activeVideo.videoUrl}
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            />

            <motion.div
              animate={{ opacity: isHudVisible ? 1 : 0, y: isHudVisible ? 0 : -20 }}
              transition={{ duration: 0.3 }}
              className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 via-black/40 to-transparent p-6 sm:p-8 flex items-center justify-between pointer-events-none"
            >
              <div className="flex items-center gap-4 pointer-events-auto">
                <button
                  onClick={handleTVBack}
                  className="bg-neutral-900/80 backdrop-blur text-white p-2.5 rounded-xl border border-neutral-700/50 hover:bg-neutral-800 transition shadow"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="text-white text-base sm:text-lg font-bold leading-none">{activeVideo.russianTitle}</h2>
                  <p className="text-xs text-neutral-400 font-mono mt-1">{activeVideo.title} • {activeVideo.year} • {activeVideo.studio}</p>
                </div>
              </div>

              <div className="bg-blue-600 text-white font-mono text-[10px] font-extrabold px-3 py-1 rounded-md tracking-wider shadow shadow-blue-950/20 pointer-events-auto">
                Кодик Embed Player
              </div>
            </motion.div>

            <motion.div
              animate={{ opacity: isHudVisible ? 1 : 0, y: isHudVisible ? 0 : 20 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 sm:p-6 flex items-center justify-between pointer-events-none"
            >
              <div className="text-xs text-neutral-300 pointer-events-auto">
                Нажмите BACK или ESC, чтобы закрыть плеер.
              </div>
              <button
                onClick={updateActiveVideoStream}
                className="rounded-full bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-400 transition pointer-events-auto"
              >
                Перезагрузить Kodik Embed
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. ВСПЛЫВАЮЩИЙ TOAST С УВЕДОМЛЕНИЯМИ */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 right-6 z-50 bg-neutral-900/95 text-white border border-blue-500/50 backdrop-blur-md px-5 py-3 rounded-xl flex items-center gap-3 shadow-2xl shadow-blue-950/20"
          >
            <div className="bg-blue-600/20 text-blue-400 p-1.5 rounded-lg border border-blue-500/30">
              <Sparkles size={16} />
            </div>
            <span className="text-sm font-semibold tracking-wide font-mono">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
