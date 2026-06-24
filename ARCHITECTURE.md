# 🏗️ Архитектура и поток данных

## Диаграмма потока данных

```
┌─────────────────────────────────────────────────────────────────┐
│                      ПОЛЬЗОВАТЕЛЬСКОЕ ДЕЙСТВИЕ                  │
│                      Клик на Play кнопку                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │      App.tsx - playVideo()         │
        │  Получает ID и параметры контента │
        └────────────┬─────────────────────────┘
                     │
        ┌────────────▼─────────────────────┐
        │  fetchPlayUrl() - Получить URL   │
        │  /play?id=...&seria_num=...      │
        └────────────┬─────────────────────┘
                     │
        ┌────────────▼──────────────────────────┐
        │   Backend: /play endpoint             │
        │   parser.get_m3u8_playlist_link()     │
        └────────────┬──────────────────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │  setActiveVideo(videoData)          │
        │  setUseFullscreenPlayer(true)       │
        └────────────┬────────────────────────┘
                     │
        ┌────────────▼──────────────────────────┐
        │   Рендеринг VideoPlayer в fullscreen │
        └────────────┬──────────────────────────┘
                     │
    ┌────────────────┼────────────────────┐
    │                │                    │
    ▼                ▼                    ▼
┌─────────┐   ┌─────────────┐   ┌──────────────┐
│Озвучки  │   │  Серии      │   │ Видео HLS.js │
│         │   │             │   │ Воспроизведе│
│ fetch   │   │ fetch       │   │ ние         │
│Trans    │   │Episodes()   │   │ Адаптивный  │
│lations()│   │             │   │ битрейт     │
└────┬────┘   └──────┬──────┘   └──────┬──────┘
     │               │                  │
     ▼               ▼                  ▼
┌────────────────────────────────────────────────┐
│         VideoPlayer Компонент                  │
│  - Меню озвучек (выбор и переключение)        │
│  - Список серий (навигация между ними)        │
│  - Контролы плеера (Play, Volume, Speed...)   │
│  - Клавиатурные сокращения (Space, стрелки..)│
│  - Сохранение позиций просмотра               │
└────────────────────────────────────────────────┘
```

## Структура данных

### Озвучка (Translation)
```typescript
interface KodikTranslationOption {
  id: string;           // "12345"
  type: string;         // "voice" или "subtitles"
  name: string;         // "Озвучка РусТов"
  series_range?: [number, number];  // [1, 25]
}
```

### Серия (Episode)
```typescript
interface Episode {
  number: number;       // 1, 2, 3...
  title: string;        // "Серия 1", "Встреча"...
  duration?: string;    // "24 мин"
  watched: boolean;     // true/false
  progress?: number;    // 0 до duration
}
```

### Анимеё (Anime)
```typescript
interface Anime {
  id: string;
  kodikId?: string;
  idType: string;       // "kinopoisk", "shikimori"...
  title: string;
  russianTitle: string;
  imageUrl: string;
  episodesTotal?: number;
  // ... и другие поля
}
```

## Компоненты и их взаимодействие

```
┌─────────────────────────────────────────────┐
│              App.tsx                        │
│  ├─ State: activeVideo, useFullscreenPlayer│
│  ├─ Функции: playVideo(), showToast()     │
│  ├─ Sidebar меню                          │
│  ├─ Каталог аниме                         │
│  └─ Modal плеер (conditionally rendered) │
└────────────┬────────────────────────────────┘
             │
             └─▶ VideoPlayer.tsx (fullscreen)
                 ├─ Props: id, idType, title, episodesTotal
                 ├─ HLS видео воспроизведение
                 ├─ Meню озвучек
                 │  └─ fetchTranslationOptions()
                 │  └─ handleTranslationChange()
                 ├─ Панель серий
                 │  └─ fetchEpisodes()
                 │  └─ handleSelectEpisode()
                 ├─ Контролы
                 │  ├─ togglePlay()
                 │  ├─ toggleMute()
                 │  ├─ toggleFullscreen()
                 │  ├─ handleSkip()
                 │  └─ handleVolumeChange()
                 └─ Клавиатура
                    └─ handleKeydown()
```

## API Вызовы

### 1. Загрузка озвучек
```
Frontend                    Backend
   │                           │
   ├─ fetchTranslationOptions()─▶
   │   /translations             │
   │   ?id=53446                 │
   │   &id_type=shikimori        │
   │                             │
   │    parser.translations()    │
   │                             │
   │  ◀─ [Translation[], ...]────┤
   │                             │
   └─ Рендерим меню озвучек
```

### 2. Загрузка серий
```
Frontend                    Backend
   │                           │
   ├─ fetchEpisodes()───────────▶
   │   /episodes                 │
   │   ?id=53446                 │
   │   &id_type=shikimori        │
   │                             │
   │  parser.get_info()          │
   │  ├─ series_count = 25       │
   │  ├─ translations = [...]    │
   │                             │
   │  ◀─ [Episode[], count]──────┤
   │                             │
   └─ Рендерим список серий
```

### 3. Получение видео URL
```
Frontend                    Backend
   │                           │
   ├─ fetchPlayUrl()─────────────▶
   │   /play                     │
   │   ?id=53446                 │
   │   &seria_num=1              │
   │   &translation_id=12345     │
   │   &quality=720              │
   │                             │
   │  parser.get_m3u8_           │
   │  playlist_link()            │
   │                             │
   │  ◀─ {m3u8_url: "..."}──────┤
   │                             │
   └─ Загружаем в HLS.js
     └─ Начинаем воспроизведение
```

## Состояние (State) VideoPlayer

```typescript
// Основное содержимое
const [currentEpisode, setCurrentEpisode] = useState(1);  // Текущая серия
const [episodes, setEpisodes] = useState<Episode[]>([]);   // Список всех серий

// Видеопроизведение
const [isPlaying, setIsPlaying] = useState(false);
const [duration, setDuration] = useState(0);
const [currentTime, setCurrentTime] = useState(0);
const [volume, setVolume] = useState(1);
const [isMuted, setIsMuted] = useState(false);

// Озвучки
const [translations, setTranslations] = useState<KodikTranslationOption[]>([]);
const [selectedTranslation, setSelectedTranslation] = useState<string>('0');

// UI состояния
const [isFullscreen, setIsFullscreen] = useState(false);
const [showControls, setShowControls] = useState(true);
const [showSettings, setShowSettings] = useState(false);
const [showEpisodes, setShowEpisodes] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// Другое
const [playerSettings, setPlayerSettings] = useState<PlayerSettings>({
  speed: 1,
  selectedTranslation: '0'
});
```

## Жизненный цикл плеера

```
1. МОНТИРОВАНИЕ (useEffect)
   ├─ Загружаем озвучки (fetchTranslationOptions)
   └─ Загружаем серии (fetchEpisodes)
                │
                ▼
2. ПЕРВАЯ ЗАГРУЗКА (useEffect)
   └─ loadEpisodeVideo(initialEpisode)
      └─ fetchPlayUrl()
         └─ Создаем HLS.js экземпляр
            └─ Начинаем воспроизведение
                │
                ▼
3. ВОСПРОИЗВЕДЕНИЕ
   ├─ onPlay() - обновляем state
   ├─ onTimeUpdate() - обновляем currentTime
   ├─ onEnded() - переходим на следующую?
   └─ Слушаем клавиатуру
                │
                ▼
4. ВЗАИМОДЕЙСТВИЕ (Пользователь)
   ├─ Выбирает озвучку
   │  └─ handleTranslationChange()
   │     └─ loadEpisodeVideo() ← перезагружаем видео
   │
   ├─ Выбирает серию
   │  └─ handleSelectEpisode()
   │     └─ Сохраняем позицию текущей
   │     └─ loadEpisodeVideo() ← загружаем новую
   │
   ├─ Нажимает кнопку/клавишу
   │  └─ togglePlay(), toggleMute(), toggleFullscreen()...
   │
   └─ Перемотка
      └─ handleSeek() → videoRef.current.currentTime
                │
                ▼
5. РАЗМОНТИРОВАНИЕ
   └─ hls.current?.destroy()
   └─ clearTimeouts()
   └─ Сохраняем позицию в localStorage
```

## Интеграция с Парсером

```
┌──────────────────────────────────────┐
│     Kodik Parser (Python)            │
├──────────────────────────────────────┤
│ KodikParser класс                    │
│  ├─ get_info(id, id_type)           │
│  │  └─ Возвращает series_count,     │
│  │     translations, другие данные  │
│  │                                  │
│  ├─ get_m3u8_playlist_link(        │
│  │     id, seria_num, trans_id...)  │
│  │  └─ Возвращает URL потока m3u8  │
│  │                                  │
│  ├─ translations(id, id_type)       │
│  │  └─ Список озвучек/субтитров    │
│  │                                  │
│  └─ search(query)                   │
│     └─ Поиск контента               │
└──────────────────────────────────────┘
          ▲           ▲
          │           │
    ┌─────┴──┬────────┴─────┐
    │        │              │
 /info   /episodes      /translations
 /search   /play         /list
```

## Обработка ошибок

```typescript
try {
  // 1. Загрузка озвучек
  const trans = await fetchTranslationOptions({id, idType});
  setTranslations(trans);
} catch (err) {
  // Ловим ошибку и логируем
  console.error('Ошибка озвучек:', err);
  // Показываем empty state
  setTranslations([]);
}

try {
  // 2. Загрузка серий
  const eps = await fetchEpisodes({id, idType});
  setEpisodes(eps);
} catch (err) {
  // Fallback: генерируем серии по числу
  const fallbackEpisodes = Array.from(
    {length: episodesTotal || 1},
    (_, i) => ({number: i+1, title: `Серия ${i+1}`})
  );
  setEpisodes(fallbackEpisodes);
}

try {
  // 3. Загрузка видео
  const playData = await fetchPlayUrl({...});
  // Загружаем в HLS.js
  if (Hls.isSupported()) {
    hls.current = new Hls();
    hls.current.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) setError('Ошибка воспроизведения');
    });
  }
} catch (err) {
  setError(err.message);
}
```

## Оптимизация производительности

```typescript
// 1. Мемоизация функций
const loadEpisodeVideo = useCallback(async (episodeNum) => {
  // Загрузка видео с проверкой зависимостей
}, [id, idType, selectedTranslation]);

// 2. Эффекты с зависимостями
useEffect(() => {
  loadEpisodeVideo(currentEpisode);
}, []); // Только при монтировании

// 3. Реф для избежания пересоздания
const hls = useRef<Hls | null>(null);
const videoRef = useRef<HTMLVideoElement>(null);

// 4. Условный рендеринг
{showEpisodes && (
  <div>Список серий</div>
)}

// 5. Очистка
useEffect(() => {
  return () => {
    if (hls.current) hls.current.destroy();
  };
}, []);
```

---

**Все части работают вместе для обеспечения плавного просмотра с полной поддержкой озвучек и серий! 🎬**
