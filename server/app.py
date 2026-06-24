from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
import re
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# Добавляем путь к AnimeParsers/src чтобы импортировать парсер
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANIME_PARSERS_SRC = os.path.join(BASE_DIR, 'AnimeParsers', 'src')
if ANIME_PARSERS_SRC not in sys.path:
    sys.path.insert(0, ANIME_PARSERS_SRC)

try:
    from anime_parsers_ru.parser_kodik import KodikParser
    from anime_parsers_ru.api_kodik import KodikList, KodikSearch
except Exception as e:
    raise RuntimeError(f'Не удалось импортировать Kodik парсер: {e}')

TMDB_API_KEY = 'a981b3ba0b345f578fb917ee74a90bf3'
TMDB_BEARER = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhOTgxYjNiYTBiMzQ1ZjU3OGZiOTE3ZWU3NGE5MGJmMyIsIm5iZiI6MTc1MjUyMjUxMy40MjcsInN1YiI6IjY4NzU1ZjExNzUzYjVjNTYwM2Y5MWJkMyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Trm6p4NqL6VPKlvUkGkRMKVjeH2KAklTAllVbnolV8w'

app = FastAPI(title='Kodik Proxy API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/health')
def health():
    return {"status": "ok", "service": "kodik-proxy"}


def parse_episodes_total(material: dict, item: dict, episodes_label: str, normalized_type: str) -> int | None:
    raw = material.get('episodes_total') or material.get('episodes_aired') or item.get('episodes_total') or item.get('episodes_aired')
    if isinstance(raw, (int, float)) and raw > 0:
        return int(raw)
    if isinstance(raw, str) and raw.isdigit():
        return int(raw)
    match = re.search(r'(\d+)', episodes_label or '')
    if match:
        return int(match.group(1))
    if normalized_type == 'movie':
        return 1
    last_episode = item.get('last_episode')
    if isinstance(last_episode, (int, float)) and last_episode > 0:
        return int(last_episode)
    return None


def fetch_kodik_list(token: str, types_list: list[str], limit: int):
    kl = KodikList(token=token)
    return kl.limit(limit).types(types_list).with_material_data(True).execute().results


@app.get('/search')
def search(title: str, limit: int = 20, only_anime: bool = False):
    try:
        parser = KodikParser()
        results = parser.search(title, limit=limit, include_material_data=True, only_anime=only_anime)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/translations')
def get_translations(id: str, id_type: str = 'kodik'):
    try:
        parser = KodikParser()
        translations = parser.translations(id, id_type)
        return {'translations': translations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/search_by_id')
def search_by_id(id: str, id_type: str = 'kinopoisk', limit: int = 20):
    try:
        parser = KodikParser()
        results = parser.search_by_id(id, id_type, limit=limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/embed')
def get_embed(id: str, id_type: str = 'kodik'):
    try:
        parser = KodikParser()
        embed_url = parser.get_embed_link(id, id_type)
        return {'embed_url': embed_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def normalize_kodik_item(item: dict) -> dict:
    material = item.get('material_data') or {}
    poster = material.get('poster_url') or (item.get('screenshots') or [None])[0] or ''
    if isinstance(poster, str) and poster.startswith('//'):
        poster = 'https:' + poster
    banner = material.get('anime_poster_url') or poster
    title = material.get('title_en') or item.get('title_orig') or item.get('title') or item.get('other_title') or ''
    russian_title = material.get('title') or item.get('title') or item.get('other_title') or title or ''
    kodik_type = item.get('type') or ''
    if kodik_type in ['anime', 'anime-serial']:
        normalized_type = 'anime'
    elif kodik_type in ['foreign-movie', 'russian-movie', 'multi-part-film']:
        normalized_type = 'movie'
    elif kodik_type in ['foreign-serial', 'russian-serial', 'cartoon-serial', 'documentary-serial']:
        normalized_type = 'series'
    elif 'serial' in kodik_type:
        normalized_type = 'series'
    elif 'movie' in kodik_type:
        normalized_type = 'movie'
    else:
        normalized_type = 'anime'

    id_type = 'kodik'
    id_value = item.get('id')
    if item.get('kinopoisk_id'):
        id_type = 'kinopoisk'
        id_value = item.get('kinopoisk_id')
    elif item.get('shikimori_id'):
        id_type = 'shikimori'
        id_value = item.get('shikimori_id')
    elif item.get('imdb_id'):
        id_type = 'imdb'
        id_value = item.get('imdb_id')

    rating = material.get('kinopoisk_rating') or material.get('imdb_rating') or material.get('shikimori_rating') or item.get('rating') or ''
    year = item.get('year') or material.get('year') or 0
    duration = material.get('duration')
    duration_str = ''
    if isinstance(duration, (int, float)):
        duration_str = f"{int(duration)} мин."
    elif isinstance(duration, str):
        duration_str = duration

    genres = material.get('all_genres') or material.get('genres') or []
    if isinstance(genres, str):
        genres = [genres]
    if not isinstance(genres, list):
        genres = []

    studio_data = material.get('anime_studios') or material.get('studios') or material.get('producers') or ''
    if isinstance(studio_data, list):
        studio = ', '.join(studio_data[:2])
    else:
        studio = studio_data or 'Kodik'

    episodes_count = material.get('episodes_aired') or material.get('episodes_total') or item.get('episodes') or 1
    episodes = 'Фильм' if normalized_type == 'movie' else f"{episodes_count} эп."
    episodes_total = parse_episodes_total(material, item, episodes, normalized_type)

    return {
        'id': item.get('id') or str(id_value) or title or russian_title,
        'kodikId': item.get('id'),
        'idType': id_type,
        'title': title,
        'russianTitle': russian_title,
        'imageUrl': poster or '',
        'bannerUrl': banner or poster or '',
        'rating': str(rating),
        'year': int(year) if isinstance(year, (int, float)) else int(year) if isinstance(year, str) and year.isdigit() else 0,
        'episodes': episodes,
        'episodesTotal': episodes_total,
        'genres': genres,
        'description': material.get('description') or material.get('anime_description') or item.get('description') or '',
        'studio': studio,
        'duration': duration_str,
        'videoUrl': '',
        'type': normalized_type,
        'kinopoiskId': item.get('kinopoisk_id'),
        'shikimoriId': item.get('shikimori_id'),
        'imdbId': item.get('imdb_id'),
        'translationId': item.get('translation', {}).get('id') if isinstance(item.get('translation'), dict) else None,
        'seriaNum': 0,
    }


TMDB_BASE_URL = 'https://api.themoviedb.org/3'
TMDB_HEADERS = {
    'Authorization': f'Bearer {TMDB_BEARER}',
    'Content-Type': 'application/json;charset=utf-8'
}


def tmdb_request(path: str, params: dict = {}):
    params = {'api_key': TMDB_API_KEY, **params}
    response = requests.get(f'{TMDB_BASE_URL}{path}', headers=TMDB_HEADERS, params=params, timeout=15)
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f'TMDB error {response.status_code}: {response.text}')
    return response.json()


@app.get('/tmdb/search')
def tmdb_search(query: str, media_type: str = 'movie', limit: int = 15):
    if media_type not in ['movie', 'tv']:
        raise HTTPException(status_code=400, detail='media_type должен быть movie или tv')
    try:
        data = tmdb_request(f'/search/{media_type}', {'query': query, 'page': 1})
        return {'results': data.get('results', [])[:limit]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/tmdb/details')
def tmdb_details(media_type: str = 'movie', tmdb_id: int | None = None):
    if media_type not in ['movie', 'tv']:
        raise HTTPException(status_code=400, detail='media_type должен быть movie или tv')
    if not tmdb_id:
        raise HTTPException(status_code=400, detail='tmdb_id обязателен')
    try:
        return tmdb_request(f'/{media_type}/{tmdb_id}', {'append_to_response': 'external_ids,credits'})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/list')
def get_list(kind: str = 'all', limit: int = 20):
    if kind not in ['all', 'anime', 'movies', 'serials']:
        raise HTTPException(status_code=400, detail='kind должен быть all, anime, movies или serials')
    limit = max(1, min(limit, 100))
    try:
        kp = KodikParser()
        token = kp.TOKEN
        out = []
        seen_ids = set()

        def append_items(items):
            for raw in items:
                item = raw.raw_data if hasattr(raw, 'raw_data') else raw
                normalized = normalize_kodik_item(item)
                item_id = normalized.get('id')
                if item_id in seen_ids:
                    continue
                seen_ids.add(item_id)
                out.append(normalized)

        jobs = []
        if kind in ['movies', 'all']:
            jobs.append(['foreign-movie', 'russian-movie', 'multi-part-film'])
        if kind in ['serials', 'all']:
            jobs.append(['foreign-serial', 'russian-serial', 'cartoon-serial', 'documentary-serial', 'anime-serial'])
        if kind in ['anime', 'all']:
            jobs.append(['anime', 'anime-serial'])

        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            futures = [pool.submit(fetch_kodik_list, token, types_list, limit) for types_list in jobs]
            for future in as_completed(futures):
                append_items(future.result())
        return {'results': out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/episodes')
def get_episodes(id: str, id_type: str = 'kodik'):
    """Возвращает информацию о сериях для контента.
    
    Примеры: /episodes?id=serial-73901&id_type=kodik
    """
    try:
        parser = KodikParser()
        info = parser.get_info(id, id_type)
        
        # Получаем количество серий
        series_count = info.get('series_count', 0)
        
        # Создаем список серий с основной информацией
        episodes = []
        for i in range(1, series_count + 1):
            episodes.append({
                'number': i,
                'title': f'Серия {i}'
            })
        
        # Если это фильм или отдельный выпуск
        if series_count == 0:
            episodes = [{
                'number': 1,
                'title': 'Фильм'
            }]
        
        return {
            'episodes': episodes,
            'series_count': series_count,
            'translations': info.get('translations', [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/play')
def play(id: str, id_type: str = 'kodik', seria_num: int = 0, translation_id: str = '0', quality: int = 720, return_playlist: bool = False):
    """Возвращает m3u8 ссылку или содержимое плейлиста для воспроизведения.

    Примеры: /play?id=serial-73901&id_type=kodik
    """
    try:
        parser = KodikParser()
        if return_playlist:
            playlist = parser.get_m3u8_playlist(id, id_type, seria_num, translation_id, quality)
            return {"playlist": playlist}
        url = parser.get_m3u8_playlist_link(id, id_type, seria_num, translation_id, quality)
        return {"m3u8_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
