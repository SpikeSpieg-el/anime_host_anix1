import type { Anime } from "@/lib/shikimori"

export type DemoAnimeItem = Partial<Anime> & {
  id: string | number
  title: string
  poster: string
  rating: number
  year: number
  episodesCurrent: number
  reason: string
  category: 'movie' | 'short' | 'long'
  genresList: string[]
  moods: string[]
  artStyle: 'modern' | 'classic' | 'retro' | 'any'
}

export const DEMO_RECOMMENDATIONS_DATABASE: DemoAnimeItem[] = [
  // --- ЭКШЕН / ТРИЛЛЕР / ТЕМНЫЕ ---
  {
    id: "35120", // Исправлен ID (был дубликат 37779)
    title: "Человек-дьявол: Плакса (Devilman Crybaby)",
    poster: "https://cdn.myanimelist.net/images/anime/1961/90297.jpg",
    rating: 7.8,
    year: 2018,
    episodesCurrent: 10,
    reason: "Идеально подходит под запрос на мрачный хоррор и психологическое давление. Это откровенное, динамичное и визуально смелое исследование тем зла, хаоса и человеческой природы с крышесносным саундтреком.",
    category: "short",
    genresList: ["Хоррор", "Экшен", "Психологическое", "Мистика"],
    moods: ["dark", "exciting", "emotional"],
    artStyle: "classic"
  },
  {
    id: "31964",
    title: "Моя геройская академия (Boku no Hero Academia)",
    poster: "https://cdn.myanimelist.net/images/anime/10/78745.jpg",
    rating: 7.9,
    year: 2016,
    episodesCurrent: 13,
    reason: "Яркий адреналиновый экшен про становление героя. Подойдет любителям вдохновляющих историй с динамичными боями, проработанными способностями и высокой динамикой с первых минут.",
    category: "long",
    genresList: ["Экшен", "Приключения", "Спорт"],
    moods: ["exciting"],
    artStyle: "classic"
  },
  {
    id: "16498",
    title: "Атака титанов (Shingeki no Kyojin)",
    poster: "https://cdn.myanimelist.net/images/anime/10/47347.jpg",
    rating: 8.5,
    year: 2013,
    episodesCurrent: 25,
    reason: "Затягивающий темный триллер о выживании человечества. Безупречный темп повествования, постоянное психологическое напряжение и неожиданные сюжетные повороты.",
    category: "long",
    genresList: ["Экшен", "Драма", "Мистика", "Психологическое"],
    moods: ["dark", "exciting", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "48583",
    title: "Человек-бензопила (Chainsaw Man)",
    poster: "https://cdn.myanimelist.net/images/anime/1806/126216.jpg",
    rating: 8.5,
    year: 2022,
    episodesCurrent: 12,
    reason: "Современная кинематографичная рисовка, безумный экшен и мрачный черноватый юмор. Подойдет тем, кто ищет нестандартных героев и адреналиновый сюжет.",
    category: "short",
    genresList: ["Экшен", "Хоррор", "Фэнтези"],
    moods: ["dark", "exciting"],
    artStyle: "modern"
  },
  {
    id: "40748",
    title: "Магическая битва (Jujutsu Kaisen)",
    poster: "https://cdn.myanimelist.net/images/anime/1171/109222.jpg",
    rating: 8.6,
    year: 2020,
    episodesCurrent: 24,
    reason: "Один из лучших представителей современного экшена. Топовая анимация боев, харизматичные персонажи и атмосферный мистический сеттинг про проклятия.",
    category: "long",
    genresList: ["Экшен", "Фэнтези", "Мистика"],
    moods: ["exciting", "dark"],
    artStyle: "modern"
  },
  {
    id: "52034",
    title: "Киберпанк: Бегущие по краю (Cyberpunk: Edgerunners)",
    poster: "https://cdn.myanimelist.net/images/anime/1818/126436.jpg",
    rating: 8.6,
    year: 2022,
    episodesCurrent: 10,
    reason: "Бешеный темп, неоновая эстетика киберпанка и эмоциональная драма. Отличный выбор для любителей современной стильной рисовки и глубоких, пусть и трагичных историй.",
    category: "short",
    genresList: ["Экшен", "Научная фантастика", "Драма", "Психологическое"],
    moods: ["exciting", "emotional", "dark"],
    artStyle: "modern"
  },

  // --- ДРАМА / РОМАНТИКА / ЭМОЦИИ ---
  {
    id: "38883",
    title: "Дитя погоды (Tenki no Ko)",
    poster: "https://cdn.myanimelist.net/images/anime/1780/100103.jpg",
    rating: 8.3,
    year: 2019,
    episodesCurrent: 1,
    reason: "Визуальный шедевр от Макото Синкая. Невероятная романтическая история с мистическими элементами, потрясающим саундтреком и глубокой эмоциональной развязкой.",
    category: "movie",
    genresList: ["Романтика", "Драма", "Фэнтези"],
    moods: ["romantic", "emotional", "relaxing"],
    artStyle: "modern"
  },
  {
    id: "32281",
    title: "Твоё имя (Kimi no Na wa.)",
    poster: "https://cdn.myanimelist.net/images/anime/1935/127974.jpg",
    rating: 8.9,
    year: 2016,
    episodesCurrent: 1,
    reason: "Эталон трогательного полнометражного аниме. Увлекательная загадка с обменом телами перерастает в драматическую спасательную операцию через время и расстояние.",
    category: "movie",
    genresList: ["Романтика", "Драма", "Мистика"],
    moods: ["romantic", "emotional", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "28851",
    title: "Форма голоса (Koe no Katachi)",
    poster: "https://cdn.myanimelist.net/images/anime/1122/96444.jpg",
    rating: 8.9,
    year: 2016,
    episodesCurrent: 1,
    reason: "Глубокая психологическая драма об искуплении, прощении и пробивании барьеров между людьми. Заставит сопереживать персонажам с первых минут.",
    category: "movie",
    genresList: ["Драма", "Повседневность", "Психологическое", "Романтика"],
    moods: ["emotional", "romantic"],
    artStyle: "classic"
  },
  {
    id: "38101", // Исправлен ID (был дубликат 37450)
    title: "Пять невест (5-toubun no Hanayome)",
    poster: "https://cdn.myanimelist.net/images/anime/1764/96924.jpg",
    rating: 7.6,
    year: 2019,
    episodesCurrent: 12,
    reason: "Легкая и уютная романтическая комедия. Отлично подходит, чтобы расслабиться и следить за забавными взаимоотношениями репетитора и сестер-близнецов.",
    category: "short",
    genresList: ["Романтика", "Комедия", "Повседневность"],
    moods: ["relaxing", "romantic"],
    artStyle: "classic"
  },
  {
    id: "50602",
    title: "Звёздное дитя (Oshi no Ko)",
    poster: "https://cdn.myanimelist.net/images/anime/1812/134736.jpg",
    rating: 8.7,
    year: 2023,
    episodesCurrent: 11,
    reason: "Закулисье шоу-бизнеса, детективная завязка и сочная современная рисовка. Идеально под интеллектуально-эмоциональное настроение с интригой.",
    category: "short",
    genresList: ["Драма", "Мистика", "Психологическое"],
    moods: ["intellectual", "emotional", "dark"],
    artStyle: "modern"
  },

  // --- ФЭНТЕЗИ / ПРИКЛЮЧЕНИЯ / ЛАМПОВЫЕ ---
  {
    id: "52991",
    title: "Фрирен, провожающая в последний путь (Sousou no Frieren)",
    poster: "https://cdn.myanimelist.net/images/anime/1015/138025.jpg",
    rating: 9.3,
    year: 2023,
    episodesCurrent: 28,
    reason: "Размеренное, глубокое и невероятно красивое фэнтези. Рассказывает о ценности времени, дружбе и воспоминаниях после того, как великий подвиг уже совершен.",
    category: "long",
    genresList: ["Фэнтези", "Приключения", "Повседневность", "Драма"],
    moods: ["relaxing", "emotional", "intellectual"],
    artStyle: "modern"
  },
  {
    id: "33352",
    title: "Фиалковый Эвергарден (Violet Evergarden)",
    poster: "https://cdn.myanimelist.net/images/anime/1797/90903.jpg",
    rating: 8.6,
    year: 2018,
    episodesCurrent: 13,
    reason: "Потрясающая эстетическая рисовка от Kyoto Animation. Трогательная история о поиске смысла любви и заживлении душевных ран после войны.",
    category: "short",
    genresList: ["Драма", "Повседневность", "Фэнтези"],
    moods: ["emotional", "relaxing"],
    artStyle: "classic"
  },
  {
    id: "37520", // Исправлен ID (был дубликат 37521)
    title: "Дороро (Dororo)",
    poster: "https://cdn.myanimelist.net/images/anime/1931/97125.jpg",
    rating: 8.2,
    year: 2019,
    episodesCurrent: 24,
    reason: "Мрачное историческое фэнтези о сироте и юноше, у которого демоны отняли части тела. Отличный сбалансированный темп и глубокая сюжетная линия.",
    category: "long",
    genresList: ["Экшен", "Приключения", "Фэнтези", "Мистика"],
    moods: ["dark", "exciting"],
    artStyle: "classic"
  },
  {
    id: "52578",
    title: "Подземелье вкусностей (Dungeon Meshi)",
    poster: "https://cdn.myanimelist.net/images/anime/1359/140220.jpg",
    rating: 8.5,
    year: 2024,
    episodesCurrent: 24,
    reason: "Уютный, ламповый и юмористический взгляд на исследование подземелий. Проработанный лор мира и оригинальная кулинарная тема с монстрами.",
    category: "long",
    genresList: ["Фэнтези", "Комедия", "Приключения"],
    moods: ["relaxing", "exciting"],
    artStyle: "modern"
  },

  // --- ДЕТЕКТИВ / ПСИХОЛОГИЯ / ИНТЕЛЛЕКТУАЛЬНЫЕ ---
  {
    id: "9253",
    title: "Врата Штейна (Steins;Gate)",
    poster: "https://cdn.myanimelist.net/images/anime/5/73199.jpg",
    rating: 9.1,
    year: 2011,
    episodesCurrent: 24,
    reason: "Запутанная научно-фантастическая драма о путешествиях во времени. Идеально под запрос на высокий интеллект, детективную интригу и зашкаливающее напряжение во второй половине.",
    category: "long",
    genresList: ["Научная фантастика", "Мистика", "Психологическое", "Драма"],
    moods: ["intellectual", "emotional", "dark"],
    artStyle: "classic"
  },
  {
    id: "1535",
    title: "Тетрадь смерти (Death Note)",
    poster: "https://cdn.myanimelist.net/images/anime/9/9444.jpg",
    rating: 8.6,
    year: 2006,
    episodesCurrent: 37,
    reason: "Культовая дуэль умов между гениальным школьником и загадочным детективом. Просмотр держит в постоянном интеллектуальном напряжении.",
    category: "long",
    genresList: ["Мистика", "Психологическое", "Драма"],
    moods: ["intellectual", "dark"],
    artStyle: "classic"
  },
  {
    id: "19",
    title: "Монстр (Monster)",
    poster: "https://cdn.myanimelist.net/images/anime/10/18793.jpg",
    rating: 8.8,
    year: 2004,
    episodesCurrent: 74,
    reason: "Взрослый психологический детектив-триллер в условиях Европы конца 20 века. Медленный, вдумчивый темп и глубочайшее погружение в темные стороны человеческой психики.",
    category: "long",
    genresList: ["Мистика", "Психологическое", "Драма"],
    moods: ["intellectual", "dark"],
    artStyle: "classic"
  },
  {
    id: "48569",
    title: "Летнее время (Summer Time Render)",
    poster: "https://cdn.myanimelist.net/images/anime/1220/121882.jpg",
    rating: 8.5,
    year: 2022,
    episodesCurrent: 25,
    reason: "Затягивающий островной мистический детектив с временными петлями, двойниками и непрерывными боями на выживание.",
    category: "long",
    genresList: ["Мистика", "Научная фантастика", "Экшен", "Психологическое"],
    moods: ["intellectual", "exciting", "dark"],
    artStyle: "modern"
  },

  // --- КОМЕДИЯ / РАССЛАБЛЕНИЕ / СПОРТ ---
  {
    id: "50709",
    title: "Одинокий рокер! (Bocchi the Rock!)",
    poster: "https://cdn.myanimelist.net/images/anime/1448/127956.jpg",
    rating: 8.8,
    year: 2022,
    episodesCurrent: 12,
    reason: "Остроумная, невероятно креативная комедия про музыку и социальную тревожность. Подарит кучу улыбок, отличного рока и душевного тепла.",
    category: "short",
    genresList: ["Комедия", "Повседневность"],
    moods: ["relaxing", "emotional"],
    artStyle: "modern"
  },
  {
    id: "20583",
    title: "Волейбол!! (Haikyuu!!)",
    poster: "https://cdn.myanimelist.net/images/anime/7/76014.jpg",
    rating: 8.5,
    year: 2014,
    episodesCurrent: 25,
    reason: "Лучший спортивный сёнэн о командном духе и преодолении себя. Заставляет болеть за персонажей так, словно смотришь реальный финал чемпионата мира.",
    category: "long",
    genresList: ["Спорт", "Комедия", "Драма"],
    moods: ["exciting", "emotional"],
    artStyle: "classic"
  },
  {
    id: "50265",
    title: "Семья шпиона (Spy x Family)",
    poster: "https://cdn.myanimelist.net/images/anime/1441/122795.jpg",
    rating: 8.5,
    year: 2022,
    episodesCurrent: 12,
    reason: "Идеальный микс ламповой комедии, легкого шпионского экшена и семейного уюта. Подходит для любого возраста и настроения.",
    category: "short",
    genresList: ["Комедия", "Экшен", "Повседневность"],
    moods: ["relaxing", "exciting"],
    artStyle: "modern"
  },
  {
    id: "4181",
    title: "Кланнад: Продолжение истории (Clannad: After Story)",
    poster: "https://cdn.myanimelist.net/images/anime/1299/110774.jpg",
    rating: 8.9,
    year: 2008,
    episodesCurrent: 24,
    reason: "Легендарная драма о взрослении, семье и преодолении жизненных трудностей. Одно из самых трогательных аниме в истории.",
    category: "long",
    genresList: ["Драма", "Романтика", "Повседневность"],
    moods: ["emotional", "romantic"],
    artStyle: "classic"
  },
  {
    id: "30",
    title: "Евангелион (Neon Genesis Evangelion)",
    poster: "https://cdn.myanimelist.net/images/anime/1314/142022.jpg",
    rating: 8.3,
    year: 1995,
    episodesCurrent: 26,
    reason: "Культовая меха-классика 90-х с глубочайшим психоанализом, мистикой и философскими подтекстами.",
    category: "long",
    genresList: ["Научная фантастика", "Психологическое", "Драма", "Экшен"],
    moods: ["dark", "intellectual"],
    artStyle: "retro"
  },

  // --- ЛЕГЕНДАРНЫЕ СЁНЭНЫ И ЭКШЕН ---
  {
    id: "5114",
    title: "Стальной алхимик: Братство (Fullmetal Alchemist: Brotherhood)",
    poster: "https://cdn.myanimelist.net/images/anime/1208/94553.jpg",
    rating: 9.1,
    year: 2009,
    episodesCurrent: 64,
    reason: "Великолепное эпическое фэнтези с глубоким сюжетом, проработанными персонажами и идеально сбалансированным сочетанием экшена, драмы и философии.",
    category: "long",
    genresList: ["Экшен", "Приключения", "Драма", "Фэнтези"],
    moods: ["exciting", "emotional", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "11061",
    title: "Хантер х Хантер (Hunter x Hunter 2011)",
    poster: "https://cdn.myanimelist.net/images/anime/1337/99013.jpg",
    rating: 9.0,
    year: 2011,
    episodesCurrent: 148,
    reason: "Один из лучших приключенческих сёнэнов в истории. Начинается как светлое путешествие, но постепенно перерастает в глубокую, мрачную и невероятно продуманную историю.",
    category: "long",
    genresList: ["Экшен", "Приключения", "Фэнтези"],
    moods: ["exciting", "dark", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "41467",
    title: "Блич: Тысячелетняя кровавая война (Bleach: TYBW)",
    poster: "https://cdn.myanimelist.net/images/anime/1908/128172.jpg",
    rating: 9.0,
    year: 2022,
    episodesCurrent: 13,
    reason: "Эпическое возвращение легендарного тайтла с безупречной современной графикой, поразительными боями и мрачной атмосферой финальной битвы.",
    category: "short",
    genresList: ["Экшен", "Фэнтези", "Приключения"],
    moods: ["exciting", "dark"],
    artStyle: "modern"
  },
  {
    id: "1575",
    title: "Код Гиасс: Восставший Лелуш (Code Geass)",
    poster: "https://cdn.myanimelist.net/images/anime/1032/135088.jpg",
    rating: 8.7,
    year: 2006,
    episodesCurrent: 25,
    reason: "Гениальный триллер о войне умов, политических интригах и мести. Персонаж Лелуша не оставит равнодушным любителей сильных интеллектуальных героев.",
    category: "long",
    genresList: ["Экшен", "Научная фантастика", "Драма", "Психологическое"],
    moods: ["intellectual", "exciting", "dark"],
    artStyle: "classic"
  },
  {
    id: "37521", // ID оставлен корректным для Винланда
    title: "Сага о Винланде (Vinland Saga)",
    poster: "https://cdn.myanimelist.net/images/anime/1500/103005.jpg",
    rating: 8.7,
    year: 2019,
    episodesCurrent: 24,
    reason: "Суровая и реалистичная историческая драма о викингах, жажде мести и поиске истинного смысла жизни без насилия.",
    category: "long",
    genresList: ["Экшен", "Драма", "Приключения"],
    moods: ["dark", "emotional", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "32182",
    title: "Моб Психо 100 (Mob Psycho 100)",
    poster: "https://cdn.myanimelist.net/images/anime/1779/98659.jpg",
    rating: 8.5,
    year: 2016,
    episodesCurrent: 12,
    reason: "Потрясающая визуальная комедия с огромным душевным подтекстом о скромном мальчике с колоссальной экстрасенсорной силой.",
    category: "short",
    genresList: ["Экшен", "Комедия", "Повседневность", "Мистика"],
    moods: ["exciting", "relaxing", "emotional"],
    artStyle: "classic"
  },
  {
    id: "52299",
    title: "Поднятие уровня в одиночку (Solo Leveling)",
    poster: "https://cdn.myanimelist.net/images/anime/1898/138004.jpg",
    rating: 8.5,
    year: 2024,
    episodesCurrent: 12,
    reason: "Ураганный адреналиновый экшен про слабейшего охотника, получившего уникальную систему прокачки. Идеальный выбор для любителей динамичных боев.",
    category: "short",
    genresList: ["Экшен", "Фэнтези", "Приключения"],
    moods: ["exciting", "dark"],
    artStyle: "modern"
  },
  {
    id: "30276",
    title: "Ванпанчмен (One Punch Man)",
    poster: "https://cdn.myanimelist.net/images/anime/12/76619.jpg",
    rating: 8.5,
    year: 2015,
    episodesCurrent: 12,
    reason: "Пародийный супергеройский экшен с великолепной рисовкой боев и неподражаемым юмором про героя, побеждающего всех с одного удара.",
    category: "short",
    genresList: ["Экшен", "Комедия", "Научная фантастика"],
    moods: ["exciting", "relaxing"],
    artStyle: "classic"
  },
  {
    id: "2001",
    title: "Гуррен-Лаганн (Tengen Toppa Gurren Lagann)",
    poster: "https://cdn.myanimelist.net/images/anime/8/51619.jpg",
    rating: 8.6,
    year: 2007,
    episodesCurrent: 27,
    reason: "Невероятно пафосный, эпический и мотивирующий сёнэн про силу человеческого духа, который пробивает даже небеса.",
    category: "long",
    genresList: ["Экшен", "Научная фантастика", "Приключения"],
    moods: ["exciting", "emotional"],
    artStyle: "classic"
  },
  {
    id: "34572",
    title: "Чёрный клевер (Black Clover)",
    poster: "https://cdn.myanimelist.net/images/anime/2/88336.jpg",
    rating: 8.1,
    year: 2017,
    episodesCurrent: 170,
    reason: "Динамичное фэнтези о парне без магии, стремление которого стать Королём Магов преодолевает любые преграды.",
    category: "long",
    genresList: ["Экшен", "Фэнтези", "Комедия"],
    moods: ["exciting"],
    artStyle: "classic"
  },

  // --- МРАЧНОЕ ФЭНТЕЗИ, ТРИЛЛЕРЫ И ХОРРОРЫ ---
  {
    id: "34599",
    title: "Созданный в Бездне (Made in Abyss)",
    poster: "https://cdn.myanimelist.net/images/anime/6/86733.jpg",
    rating: 8.6,
    year: 2017,
    episodesCurrent: 13,
    reason: "Завораживающее и невероятно красивое, но при этом жестокое и глубокое исследование опасного подземного мира Бездны.",
    category: "short",
    genresList: ["Приключения", "Фэнтези", "Драма", "Мистика"],
    moods: ["dark", "emotional", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "31240",
    title: "Re:Zero. Жизнь с нуля в альтернативном мире",
    poster: "https://cdn.myanimelist.net/images/anime/11/79410.jpg",
    rating: 8.2,
    year: 2016,
    episodesCurrent: 25,
    reason: "Мрачное психологическое фэнтези с временной петлей. Главный герой вынужден переживать гибель близких снова и снова.",
    category: "long",
    genresList: ["Фэнтези", "Психологическое", "Драма", "Мистика"],
    moods: ["dark", "emotional", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "22535",
    title: "Паразит: Учение о жизни (Kiseijuu: Sei no Kakuritsu)",
    poster: "https://cdn.myanimelist.net/images/anime/5/73178.jpg",
    rating: 8.3,
    year: 2014,
    episodesCurrent: 24,
    reason: "Динамичный научно-фантастический хоррор про инопланетных паразитов и захватывающее слияние человеческого разума с пришельцем.",
    category: "long",
    genresList: ["Экшен", "Хоррор", "Психологическое", "Научная фантастика"],
    moods: ["dark", "exciting", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "41457",
    title: "86: Восемьдесят шесть (86)",
    poster: "https://cdn.myanimelist.net/images/anime/1987/117507.jpg",
    rating: 8.2,
    year: 2021,
    episodesCurrent: 11,
    reason: "Сильная военная драма о сегрегации, тактических сражениях беспилотников и людях, разделенных стеной дискриминации.",
    category: "short",
    genresList: ["Научная фантастика", "Драма", "Экшен"],
    moods: ["dark", "emotional", "intellectual"],
    artStyle: "modern"
  },
  {
    id: "777",
    title: "Хеллсинг OVA (Hellsing Ultimate)",
    poster: "https://cdn.myanimelist.net/images/anime/6/7333.jpg",
    rating: 8.4,
    year: 2006,
    episodesCurrent: 10,
    reason: "Бескомпромиссный мрачный хоррор с кровавым экшеном, стильной музыкой и неподражаемым древним вампиром Алукардом.",
    category: "short",
    genresList: ["Экшен", "Хоррор", "Мистика"],
    moods: ["dark", "exciting"],
    artStyle: "classic"
  },
  {
    id: "13601",
    title: "Психопаспорт (Psycho-Pass)",
    poster: "https://cdn.myanimelist.net/images/anime/5/43399.jpg",
    rating: 8.3,
    year: 2012,
    episodesCurrent: 22,
    reason: "Мрачный киберпанк-детектив. Общество контролируется системой, измеряющей уровень преступных намерений в мозге человека.",
    category: "long",
    genresList: ["Научная фантастика", "Психологическое", "Мистика", "Экшен"],
    moods: ["intellectual", "dark"],
    artStyle: "classic"
  },
  {
    id: "31043",
    title: "Город, в котором меня нет (Erased)",
    poster: "https://cdn.myanimelist.net/images/anime/10/77957.jpg",
    rating: 8.3,
    year: 2016,
    episodesCurrent: 12,
    reason: "Затягивающий детективный триллер с перемещением во времени. Герой возвращается в детство, чтобы предотвратить серийные похищения.",
    category: "short",
    genresList: ["Мистика", "Психологическое", "Драма"],
    moods: ["intellectual", "dark", "emotional"],
    artStyle: "classic"
  },
  {
    id: "37779", // ID оставлен корректным для Неверленда
    title: "Обещанный Неверленд (The Promised Neverland)",
    poster: "https://cdn.myanimelist.net/images/anime/1830/98636.jpg",
    rating: 8.5,
    year: 2019,
    episodesCurrent: 12,
    reason: "Напряженный психологический хоррор-триллер о сиротах из приюта, раскрывших жуть и готовивших побег от монстров.",
    category: "short",
    genresList: ["Хоррор", "Психологическое", "Мистика"],
    moods: ["dark", "intellectual", "exciting"],
    artStyle: "classic"
  },
  {
    id: "22319",
    title: "Токийский гуль (Tokyo Ghoul)",
    poster: "https://cdn.myanimelist.net/images/anime/5/64449.jpg",
    rating: 7.8,
    year: 2014,
    episodesCurrent: 12,
    reason: "Мрачный городской хоррор о парне, ставшем полугулем и вынужденном бороться за место между человеческим и монструозным мирами.",
    category: "short",
    genresList: ["Хоррор", "Экшен", "Психологическое"],
    moods: ["dark", "exciting"],
    artStyle: "classic"
  },
  {
    id: "11111",
    title: "Иная (Another)",
    poster: "https://cdn.myanimelist.net/images/anime/4/35511.jpg",
    rating: 7.5,
    year: 2012,
    episodesCurrent: 12,
    reason: "Атмосферный мистический хоррор-детектив о проклятии школьного класса, несущем загадочные и жуткие смерти.",
    category: "short",
    genresList: ["Хоррор", "Мистика", "Психологическое"],
    moods: ["dark", "intellectual"],
    artStyle: "classic"
  },

  // --- ИСЕКАИ И ЭПИЧЕСКОЕ ФЭНТЕЗИ ---
  {
    id: "39535",
    title: "Реинкарнация бездельника (Mushoku Tensei)",
    poster: "https://cdn.myanimelist.net/images/anime/1530/117776.jpg",
    rating: 8.4,
    year: 2021,
    episodesCurrent: 11,
    reason: "Эталон жанра исэкай с невероятной проработкой мира, живыми персонажами и развитием главного героя от отброса до великого мага.",
    category: "short",
    genresList: ["Фэнтези", "Приключения", "Драма"],
    moods: ["exciting", "emotional", "romantic"],
    artStyle: "modern"
  },
  {
    id: "19815",
    title: "Нет игры — нет жизни (No Game No Life)",
    poster: "https://cdn.myanimelist.net/images/anime/1074/111944.jpg",
    rating: 8.1,
    year: 2014,
    episodesCurrent: 12,
    reason: "Красочный аниме-триллер о гениальных брате и сестре, покоряющих игровой мир, где любые конфликты решаются правилами азартных игр.",
    category: "short",
    genresList: ["Фэнтези", "Комедия", "Приключения"],
    moods: ["intellectual", "exciting", "relaxing"],
    artStyle: "classic"
  },
  {
    id: "30831",
    title: "Этот замечательный мир! (KonoSuba)",
    poster: "https://cdn.myanimelist.net/images/anime/1203/90544.jpg",
    rating: 8.1,
    year: 2016,
    episodesCurrent: 10,
    reason: "Самая смешная пародия на жанр исэкай. Приключения непутёвой команды из бесполезной богини, мага одного заклинания и мазохистки.",
    category: "short",
    genresList: ["Комедия", "Фэнтези", "Приключения"],
    moods: ["relaxing", "exciting"],
    artStyle: "classic"
  },
  {
    id: "29803",
    title: "Повелитель (Overlord)",
    poster: "https://cdn.myanimelist.net/images/anime/10/75806.jpg",
    rating: 7.9,
    year: 2015,
    episodesCurrent: 13,
    reason: "История о застрявшем в игре игроке в теле могущественного скелета-мага Аинза Оал Гоуна, завоевывающего новый мир.",
    category: "short",
    genresList: ["Фэнтези", "Экшен", "Приключения"],
    moods: ["dark", "exciting"],
    artStyle: "classic"
  },
  {
    id: "10087",
    title: "Судьба/Начало (Fate/Zero)",
    poster: "https://cdn.myanimelist.net/images/anime/2/33063.jpg",
    rating: 8.3,
    year: 2011,
    episodesCurrent: 13,
    reason: "Глубокое мрачное фэнтези от студии ufotable о Войне Святого Грааля с шикарными боями и философскими конфликтами магов.",
    category: "short",
    genresList: ["Экшен", "Фэнтези", "Мистика", "Драма"],
    moods: ["dark", "exciting", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "37430",
    title: "О моём перерождении в слизь (Tensura)",
    poster: "https://cdn.myanimelist.net/images/anime/1201/95759.jpg",
    rating: 8.1,
    year: 2018,
    episodesCurrent: 24,
    reason: "Увлекательное фэнтези про перерожденного в слизь офисного работника, строящего мощное и мирное государство монстров.",
    category: "long",
    genresList: ["Фэнтези", "Приключения", "Комедия"],
    moods: ["relaxing", "exciting"],
    artStyle: "classic"
  },
  {
    id: "35790",
    title: "Восхождение героя щита (Shield Hero)",
    poster: "https://cdn.myanimelist.net/images/anime/1490/101365.jpg",
    rating: 7.9,
    year: 2019,
    episodesCurrent: 25,
    reason: "Затягивающее исэкай-приключение про преданного героя, вынужденного подниматься с самого дна и восстанавливать репутацию.",
    category: "long",
    genresList: ["Фэнтези", "Приключения", "Драма"],
    moods: ["dark", "exciting"],
    artStyle: "classic"
  },
  {
    id: "11757",
    title: "Мастера Меча Онлайн (Sword Art Online)",
    poster: "https://cdn.myanimelist.net/images/anime/11/39717.jpg",
    rating: 7.2,
    year: 2012,
    episodesCurrent: 25,
    reason: "Культовое приключение в виртуальной реальности, где смерть в игре означает смерть в реальной жизни.",
    category: "long",
    genresList: ["Экшен", "Приключения", "Научная фантастика", "Романтика"],
    moods: ["exciting", "romantic"],
    artStyle: "classic"
  },
  {
    id: "22297",
    title: "Судьба/Ночь схватки: Клинок бесконечных краев (Fate/stay night UBW)",
    poster: "https://cdn.myanimelist.net/images/anime/12/67913.jpg",
    rating: 8.2,
    year: 2014,
    episodesCurrent: 12,
    reason: "Визуальный шедевр анимации боев от ufotable с легендарным саундтреком и глубокой историей о природе героизма.",
    category: "short",
    genresList: ["Экшен", "Фэнтези", "Мистика"],
    moods: ["exciting", "dark"],
    artStyle: "classic"
  },
  {
    id: "37349",
    title: "Убийца гоблинов (Goblin Slayer)",
    poster: "https://cdn.myanimelist.net/images/anime/1227/95934.jpg",
    rating: 7.4,
    year: 2018,
    episodesCurrent: 12,
    reason: "Суровое и хладнокровное тёмное фэнтези о воине, посвятившем свою жизнь методичному уничтожению гоблинов.",
    category: "short",
    genresList: ["Экшен", "Фэнтези", "Приключения"],
    moods: ["dark", "exciting"],
    artStyle: "classic"
  },

  // --- РОМАНТИКА И ДУШЕВНЫЕ ДРАМЫ ---
  {
    id: "23273",
    title: "Твоя апрельская ложь (Shigatsu wa Kimi no Uso)",
    poster: "https://cdn.myanimelist.net/images/anime/3/67177.jpg",
    rating: 8.6,
    year: 2014,
    episodesCurrent: 22,
    reason: "Глубокая музыкальная драма о любви, вдохновении и преодолении психологической травмы под аккомпанемент классической музыки.",
    category: "long",
    genresList: ["Драма", "Романтика", "Повседневность"],
    moods: ["emotional", "romantic"],
    artStyle: "classic"
  },
  {
    id: "37999",
    title: "Госпожа Кагуя: В любви как на войне (Kaguya-sama)",
    poster: "https://cdn.myanimelist.net/images/anime/1295/106551.jpg",
    rating: 8.7,
    year: 2019,
    episodesCurrent: 12,
    reason: "Гениальная романтическая комедия про двух школьных гениев, устроивших дуэль умов за то, кто первым признается в любви.",
    category: "short",
    genresList: ["Романтика", "Комедия", "Повседневность"],
    moods: ["romantic", "relaxing", "intellectual"],
    artStyle: "classic"
  },
  {
    id: "38680",
    title: "Корзинка фруктов (Fruits Basket 2019)",
    poster: "https://cdn.myanimelist.net/images/anime/1447/99827.jpg",
    rating: 8.2,
    year: 2019,
    episodesCurrent: 25,
    reason: "Трогательное мистическое драма-аниме о семье, проклятой знаками зодиака, и девушке, способной исцелить их сердца.",
    category: "long",
    genresList: ["Драма", "Романтика", "Мистика", "Повседневность"],
    moods: ["emotional", "romantic", "relaxing"],
    artStyle: "classic"
  },
  {
    id: "4224",
    title: "Торадора! (Toradora!)",
    poster: "https://cdn.myanimelist.net/images/anime/13/22128.jpg",
    rating: 8.1,
    year: 2008,
    episodesCurrent: 25,
    reason: "Культовая школьная романтика про двух внешне суровых, но ранимых подростков, помогающих друг другу завоевать сердца друзей.",
    category: "long",
    genresList: ["Романтика", "Комедия", "Драма"],
    moods: ["romantic", "emotional", "relaxing"],
    artStyle: "classic"
  },
  {
    id: "42897",
    title: "Хоримия (Horimiya)",
    poster: "https://cdn.myanimelist.net/images/anime/1695/111486.jpg",
    rating: 8.2,
    year: 2021,
    episodesCurrent: 13,
    reason: "Уютная и легкая романтическая история про двух подростков, открывающих свои настоящие личности друг перед другом.",
    category: "short",
    genresList: ["Романтика", "Повседневность", "Комедия"],
    moods: ["relaxing", "romantic"],
    artStyle: "modern"
  },
  {
    id: "37450", // ID оставлен корректным для Глупого свина
    title: "Этот глупый свин не понимает мечту девочки-зайки (Bunny Girl Senpai)",
    poster: "https://cdn.myanimelist.net/images/anime/1301/93587.jpg",
    rating: 8.2,
    year: 2018,
    episodesCurrent: 13,
    reason: "Интеллектуальная романтика с мистическим подростковым синдромом, проницательными диалогами и глубокой химией персонажей.",
    category: "short",
    genresList: ["Романтика", "Мистика", "Психологическое", "Драма"],
    moods: ["intellectual", "romantic", "emotional"],
    artStyle: "classic"
  },
  {
    id: "48736",
    title: "Эта фарфоровая кукла влюбилась (My Dress-Up Darling)",
    poster: "https://cdn.myanimelist.net/images/anime/1179/119897.jpg",
    rating: 8.2,
    year: 2022,
    episodesCurrent: 12,
    reason: "Милая, красивая и задорная романтическая комедия об увлечении косплеем и сближении двух совершенно разных подростков.",
    category: "short",
    genresList: ["Романтика", "Повседневность", "Комедия"],
    moods: ["romantic", "relaxing"],
    artStyle: "modern"
  },
  {
    id: "9989",
    title: "Невиданный цветок (Anohana)",
    poster: "https://cdn.myanimelist.net/images/anime/5/79697.jpg",
    rating: 8.3,
    year: 2011,
    episodesCurrent: 11,
    reason: "Невероятно слезовыжимательная драма о детской дружбе, нерастраченной боли утраты и прощении спустя годы.",
    category: "short",
    genresList: ["Драма", "Мистика", "Повседневность"],
    moods: ["emotional", "romantic"],
    artStyle: "classic"
  },
  {
    id: "2167",
    title: "Кланнад (Clannad)",
    poster: "https://cdn.myanimelist.net/images/anime/1806/91747.jpg",
    rating: 8.0,
    year: 2007,
    episodesCurrent: 23,
    reason: "Теплая школьная драма, перерастающая во взрослую жизненную историю о семейных ценностях и преодолении жизненных невзгод.",
    category: "long",
    genresList: ["Драма", "Романтика", "Повседневность"],
    moods: ["emotional", "romantic", "relaxing"],
    artStyle: "classic"
  },
  {
    id: "36098",
    title: "Я хочу съесть твою поджелудочную (Kimi no Suizou wo Tabeitai)",
    poster: "https://cdn.myanimelist.net/images/anime/1765/94065.jpg",
    rating: 8.5,
    year: 2018,
    episodesCurrent: 1,
    reason: "Глубокая полнометражная драма про замкнутого парня и смертельно больную девушку, научившую его любить каждый миг жизни.",
    category: "movie",
    genresList: ["Драма", "Романтика", "Повседневность"],
    moods: ["emotional", "romantic"],
    artStyle: "classic"
  },

  // --- ИНТЕЛЛЕКТУАЛЬНЫЕ ИГРЫ, СПОРТ И ПОВСЕДНЕВНОСТЬ ---
  {
    id: "35507",
    title: "Добро пожаловать в класс превосходства (Classroom of the Elite)",
    poster: "https://cdn.myanimelist.net/images/anime/9/86943.jpg",
    rating: 7.8,
    year: 2017,
    episodesCurrent: 12,
    reason: "Затягивающий школьный психологический детектив с гениальным главным героем Аянокоджи, манипулирующим всеми из тени.",
    category: "short",
    genresList: ["Психологическое", "Драма", "Школа"],
    moods: ["intellectual", "dark"],
    artStyle: "classic"
  },
  {
    id: "44074",
    title: "Агент времени (Link Click / Shiguang Dailiren)",
    poster: "https://cdn.myanimelist.net/images/anime/1183/115598.jpg",
    rating: 8.7,
    year: 2021,
    episodesCurrent: 12,
    reason: "Потрясающий детективный триллер о двух парнях, погружающихся в фотографии прошлого для выполнения расследований.",
    category: "short",
    genresList: ["Драма", "Мистика", "Научная фантастика"],
    moods: ["intellectual", "emotional", "dark"],
    artStyle: "modern"
  },
  {
    id: "49596",
    title: "Синяя тюрьма: Блю Лок (Blue Lock)",
    poster: "https://cdn.myanimelist.net/images/anime/1258/126929.jpg",
    rating: 8.2,
    year: 2022,
    episodesCurrent: 24,
    reason: "Эгоистичный адреналиновый спортивный триллер про жесточайший отбор эго-нападающего для сборной Японии по футболу.",
    category: "long",
    genresList: ["Спорт", "Экшен", "Психологическое"],
    moods: ["exciting", "dark"],
    artStyle: "modern"
  },
  {
    id: "22135",
    title: "Пинг-понг (Ping Pong the Animation)",
    poster: "https://cdn.myanimelist.net/images/anime/10/61691.jpg",
    rating: 8.6,
    year: 2014,
    episodesCurrent: 11,
    reason: "Авангардный шедевр спортивной драмы о таланте, усердии и поиске себя через настольный теннис от режиссёра Масааки Юасы.",
    category: "short",
    genresList: ["Спорт", "Драма", "Психологическое"],
    moods: ["intellectual", "emotional"],
    artStyle: "classic"
  },
  {
    id: "36563",
    title: "Мегалобокс (Megalo Box)",
    poster: "https://cdn.myanimelist.net/images/anime/1069/93099.jpg",
    rating: 7.9,
    year: 2018,
    episodesCurrent: 13,
    reason: "Стильный нуарный боксерский экшен с ретро-эстетикой и мощным джазовым саундтреком о бойце из низов.",
    category: "short",
    genresList: ["Спорт", "Экшен", "Драма"],
    moods: ["exciting", "dark"],
    artStyle: "retro"
  },
  {
    id: "46102",
    title: "Необычное такси (Odd Taxi)",
    poster: "https://cdn.myanimelist.net/images/anime/1953/113885.jpg",
    rating: 8.7,
    year: 2021,
    episodesCurrent: 13,
    reason: "Гениальный криминальный нуар-детектив. На первый взгляд мультяшные звери оказываются переплетены в мрачной городской тайне.",
    category: "short",
    genresList: ["Мистика", "Драма", "Психологическое"],
    moods: ["intellectual", "dark"],
    artStyle: "modern"
  },
  {
    id: "28223",
    title: "Парад смерти (Death Parade)",
    poster: "https://cdn.myanimelist.net/images/anime/11/71015.jpg",
    rating: 8.1,
    year: 2015,
    episodesCurrent: 12,
    reason: "Психологическая драма о загробном барном суде, где души усопших играют в смертельные игры для выявлении их истинной сути.",
    category: "short",
    genresList: ["Психологическое", "Мистика", "Драма"],
    moods: ["dark", "intellectual", "emotional"],
    artStyle: "classic"
  },
  {
    id: "10165",
    title: "Моя обычная жизнь (Nichijou)",
    poster: "https://cdn.myanimelist.net/images/anime/3/75617.jpg",
    rating: 8.4,
    year: 2011,
    episodesCurrent: 26,
    reason: "Безумная сюрреалистическая комедия с безупречной анимацией от Kyoto Animation о гиперактивных буднях обычных школьниц.",
    category: "long",
    genresList: ["Комедия", "Повседневность"],
    moods: ["relaxing", "exciting"],
    artStyle: "classic"
  },
  {
    id: "37105",
    title: "Необъятный океан (Grand Blue)",
    poster: "https://cdn.myanimelist.net/images/anime/1376/93774.jpg",
    rating: 8.4,
    year: 2018,
    episodesCurrent: 12,
    reason: "Самая безудержная и смешная студенческая комедия про дайвинг, студенческие вечеринки и нелепые жизненные ситуации.",
    category: "short",
    genresList: ["Комедия", "Повседневность"],
    moods: ["relaxing", "exciting"],
    artStyle: "classic"
  },
  {
    id: "33255",
    title: "Ох уж этот экстрасенс Саики Куо! (The Disastrous Life of Saiki K.)",
    poster: "https://cdn.myanimelist.net/images/anime/11/80449.jpg",
    rating: 8.4,
    year: 2016,
    episodesCurrent: 120,
    reason: "Скорострельная комедия про запредельно всемогущего псионика, мечты которого сводятся лишь к тому, чтобы его все оставили в покое.",
    category: "long",
    genresList: ["Комедия", "Повседневность", "Мистика"],
    moods: ["relaxing", "exciting"],
    artStyle: "classic"
  }
]

/**
 * Функция интеллектуального подбора из локальной базы (Демо/Fallback)
 */
export function getDemoRecommendation(surveyData?: any): any {
  if (!surveyData) {
    // Если анкеты нет — отдаем случайное топовое аниме
    const randomIndex = Math.floor(Math.random() * DEMO_RECOMMENDATIONS_DATABASE.length)
    return DEMO_RECOMMENDATIONS_DATABASE[randomIndex]
  }

  const { favoriteGenres = [], mood, artStyle } = surveyData

  // Подсчитываем соответствие (score) для каждого аниме в базе
  const scoredList = DEMO_RECOMMENDATIONS_DATABASE.map((anime) => {
    let score = 0

    // 1. Совпадение по жанрам (по +3 балла за каждый жанр)
    if (favoriteGenres.length > 0) {
      favoriteGenres.forEach((g: string) => {
        if (anime.genresList.includes(g)) {
          score += 3
        }
      })
    }

    // 2. Совпадение по настроению (по +4 балла)
    if (mood && anime.moods.includes(mood)) {
      score += 4
    }

    // 3. Совпадение по стилистике рисовки (+2 балла)
    if (artStyle && (anime.artStyle === artStyle || anime.artStyle === 'any')) {
      score += 2
    }

    return { anime, score }
  })

  // Сортируем по убыванию совпадений
  scoredList.sort((a, b) => b.score - a.score)

  // Возвращаем самое подходящее (или случайное из топ-3 равных)
  const topMatches = scoredList.filter(item => item.score === scoredList[0].score)
  const chosen = topMatches[Math.floor(Math.random() * topMatches.length)].anime

  return chosen
}