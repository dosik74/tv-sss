// Моковые данные аниме, имитирующие реальный ответ Shikimori / AniList API
export interface Anime {
  id: string;
  kodikId?: string;
  idType?: 'kinopoisk' | 'imdb' | 'shikimori' | 'kodik';
  title: string;
  russianTitle: string;
  imageUrl: string;
  bannerUrl: string;
  rating: string;
  year: number;
  episodes: string;
  genres: string[];
  description: string;
  studio: string;
  duration?: string;
  videoUrl: string; // Ссылка на бесплатный трейлер/видео или m3u8
  type: 'anime' | 'movie' | 'series';
  episodesTotal?: number;
  kinopoiskId?: string;
  shikimoriId?: string;
  imdbId?: string;
  translationId?: string;
  seriaNum?: number;
}

export const ANIMES_MOCK_DATA: Anime[] = [
  // --- АНИМЕ (anime) ---
  {
    id: 'frieren',
    title: 'Sousou no Frieren',
    russianTitle: 'Провожающая в последний путь Фрирен',
    imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1541562232579-512a21360020?w=1600&auto=format&fit=crop&q=80',
    rating: '9.39',
    year: 2023,
    episodes: '28 Эпизодов',
    genres: ['Фэнтези', 'Приключения', 'Драма'],
    description: 'История об эльфийке Фрирен, члене отряда героев, победивших Владыку демонов. Прожив сотни лет после триумфа, ей предстоит осознать ценность быстротечной человеческой жизни и отправиться в новое эмоциональное путешествие.',
    studio: 'Madhouse',
    duration: '24 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    type: 'anime'
  },
  {
    id: 'demon-slayer',
    title: 'Kimetsu no Yaiba',
    russianTitle: 'Клинок, рассекающий демонов',
    imageUrl: 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&auto=format&fit=crop&q=80',
    rating: '8.80',
    year: 2024,
    episodes: '8 Эпизодов (4 Сезон)',
    genres: ['Экшен', 'Сёнэн', 'Исторический'],
    description: 'Начало усердных тренировок Столпов. Тандзиро Камадо и его друзья готовятся к грядущему финальному столкновению с Мудзаном Кибуцудзи в бесконечной крепости.',
    studio: 'ufotable',
    duration: '23 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    type: 'anime'
  },
  {
    id: 'jujutsu',
    title: 'Jujutsu Kaisen',
    russianTitle: 'Магическая битва',
    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=1600&auto=format&fit=crop&q=80',
    rating: '8.92',
    year: 2023,
    episodes: '23 Эпизода (2 Сезон)',
    genres: ['Магия', 'Экшен', 'Сёнэн'],
    description: 'Инцидент в Сибуе. Магическая элита во главе с Сатору Годзё встает перед величайшей угрозой со стороны проклятий под предводительством Гэто и Махито. Битва, которая навсегда изменит мир магии.',
    studio: 'MAPPA',
    duration: '24 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    type: 'anime'
  },
  {
    id: 'one-piece',
    title: 'One Piece',
    russianTitle: 'Ван-Пис: Арка Эггхед',
    imageUrl: 'https://images.unsplash.com/photo-1520038410233-7141be7e6f97?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80',
    rating: '8.73',
    year: 2024,
    episodes: 'Онгоинг',
    genres: ['Приключения', 'Комедия', 'Экшен'],
    description: 'Мугивары прибывают на загадочный остров будущего Egghead — личную лабораторию гениального ученого доктора Вегапанка, где хранятся технологии столетней давности, способные перевернуть представление о мире.',
    studio: 'Toei Animation',
    duration: '24 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    type: 'anime'
  },
  {
    id: 'oshinoko',
    title: 'Oshi no Ko',
    russianTitle: 'Звездное дитя',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&auto=format&fit=crop&q=80',
    rating: '8.71',
    year: 2023,
    episodes: '11 Эпизодов',
    genres: ['Драма', 'Мистика', 'Шоу-бизнес'],
    description: 'За кулисами сверкающей японской поп-индустрии скрываются мрачные секреты, ложь и опасности. Врач-гинеколог и его пациентка перерождаются детьми своей любимой айдол-звезды Ай Хосино.',
    studio: 'Doga Kobo',
    duration: '24 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutback.mp4',
    type: 'anime'
  },

  // --- ФИЛЬМЫ (movie) ---
  {
    id: 'your-name',
    title: 'Kimi no Na wa.',
    russianTitle: 'Твое имя',
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80',
    rating: '8.96',
    year: 2016,
    episodes: 'Фильм',
    genres: ['Романтика', 'Драма', 'Фэнтези'],
    description: 'История о парне из Токио Таки и девушке из провинции Мицухе, которые обнаруживают, что между ними существует странная и необъяснимая связь. Во сне они меняются телами и проживают жизни друг друга.',
    studio: 'CoMix Wave Films',
    duration: '106 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    type: 'movie'
  },
  {
    id: 'weathering-with-you',
    title: 'Tenki no Ko',
    russianTitle: 'Дитя погоды',
    imageUrl: 'https://images.unsplash.com/photo-1434725039720-abb26e22cf14?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&auto=format&fit=crop&q=80',
    rating: '8.35',
    year: 2019,
    episodes: 'Фильм',
    genres: ['Романтика', 'Драма', 'Фэнтези'],
    description: 'Старшеклассник Ходака сбегает из дома в Токио, где знакомится с сиротой Хиной. Хина обладает невероятным даром разгонять тучи и останавливать затяжные дожди в японской столице.',
    studio: 'CoMix Wave Films',
    duration: '112 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    type: 'movie'
  },
  {
    id: 'spirited-away',
    title: 'Sen to Chihiro no Kamikakushi',
    russianTitle: 'Унесенные призраками',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=1600&auto=format&fit=crop&q=80',
    rating: '9.01',
    year: 2001,
    episodes: 'Фильм',
    genres: ['Приключения', 'Фэнтези', 'Семья'],
    description: 'Маленькая Тихиро с родителями случайно попадает в таинственный волшебный мир, населенный призраками и божествами. Чтобы спасти своих родителей, превращенных колдуньей Юбабой в свиней, она устраивается работать в купальни.',
    studio: 'Studio Ghibli',
    duration: '125 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    type: 'movie'
  },

  // --- СЕРИАЛЫ (series) ---
  {
    id: 'cyberpunk',
    title: 'Cyberpunk: Edgerunners',
    russianTitle: 'Киберпанк: Бегущие по краю',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop&q=80',
    rating: '8.60',
    year: 2022,
    episodes: '10 Эпизодов',
    genres: ['Киберпанк', 'Фантастика', 'Экшен'],
    description: 'Уличный парень Дэвид Мартинэз теряет все в автокатастрофе и делает выбор — вживить в себя военный имплант Сандевистан и стать киберпанком, наемником на улицах безжалостного Найт-Сити.',
    studio: 'Trigger',
    duration: '25 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    type: 'series'
  },
  {
    id: 'chainsaw',
    title: 'Chainsaw Man',
    russianTitle: 'Человек-бензопила',
    imageUrl: 'https://images.unsplash.com/photo-1533158326339-7f3cf2404354?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1600&auto=format&fit=crop&q=80',
    rating: '8.55',
    year: 2022,
    episodes: '12 Эпизодов',
    genres: ['Триллер', 'Комедия', 'Сверхъестественное'],
    description: 'Дэндзи — нищий парень, готовый на любую грязную работу, чтобы выплатить долги покойного отца якудза. После предательства он сливается со своим демоническим псом-бензопилой Почитой и становится грозным Человеком-бензопилой.',
    studio: 'MAPPA',
    duration: '24 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    type: 'series'
  },
  {
    id: 'titan',
    title: 'Shingeki no Kyojin',
    russianTitle: 'Атака титанов: Финал',
    imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=1600&auto=format&fit=crop&q=80',
    rating: '9.15',
    year: 2023,
    episodes: '3 Части (Финал)',
    genres: ['Экшен', 'Военное', 'Драма'],
    description: 'Эрен Йегер ведет Дрожь Земли против остального человечества. Пока мир погружается в хаос и руины, бывшие союзники и враги Эрена объединяются, чтобы остановить его безумный марш смерти.',
    studio: 'MAPPA',
    duration: '85 мин.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    type: 'series'
  }
];

// Эмуляция задержки сети Shikimori API с возвратом красивых данных
export function fetchAnimeListMock(): Promise<Anime[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(ANIMES_MOCK_DATA);
    }, 700);
  });
}
