"use server"

const RARITY_ORDER = [
  "trash", "common", "uncommon", "rare", "super_rare", "epic", 
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
];

function generateStats(rarity: string) {
  const index = RARITY_ORDER.indexOf(rarity);
  const baseMin = 5 + (index * 8); // Базовый минимум растет с редкостью
  const baseMax = 15 + (index * 8); // Базовый максимум растет с редкостью
  
  // Для высших редкостей делаем статы почти идеальными
  const multiplier = rarity === "omnipotent" ? 1.0 : 1.0;

  const getRandom = (min: number, max: number) => {
    const val = Math.floor(Math.random() * (max - min + 1) + min);
    return Math.min(val, 100); // Ограничиваем 100
  };

  return {
    hp: getRandom(baseMin, baseMax),
    atk: getRandom(baseMin, baseMax),
    def: getRandom(baseMin, baseMax),
    spd: getRandom(baseMin, baseMax),
    luck: getRandom(baseMin, baseMax)
  };
}

function generateDanbooruTags(shikiName: string): string[] {
  if (!shikiName) return[];
  const cleanName = shikiName.replace(/\s*\(.*?\)\s*/g, '').trim();
  if (cleanName.includes(",")) {
    const parts = cleanName.split(",");
    const first = parts[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const last = parts[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return[`${first}_${last}`, `${last}_${first}`];
  }
  const parts = cleanName.split(" ");
  if (parts.length === 2) {
    const p1 = parts[0].toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const p2 = parts[1].toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return [`${p1}_${p2}`, `${p2}_${p1}`];
  }
  return [cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')];
}

async function fetchDanbooruArt(characterName: string): Promise<string | null> {
  const possibleTags = generateDanbooruTags(characterName);
  for (const tag of possibleTags) {
    if (!tag || tag === "_" || tag.length < 2) continue;
    try {
      const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag)}+rating:g+order:score&limit=20`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const validPosts = data.filter((p: any) => p.large_file_url || p.file_url);
      if (validPosts.length > 0) {
        const post = validPosts[Math.floor(Math.random() * validPosts.length)];
        return post.large_file_url || post.file_url;
      }
    } catch (e) {
      console.error(`Danbooru error:`, e);
    }
  }
  return null;
}

export async function rollAnimeCharacter(usedCharacterIds: number[] =[]) {
  try {
    const shikiRes = await fetch("https://shikimori.one/api/animes?limit=15&order=random&kind=tv,movie", { 
      cache: "no-store",
      headers: { "User-Agent": "AnimeGachaApp/1.0" }
    });
    
    const shikiData = await shikiRes.json();
    if (!shikiData || shikiData.length === 0) throw new Error("API error");

    for (const anime of shikiData) {
      const score = parseFloat(anime.score || "0");

      let rarity = "trash";
      if (score >= 9.2) rarity = "omnipotent";
      else if (score >= 9.0) rarity = "transcendent";
      else if (score >= 8.8) rarity = "divine";
      else if (score >= 8.5) rarity = "ancient";
      else if (score >= 8.2) rarity = "legendary";
      else if (score >= 7.8) rarity = "mythic";
      else if (score >= 7.4) rarity = "epic";
      else if (score >= 7.0) rarity = "super_rare";
      else if (score >= 6.5) rarity = "rare";
      else if (score >= 6.0) rarity = "uncommon";
      else if (score >= 5.0) rarity = "common";

      const rolesRes = await fetch(`https://shikimori.one/api/animes/${anime.id}/roles`, {
        cache: "no-store",
        headers: { "User-Agent": "AnimeGachaApp/1.0" }
      });
      
      if (!rolesRes.ok) continue;
      const rolesData = await rolesRes.json();
      
      const availableCharacters = rolesData
        .filter((role: any) => role.character && role.character.id)
        .map((role: any) => role.character)
        .filter((char: any) => !usedCharacterIds.includes(char.id) && !char.image.original.includes('missing'));

      if (availableCharacters.length > 0) {
        const character = availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
        let imageUrl = await fetchDanbooruArt(character.name);

        if (!imageUrl) {
            imageUrl = character.image.original;
            if (imageUrl?.startsWith("/")) imageUrl = `https://shikimori.one${imageUrl}`;
        }

        let finalBase64Image = imageUrl;
        if (imageUrl) {
          try {
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              finalBase64Image = `data:${imgRes.headers.get('content-type')};base64,${buffer.toString('base64')}`;
            }
          } catch (e) {}
        }

        return {
          animeName: anime.russian || anime.name,
          score: score,
          rarity: rarity,
          characterName: character.russian || character.name,
          characterId: character.id,
          originalUrl: imageUrl,
          imageUrl: finalBase64Image,
          shikiId: anime.id,
          stats: generateStats(rarity) // Генерируем характеристики на сервере
        };
      }
    }
    throw new Error("No characters found");
  } catch (error) {
    return null;
  }
}