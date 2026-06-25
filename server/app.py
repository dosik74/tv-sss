from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests

TMDB_API_KEY = 'a981b3ba0b345f578fb917ee74a90bf3'
TMDB_BEARER = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhOTgxYjNiYTBiMzQ1ZjU3OGZiOTE3ZWU3NGE5MGJmMyIsIm5iZiI6MTc1MjUyMjUxMy40MjcsInN1YiI6IjY4NzU1ZjExNzUzYjVjNTYwM2Y5MWJkMyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Trm6p4NqL6VPKlvUkGkRMKVjeH2KAklTAllVbnolV8w'

app = FastAPI(title='Alloha Proxy API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/health')
def health():
    return {"status": "ok", "service": "alloha-proxy"}


@app.get('/search_alloha')
def search_alloha(
    imdb_id: str | None = None,
    media_type: str = 'movie',
    season: int = 1,
    episode: int = 1
):
    """Генерирует embed-ссылку для Alloha плеера по IMDB ID.
    
    Alloha API:
    - https://api-movies.github.io/alloha/iframe/{token_movie}
    """
    print(f"=== Alloha Search ===")
    print(f"IMDB ID: {imdb_id}, Media Type: {media_type}")
    
    if imdb_id and imdb_id != "undefined":
        try:
            index_url = "https://api-movies.github.io/alloha/index.json"
            index_response = requests.get(index_url, timeout=30)
            index_data = index_response.json()
            
            movie_data = None
            for movie in index_data:
                if movie.get('id_imdb') == imdb_id:
                    movie_data = movie
                    break
            
            if movie_data:
                token = movie_data.get('token_movie')
                if token:
                    embed_url = f"https://api-movies.github.io/alloha/iframe/{token}"
                    print(f"Generated Alloha embed URL: {embed_url}")
                    return {"embed_url": embed_url, "source": "alloha", "id_type": "imdb"}
                else:
                    print("No token found in Alloha data")
                    return {"embed_url": None, "source": "alloha", "error": "No token found"}
            else:
                print(f"Movie not found in Alloha: {imdb_id}")
                return {"embed_url": None, "source": "alloha", "error": "Movie not found"}
        except Exception as e:
            print(f"Alloha search error: {e}")
            return {"embed_url": None, "source": "alloha", "error": str(e)}
    else:
        print("No valid IMDB ID provided for Alloha search")
        return {"embed_url": None, "source": "alloha", "error": "No valid IMDB ID provided"}


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
