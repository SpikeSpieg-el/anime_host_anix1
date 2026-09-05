#!/usr/bin/env python3
"""Generate promo card JSON and printable QR codes.
2 cards of 6x9 cm per one 10x15 photo paper sheet (Landscape).

Install once:
    pip install qrcode[pil]

Examples:
    python scripts/generate-promo-cards.py --first-six --create-gift-tokens --site-url https://weeb-x.com
    python scripts/generate-promo-cards.py --input cards.json --create-gift-tokens
"""

from __future__ import annotations

import argparse
import html
import json
import os
import random
import re
import secrets
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import quote

try:
    import qrcode
except ImportError as error:
    raise SystemExit("Missing dependency. Install it with: pip install qrcode[pil]") from error


RARITY_COUNTS = {
    "trash": 8,
    "common": 20,
    "uncommon": 22,
    "rare": 17,
    "super_rare": 12,
    "epic": 8,
    "mythic": 5,
    "legendary": 3,
    "ancient": 2,
    "divine": 1,
    "transcendent": 1,
    "omnipotent": 1,
}

RARITY_SCORE_RANGES = {
    "trash": (5.0, 6.5),
    "common": (6.6, 7.0),
    "uncommon": (7.0, 7.7),
    "rare": (7.2, 8.2),
    "super_rare": (7.8, 8.7),
    "epic": (8.3, 9.0),
    "mythic": (8.8, 9.3),
    "legendary": (9.0, 9.5),
    "ancient": (9.2, 9.7),
    "divine": (9.4, 9.8),
    "transcendent": (9.6, 9.9),
    "omnipotent": (9.9, 10.0),
}

RARITY_ORDER = tuple(RARITY_COUNTS)

RARITY_STAT_RANGES = {
    "trash": (5, 25),
    "common": (12, 32),
    "uncommon": (19, 39),
    "rare": (26, 46),
    "super_rare": (33, 53),
    "epic": (40, 60),
    "mythic": (47, 67),
    "legendary": (54, 74),
    "ancient": (62, 82),
    "divine": (72, 90),
    "transcendent": (82, 96),
    "omnipotent": (90, 100),
}


def build_card(index: int, rarity: str, image_url: str, rng: random.Random) -> dict:
    score_min, score_max = RARITY_SCORE_RANGES[rarity]
    stat_min, stat_max = RARITY_STAT_RANGES[rarity]
    card_id = f"random-{900000 + index}-{uuid.uuid4()}"
    score = round(rng.uniform(score_min, score_max), 1)
    stats = {name: rng.randint(stat_min, stat_max) for name in ("hp", "atk", "def", "spd", "luck")}

    return {
        "id": index,
        "uniqueId": card_id,
        "serialId": str(900000 + index),
        "name": f"Character {index:03d}",
        "anime": "Student Festival",
        "rarity": rarity,
        "imageUrl": image_url,
        "originalUrl": image_url,
        "fallbackUrls": [],
        "score": score,
        "shikiId": 0,
        "characterId": 900000 + index,
        "stats": stats,
        "isMainCharacter": False,
        "packId": "student-festival-2026",
        "packName": "Student Festival 2026",
        "orderIndex": index,
    }


def calculate_base_rarity(score: float) -> str:
    if score >= 8.8:
        return "mythic"
    if score >= 8.3:
        return "epic"
    if score >= 7.8:
        return "super_rare"
    if score >= 7.2:
        return "rare"
    if score >= 7.0:
        return "uncommon"
    if score >= 6.6:
        return "common"
    return "trash"


def calculate_gacha_rarity(score: float, is_main_character: bool, rng: random.Random) -> str:
    rarity = calculate_base_rarity(score)
    boost = 0

    if score >= 9.0:
        legendary_roll = rng.random()
        if legendary_roll < 0.03:
            boost += 2
        elif legendary_roll < 0.10:
            boost += 1
    elif score >= 8.5 and rng.random() < 0.08:
        boost += 1

    if is_main_character:
        boost += 1
    if rng.random() < 0.01:
        boost += 1
    if rng.random() < 0.001:
        boost += 3
    if rng.random() < 0.0001:
        boost += 5

    rarity_index = RARITY_ORDER.index(rarity)
    return RARITY_ORDER[min(rarity_index + boost, len(RARITY_ORDER) - 1)]


def load_source_cards(source: Path | None) -> list[dict]:
    if not source:
        return []
    cards = json.loads(source.read_text(encoding="utf-8-sig"))
    if not isinstance(cards, list):
        raise ValueError("--source must contain a JSON array")
    main_cards = [card for card in cards if card.get("isMainCharacter") and card.get("imageUrl")]
    if not main_cards:
        raise ValueError("--source contains no main-character cards with imageUrl")
    unique_cards: list[dict] = []
    seen_characters: set[int] = set()
    anime_counts: dict[str, int] = {}
    for card in main_cards:
        character_id = card.get("characterId")
        anime_key = normalize_anime_title(str(card.get("anime", "")))
        if not isinstance(character_id, int) or character_id in seen_characters:
            continue
        if anime_counts.get(anime_key, 0) >= 2:
            continue
        seen_characters.add(character_id)
        anime_counts[anime_key] = anime_counts.get(anime_key, 0) + 1
        unique_cards.append(card)
    return unique_cards


def load_cards_for_print(source: Path) -> list[dict]:
    cards = json.loads(source.read_text(encoding="utf-8-sig"))
    if not isinstance(cards, list) or not cards:
        raise ValueError("--input must contain a non-empty JSON array")
    required = ("uniqueId", "serialId", "name", "anime", "rarity", "imageUrl", "stats")
    if any(not all(field in card for field in required) for card in cards):
        raise ValueError("--input contains cards with missing required fields")
    return cards


def normalize_anime_title(title: str) -> str:
    normalized = title.lower()
    normalized = re.sub(r"\b(season|part|сезон|часть)\s*[\w\d-]*$", "", normalized)
    normalized = re.sub(r"\s*(?:ii|iii|iv|[2-9])$", "", normalized)
    return "".join(character for character in normalized if character.isalnum())


def shikimori_get(path: str) -> object:
    request = urllib.request.Request(
        f"https://shikimori.one/api/{path}",
        headers={"User-Agent": "weeb-x-promo-generator-bot/1.3 (student project)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Shikimori API error on {path}: {error}") from error


def fetch_gacha_main_characters(count: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    target_anime_count = (count + 1) // 2
    result: list[dict] = []
    seen_characters: set[int] = set()
    selected_anime: set[str] = set()

    candidates: list[dict] = []
    seen_anime_ids: set[int] = set()
    for order in ("ranked", "popularity", "aired_on"):
        for page in range(1, 6):
            try:
                anime_list = shikimori_get(f"animes?limit=50&page={page}&order={order}&kind=tv")
                time.sleep(0.35)
            except RuntimeError:
                continue
            if not isinstance(anime_list, list):
                continue
            for anime in anime_list:
                if isinstance(anime.get("id"), int) and anime["id"] not in seen_anime_ids:
                    seen_anime_ids.add(anime["id"])
                    candidates.append(anime)

    rng.shuffle(candidates)
    candidates.sort(key=lambda anime: float(anime.get("score") or 0), reverse=True)
    
    for anime in candidates:
        anime_id = anime.get("id")
        anime_key = normalize_anime_title(str(anime.get("russian") or anime.get("name") or ""))
        if anime_key in selected_anime or not isinstance(anime_id, int):
            continue
        try:
            roles = shikimori_get(f"animes/{anime_id}/roles")
            time.sleep(0.35)
        except RuntimeError:
            continue
        if not isinstance(roles, list):
            continue
        main_roles = [
            role for role in roles
            if role.get("character")
            and ("Main" in role.get("roles", []) or "Главный" in role.get("roles_russian", []))
        ]
        rng.shuffle(main_roles)
        available_roles = [
            role for role in main_roles
            if isinstance(role["character"].get("id"), int)
            and role["character"]["id"] not in seen_characters
            and "missing" not in role["character"].get("image", {}).get("original", "")
        ]
        if len(available_roles) < 2:
            continue
        selected_anime.add(anime_key)
        for role in available_roles[:2]:
            character = role["character"]
            image = character.get("image", {}).get("original", "")
            character_id = character.get("id")
            image_url = image if image.startswith("http") else f"https://shikimori.one{image}"
            result.append({
                "name": character.get("russian") or character.get("name") or f"Character {character_id}",
                "anime": anime.get("russian") or anime.get("name") or "Anime",
                "imageUrl": image_url,
                "originalUrl": image_url,
                "shikiId": anime_id,
                "characterId": character_id,
                "score": float(anime.get("score") or 0),
                "isMainCharacter": True,
            })
            seen_characters.add(character_id)
        if len(selected_anime) >= target_anime_count:
            return result[:count]

    if len(result) < count and not result:
        raise RuntimeError("Shikimori returned no usable main-character cards")
    if len(result) < count:
        print(f"Warning: Shikimori yielded {len(result)} characters. Recycling pool to fill {count}.")
        while len(result) < count:
            result.append(result[len(result) % len(result)])
    return result[:count]


def generate_cards(
    first_six: bool,
    image_url: str,
    seed: int,
    source_cards: list[dict],
) -> list[dict]:
    selected_rarities = list(RARITY_COUNTS)[:6] if first_six else list(RARITY_COUNTS)
    rng = random.Random(seed)
    cards: list[dict] = []
    index = 1

    for rarity_group in selected_rarities:
        for _ in range(RARITY_COUNTS[rarity_group]):
            if source_cards:
                source = source_cards[(index - 1) % len(source_cards)]
                score = float(source.get("score") or 0)
                rarity = calculate_gacha_rarity(
                    score,
                    bool(source.get("isMainCharacter")),
                    rng,
                )
                card = {
                    **source,
                    "id": index,
                    "uniqueId": f"random-{source['characterId']}-{uuid.uuid4()}",
                    "serialId": str(source["characterId"]),
                    "rarity": rarity,
                    "stats": {
                        name: rng.randint(*RARITY_STAT_RANGES[rarity])
                        for name in ("hp", "atk", "def", "spd", "luck")
                    },
                    "score": round(score, 1),
                    "isMainCharacter": True,
                    "frameModifier": None,
                    "coatingModifier": None,
                    "imageLayers": None,
                    "packId": "student-festival-2026",
                    "packName": "Student Festival 2026",
                    "orderIndex": index,
                }
                cards.append(card)
            else:
                card = build_card(index, rarity, image_url, rng)
                card["isMainCharacter"] = True
                cards.append(card)
            index += 1

    return cards


def write_qr_codes(
    cards: list[dict],
    site_url: str,
    claim_urls: dict[str, str],
    output_dir: Path,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(site_url)
    qr.make(fit=True)
    qr.make_image(fill_color="black", back_color="white").save(
        output_dir / "qr_site_weeb-x.png"
    )

    for card in cards:
        card_id = card["uniqueId"]
        qr = qrcode.QRCode(
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(claim_urls[card_id])
        qr.make(fit=True)
        qr.make_image(fill_color="black", back_color="white").save(
            output_dir / f"qr_claim_{card_id}.png"
        )


def create_gift_tokens(cards: list[dict], site_url: str) -> dict[str, str]:
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise RuntimeError(
            "--create-gift-tokens requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )

    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/gift_card_tokens"
    claim_urls: dict[str, str] = {}
    for card in cards:
        token = secrets.token_hex(16)
        request = urllib.request.Request(
            endpoint,
            data=json.dumps({"token": token, "payload": card}).encode("utf-8"),
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
                "Authorization": "Bearer " + service_role_key,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20):
                pass
        except urllib.error.HTTPError as error:
            raise RuntimeError(
                f"Supabase token creation failed for {card['uniqueId']}: HTTP {error.code}"
            ) from error
        claim_urls[card["uniqueId"]] = f"{site_url.rstrip('/')}/gift/{token}"
    return claim_urls


RARITY_CSS = {
    "trash": ("#78716c", "#1c1917", "#a8a29e"),
    "common": ("#94a3b8", "#0f172a", "#cbd5e1"),
    "uncommon": ("#34d399", "#022c22", "#6ee7b7"),
    "rare": ("#22d3ee", "#083344", "#67e8f9"),
    "super_rare": ("#818cf8", "#1e1b4b", "#a5b4fc"),
    "epic": ("#c084fc", "#2e1065", "#e9d5ff"),
    "mythic": ("#e879f9", "#4a044e", "#f5d0fe"),
    "legendary": ("#f472b6", "#500724", "#fbcfe8"),
    "ancient": ("#fbbf24", "#451a03", "#fde68a"),
    "divine": ("#fb923c", "#431407", "#fed7aa"),
    "transcendent": ("#f87171", "#450a0a", "#fecaca"),
    "omnipotent": ("#fef08a", "#18181b", "#fef9c3"),
}

RARITY_LABELS = {
    "trash": "Мусор",
    "common": "Обычная",
    "uncommon": "Необычная",
    "rare": "Редкая",
    "super_rare": "Супер редкая",
    "epic": "Эпическая",
    "mythic": "Мифическая",
    "legendary": "Легендарная",
    "ancient": "Древняя",
    "divine": "Божественная",
    "transcendent": "Трансцендентная",
    "omnipotent": "Всемогущая",
}

RARITY_RGB = {
    "trash": "120,113,108",
    "common": "148,163,184",
    "uncommon": "52,211,153",
    "rare": "34,211,238",
    "super_rare": "129,140,248",
    "epic": "192,132,252",
    "mythic": "232,121,249",
    "legendary": "244,114,182",
    "ancient": "251,191,36",
    "divine": "251,146,60",
    "transcendent": "248,113,113",
    "omnipotent": "255,255,255",
}


def html_card(card: dict | None, qr_dir: Path, site_url: str, claim_url: str, back: bool = False) -> str:
    if card is None:
        return '<article class="card empty"></article>'

    rarity = str(card["rarity"])
    accent, background, light = RARITY_CSS[rarity]
    rgb = RARITY_RGB[rarity]
    name = html.escape(str(card["name"]))
    anime = html.escape(str(card["anime"]))
    image_url = html.escape(str(card["imageUrl"]), quote=True)
    rarity_label = html.escape(RARITY_LABELS[rarity])
    unique_id = html.escape(str(card["uniqueId"]))
    name_size = max(5.5, min(10.0, 10.0 * 18 / max(len(str(card["name"])), 18)))
    anime_size = max(2.2, min(6.0, 6.0 * 32 / max(len(str(card["anime"])), 32)))
    pack_name = str(card.get("packName", ""))
    pack_size = max(3.2, min(4.5, 4.5 * 22 / max(len(pack_name), 22)))
    art_position = card.get("artPosition") or {"x": 50, "y": 50}
    position = f'{float(art_position.get("x", 50)):g}% {float(art_position.get("y", 50)):g}%'
    
    if back:
        return f"""
        <article class="card back" style="--accent:{accent};--bg:{background};--light:{light};--rgb:{rgb}">
          <img class="back-logo" src="https://weeb-x.com/icon.svg" alt="WEEB-X">
          <div class="back-subtitle">ОТСКАНИРУЙ ДЛЯ КОЛЛЕКЦИИ</div>
          <div class="qr-row">
            <div class="qr-box"><img src="{(qr_dir / 'qr_site_weeb-x.png').as_posix()}" /><b>САЙТ WEEB-X</b></div>
            <div class="qr-box"><img src="{(qr_dir / f'qr_claim_{card["uniqueId"]}.png').as_posix()}" /><b>ЗАБРАТЬ КАРТУ</b></div>
          </div>
          <div class="back-id">{unique_id}</div>
        </article>
        """
    main_badge = '<div class="hero-badge"><span>♛</span> ГЛАВНЫЙ ГЕРОЙ</div>' if card.get("isMainCharacter") else ""
    return f"""
    <article class="card front" style="--accent:{accent};--bg:{background};--light:{light};--rgb:{rgb}">
      <img class="hero" src="{image_url}" alt="" style="object-position:{position}">
      <div class="shade"></div>
      <div class="top"><span class="rarity">{rarity_label}</span><span class="score">★ {float(card["score"]):.1f}</span></div>
      {main_badge}
      <div class="info">
        <h2 style="font-size:{name_size:.2f}pt">{name}</h2><p style="font-size:{anime_size:.2f}pt">{anime}</p>
        <div class="info-meta"><span class="id">ID: {unique_id[-8:]}</span><span class="pack" style="font-size:{pack_size:.2f}pt">{html.escape(pack_name)}</span></div>
      </div>
    </article>
    """


def write_print_html(
    cards: list[dict],
    output: Path,
    qr_dir: Path,
    site_url: str,
    claim_urls: dict[str, str],
) -> None:
    qr_dir_rel = Path(os.path.relpath(qr_dir, output.parent))
    pages = []
    
    # 2 карты на лист 150 x 100 мм (Альбомная ориентация)
    for start in range(0, len(cards), 2):
        pair = cards[start : start + 2]
        card_a = pair[0]
        card_b = pair[1] if len(pair) > 1 else None

        # Лицевая сторона: [Карта A] [Карта B]
        front_a = html_card(card_a, qr_dir_rel, site_url, claim_urls[card_a["uniqueId"]], back=False)
        front_b = (
            html_card(card_b, qr_dir_rel, site_url, claim_urls[card_b["uniqueId"]], back=False)
            if card_b
            else '<article class="card empty"></article>'
        )
        pages.append(f'<section class="sheet front-sheet">{front_a}{front_b}</section>')
        
        # Рубашка в том же порядке, что и лицевая сторона: [Рубашка A] [Рубашка B].
        # Так ID рубашки всегда совпадает с ID соответствующей лицевой карты.
        back_a = html_card(card_a, qr_dir_rel, site_url, claim_urls[card_a["uniqueId"]], back=True)
        back_b = (
            html_card(card_b, qr_dir_rel, site_url, claim_urls[card_b["uniqueId"]], back=True)
            if card_b
            else '<article class="card empty"></article>'
        )
        pages.append(f'<section class="sheet back-sheet">{back_a}{back_b}</section>')

    output.write_text(f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Weeb-X Cards (2 cards 6x9 cm on 10x15 Photo Paper)</title>
<style>
@page {{
  size: 150mm 100mm landscape;
  margin: 0;
}}
* {{
  box-sizing: border-box;
}}
html, body {{
  margin: 0;
  padding: 0;
  background: #090b1c;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}

/* Альбомный лист 10x15 см (150 x 100 мм) */
.sheet {{
  width: 150mm;
  height: 100mm;
  max-height: 100mm;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6mm; /* Расстояние между картами */
  page-break-inside: avoid;
  page-break-after: always;
  break-after: page;
  overflow: hidden;
  background: #fff;
  position: relative;
}}

/* Карточка ровно 60 x 90 мм */
.card {{
  width: 60mm;
  height: 90mm;
  position: relative;
  overflow: hidden;
  border-radius: 3mm;
  background: #090b1c;
  border: 0.45mm solid rgba(var(--rgb, 255,255,255), 0.5);
  box-shadow: 0 1mm 3mm rgba(0,0,0,.4);
}}

.card.empty {{
  background: transparent;
  outline: none;
}}

.front .hero {{
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.02);
}}
.shade {{
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(2,6,23,0.08) 18%, rgba(2,6,23,0.12) 45%, rgba(2,6,23,0.94) 100%);
}}
.top {{
  position: absolute;
  top: 3mm;
  left: 3mm;
  right: 3mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 5pt;
  font-weight: 900;
  letter-spacing: .04em;
}}
.rarity, .score, .hero-badge {{
  background: rgba(0, 0, 0, 0.75);
  border: 0.2mm solid rgba(255, 255, 255, 0.3);
  border-radius: 2.5mm;
  padding: .6mm 1.2mm;
}}
.rarity {{ color: var(--light, #fff); }}
.score {{ color: #fde047; }}
.hero-badge {{
  position: absolute;
  top: 9mm;
  left: 3mm;
  color: #451a03;
  background: #fbbf24;
  font-size: 4.2pt;
  font-weight: 900;
}}
.info {{
  position: absolute;
  left: 3.5mm;
  right: 3.5mm;
  bottom: 3.5mm;
  padding: 3mm 3mm 2.5mm 3.5mm;
  border: 0.2mm solid rgba(255, 255, 255, 0.15);
  border-radius: 3mm;
  border-left: 1.1mm solid var(--accent);
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(2px);
}}
h2 {{
  margin: 0;
  font-size: 10pt;
  line-height: 1.05;
  text-transform: uppercase;
  font-weight: 900;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
  color: #fff;
}}
p {{
  margin: 1.2mm 0 2mm;
  color: #cbd5e1;
  font-size: 6pt;
  line-height: 1.05;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  overflow-wrap: anywhere;
}}
.id {{
  color: #94a3b8;
  font: 3.2pt monospace;
  letter-spacing: .08em;
  overflow-wrap: anywhere;
}}
.info-meta {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2mm;
  border-top: .2mm solid rgba(255,255,255,.1);
  padding-top: 1.8mm;
}}
.pack {{
  color: #a5b4fc;
  font-size: 4.5pt;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
  white-space: nowrap;
}}

/* Рубашка */
.back {{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4mm;
  background: #090b1c;
}}
.back-logo {{
  display: block;
  width: 31mm;
  height: 31mm;
  object-fit: contain;
  border-radius: 4mm;
  margin-bottom: 1mm;
}}
.back-subtitle {{
  margin: 1.5mm 0 4.5mm;
  color: #94a3b8;
  font-size: 4.6pt;
  font-weight: 700;
  letter-spacing: .08em;
  text-align: center;
}}
.qr-row {{
  display: flex;
  gap: 3mm;
}}
.qr-box {{
  width: 24mm;
  padding: 1.5mm;
  background: #fff;
  color: #0f172a;
  text-align: center;
  border-radius: 2mm;
  font-size: 4.5pt;
}}
.qr-box img {{
  display: block;
  width: 21mm;
  height: 21mm;
  margin: 0 auto 1.5mm;
}}
.back-id {{
  margin-top: 5mm;
  max-width: 100%;
  color: #64748b;
  font: 3.2pt monospace;
  line-height: 1.25;
  overflow-wrap: anywhere;
  text-align: center;
}}

@media print {{
  body {{ background: transparent; }}
  .sheet {{ margin: 0; box-shadow: none; }}
}}
</style>
</head>
<body>
{''.join(pages)}
</body>
</html>
""", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate promo cards JSON and QR PNG files.")
    parser.add_argument("--first-six", action="store_true", help="Generate Trash through Epic only (87 cards).")
    parser.add_argument("--base-url", help="Legacy claim URL prefix ending in card_id=.")
    parser.add_argument("--site-url", default="https://weeb-x.com", help="URL encoded by the first QR.")
    parser.add_argument(
        "--claim-base-url",
        help="Legacy claim URL prefix ending in card_id=. Omit this for real /gift/{token} URLs.",
    )
    parser.add_argument("--create-gift-tokens", action="store_true", help="Create real one-time /gift/{token} claims in Supabase.")
    parser.add_argument("--source", type=Path, help="JSON export of real gacha cards; only isMainCharacter cards are used.")
    parser.add_argument("--input", type=Path, help="Reuse edited cards JSON and only rebuild QR codes and print HTML.")
    parser.add_argument("--print-html", type=Path, default=Path("print-cards.html"), help="Printable duplex HTML output.")
    parser.add_argument("--image-url", default="https://weeb-x.com/placeholder.jpg")
    parser.add_argument("--output", type=Path, default=Path("cards.json"))
    parser.add_argument("--qr-dir", type=Path, default=Path("qr-codes"))
    parser.add_argument("--seed", type=int, default=20260905)
    args = parser.parse_args()

    expected_count = 87 if args.first_six else 100
    if args.input:
        cards = load_cards_for_print(args.input)
        expected_count = len(cards)
        print(f"Reusing {expected_count} edited cards from {args.input}...")
    else:
        source_cards = load_source_cards(args.source)
        if not source_cards:
            print("Fetching 100 main-character cards from Shikimori...")
            source_cards = fetch_gacha_main_characters(100, args.seed)
        cards = generate_cards(args.first_six, args.image_url, args.seed, source_cards)
    
    if len(cards) != expected_count or len({card["uniqueId"] for card in cards}) != expected_count:
        raise RuntimeError(f"Generated card count or IDs invalid: got {len(cards)}, expected {expected_count}")

    if args.create_gift_tokens:
        claim_urls = create_gift_tokens(cards, args.site_url)
    else:
        claim_base_url = args.claim_base_url or args.base_url
        if not claim_base_url:
            raise SystemExit(
                "Pass --create-gift-tokens to generate working https://weeb-x.com/gift/{token} URLs "
                "or explicitly provide the legacy --claim-base-url"
            )
        claim_urls = {
            card["uniqueId"]: f"{claim_base_url}{quote(card['uniqueId'], safe='')}"
            for card in cards
        }

    if not args.input:
        args.output.write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    
    print("Generating QR codes...")
    write_qr_codes(cards, args.site_url, claim_urls, args.qr_dir)
    print("Building printable duplex HTML (2 cards per 10x15 sheet)...")
    write_print_html(cards, args.print_html, args.qr_dir, args.site_url, claim_urls)
    
    cards_message = f"using {args.input}" if args.input else f"saved to {args.output}"
    print(
        f"\nSUCCESS: Prepared {len(cards)} cards ({cards_message})\n"
        f"QR codes: {args.qr_dir}/\n"
        f"Print HTML: {args.print_html}\n"
    )


if __name__ == "__main__":
    main()