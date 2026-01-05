const fs = require('fs');

async function fetchNewAnime() {
  // Берем топ онгоингов с Shikimori API
  const res = await fetch('https://shikimori.one/api/animes?limit=20&order=popularity&status=ongoing');
  const data = await res.json();

  const formatted = data.map(anime => ({
    id: String(anime.id) + "-" + anime.russian.replace(/\s+/g, '-'), // генерируем ID
    shikimoriId: String(anime.id),
    title: anime.russian,
    originalTitle: anime.name,
    description: "Описание загрузится при клике...", // Shikimori в списке не дает описание, нужен доп запрос
    poster: "https://shikimori.one" + anime.image.original,
    year: new Date(anime.aired_on).getFullYear(),
    quality: "WEB-DL",
    rating: Number(anime.score)
  }));

  console.log(JSON.stringify(formatted, null, 2));
}

fetchNewAnime();