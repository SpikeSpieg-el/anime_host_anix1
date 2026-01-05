export interface Anime {
  id: string
  title: string
  originalTitle: string
  players: {
    [voiceoverName: string]: string[]
  }
  resolutions: string[]
  description: string
  poster: string
  year: number
  country: string
  genres: string[]
  quality: string
  status: "Ongoing" | "Completed"
  rating: number
}

// Заглушки видео для тестирования (замените на реальные ссылки mp4, если найдете)
const SAMPLE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"

export const animeData: Anime[] = [
  // --- ТОТ САМЫЙ ФИЛЬМ (Создай девушку) ---
  {
    id: "47802-sozdaj-devushku",
    title: "Создай девушку",
    originalTitle: "Make a Girl",
    players: {
      // Плеер 1 (из вашего кода Namy)
      "Плеер 1 (Основной)": ["https://api.namy.ws/embed/movie/84986"],
      
      // Плеер 2 (из вашего кода Stloadi)
      "Плеер 2 (Резерв)": ["https://assistant.stloadi.live/?token_movie=573897bfa9cb0b81befe5c419c600e&token=17b680b1b3b643b62ab92e2916abf3&block=US,RU,SG,NL,IN,EE,CA"]
    },
    resolutions: ["1080p", "720p"],
    description: "Действие разворачивается в недалёком будущем, где юный гений Акира Мидзутамари посвятил себя созданию андроидов. Его первой успешной работой стал робот-помощник по имени Солт. Однако следующий проект обернулся провалом. В отчаянии Акира решает создать себе искусственную подругу, которую называет Номер Ноль. Он задумывал её как идеального компаньона, но неожиданно программа начинает давать сбои — робот приобретает собственные эмоции.",
    // Ссылка на постер с Kinogo (убедитесь, что в next.config.mjs стоит unoptimized: true)
    poster: "https://kinogo.media/uploads/posts/2025-09/thumbs/1756880960-282096245.jpg", 
    year: 2025,
    country: "Япония",
    genres: ["Фантастика", "Мелодрама"],
    quality: "WEB-DL",
    status: "Completed",
    rating: 9.4,
  },

  // --- САНДА (Sanda) ---
  {
    id: "48224-sanda",
    title: "Санда",
    originalTitle: "Sanda",
    players: {
      "Anilibria": [SAMPLE, SAMPLE, SAMPLE],
      "SHIZA Project": [SAMPLE, SAMPLE],
      "Japan Original": [SAMPLE]
    },
    resolutions: ["1080p", "720p"],
    description: "В ближайшем будущем Япония переживает социальные изменения. Обычный школьник Санда обнаруживает, что он является потомком Санта-Клауса. Но вместо раздачи подарков ему приходится столкнуться с жестокой реальностью и использовать свои скрытые силы для борьбы с несправедливостью.",
    poster: "https://image.tmdb.org/t/p/original/y4mbO0yJq00a5CjVThd7kQ0Tz7.jpg",
    year: 2025,
    country: "Япония",
    genres: ["Боевик", "Фэнтези", "Комедия"],
    quality: "WEB-DL",
    status: "Ongoing",
    rating: 7.8,
  },

  // --- ПОДНЯТИЕ УРОВНЯ В ОДИНОЧКУ 2 ---
  {
    id: "solo-leveling-s2",
    title: "Поднятие уровня в одиночку 2",
    originalTitle: "Solo Leveling Season 2",
    players: {
      "Anilibria": Array(5).fill(SAMPLE),
      "DreamCast": Array(5).fill(SAMPLE)
    },
    resolutions: ["4K", "1080p"],
    description: "Сон Джин-у становится всё сильнее. Впереди арка с островом Чеджу, где охотникам предстоит столкнуться с угрозой S-ранга, способной уничтожить всю Корею.",
    poster: "https://image.tmdb.org/t/p/original/geCRueV3ElhRTr0xvPuVXviiywc.jpg",
    year: 2025,
    country: "Япония",
    genres: ["Экшен", "Приключения", "Фэнтези"],
    quality: "WEB-DL",
    status: "Ongoing",
    rating: 9.1,
  },

  // --- МАГИЯ И МУСКУЛЫ 3 ---
  {
    id: "mashle-s3",
    title: "Магия и мускулы 3",
    originalTitle: "Mashle",
    players: {
      "AniDUB": Array(12).fill(SAMPLE),
      "Original": Array(12).fill(SAMPLE)
    },
    resolutions: ["1080p"],
    description: "Мэш Бёрндэд продолжает ломать стереотипы магического мира грубой физической силой. Впереди турнир, где ему придется доказать, что мышцы сильнее любой магии.",
    poster: "https://image.tmdb.org/t/p/original/uuC2Qd9sE7zJ58m27V6QW0q.jpg", 
    year: 2024,
    country: "Япония",
    genres: ["Комедия", "Пародия", "Школа"],
    quality: "BDRip",
    status: "Completed",
    rating: 8.2,
  },

  // --- ДАНДАДАН ---
  {
    id: "dandadan",
    title: "Дандадан",
    originalTitle: "Dandadan",
    players: {
      "Studio Band": Array(12).fill(SAMPLE),
      "Anilibria": Array(12).fill(SAMPLE)
    },
    resolutions: ["1080p", "720p"],
    description: "Момо Аясэ верит в призраков, а её одноклассник Окарун — в инопланетян. Вместе они сталкиваются с безумным миром паранормальных явлений.",
    poster: "https://image.tmdb.org/t/p/original/4B68007a827038162137936170.jpg",
    year: 2024,
    country: "Япония",
    genres: ["Сверхъестественное", "Сёнен", "Комедия"],
    quality: "WEB-DL",
    status: "Completed",
    rating: 8.8,
  },

  // --- ДНИ САКАМОТО ---
  {
    id: "sakamoto-days",
    title: "Дни Сакамото",
    originalTitle: "Sakamoto Days",
    players: {
      "Anilibria": Array(3).fill(SAMPLE),
      "Original": Array(3).fill(SAMPLE)
    },
    resolutions: ["1080p"],
    description: "Легендарный киллер ушел на пенсию, женился и растолстел. Теперь он держит магазинчик, но прошлое не хочет его отпускать.",
    poster: "https://image.tmdb.org/t/p/original/p7f1x0v9v0k1a2.jpg",
    year: 2025,
    country: "Япония",
    genres: ["Комедия", "Экшен", "Повседневность"],
    quality: "WEB-DL",
    status: "Ongoing",
    rating: 8.5,
  }
];

// Вспомогательные данные для фильтров
export const genres = [
  "Боевик", "Фэнтези", "Драма", "Комедия", "Ужасы", "Фантастика", 
  "Спорт", "Детектив", "Сверхъестественное", "Повседневность", "Приключения", "Исекай"
]
export const years = [2025, 2024, 2023, 2022, 2021]
export const countries = ["Япония", "Китай", "Корея"]
export const sortOptions = ["Новинки", "Популярное", "Рейтинг"]