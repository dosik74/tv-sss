#!/usr/bin/env python3
"""
Простой CLI для поиска фильмов/сериалов/аниме через Kodik API

Примеры:
  python kodik_media_viewer.py --title "Начало"
  python kodik_media_viewer.py --id 258687 --id-type kinopoisk
  python kodik_media_viewer.py --list movies
"""
import sys
import os
import argparse

# Добавляем локальную папку src в sys.path чтобы импортировать package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

try:
    from anime_parsers_ru.parser_kodik import KodikParser
    from anime_parsers_ru.api_kodik import KodikList
except Exception as e:
    print('Не удалось импортировать модули из anime_parsers_ru:', e)
    raise


def print_item(el):
    if isinstance(el, dict):
        title = el.get('title')
        year = el.get('year')
        typ = el.get('type')
        link = el.get('link')
        sk = el.get('shikimori_id')
        kp = el.get('kinopoisk_id')
        imdb = el.get('imdb_id')
    else:
        title = getattr(el, 'title', None)
        year = getattr(el, 'year', None)
        typ = getattr(el, 'type', None)
        link = getattr(el, 'link', None)
        sk = getattr(el, 'shikimori_id', None)
        kp = getattr(el, 'kinopoisk_id', None)
        imdb = getattr(el, 'imdb_id', None)

    print(f"{title} ({year}) [{typ}]")
    print(f"  link: {link}")
    print(f"  shikimori: {sk}  kinopoisk: {kp}  imdb: {imdb}")


def list_types(kind: str, limit: int = 20):
    kp = KodikParser()
    kl = KodikList(token=kp.TOKEN)
    if kind == 'movies':
        types = ['foreign-movie', 'russian-movie', 'multi-part-film']
    elif kind == 'serials':
        types = ['foreign-serial', 'russian-serial', 'cartoon-serial', 'documentary-serial', 'anime-serial']
    elif kind == 'anime':
        types = ['anime', 'anime-serial']
    else:
        types = None

    try:
        q = kl.limit(limit).with_material_data(True)
        if types:
            q = q.types(types)
        resp = q.execute()
        for item in resp.results:
            print_item(item)
    except Exception as e:
        print('Ошибка при получении списка:', e)


def search_title(title: str, limit: int = 20):
    kp = KodikParser()
    try:
        res = kp.search(title, limit=limit, include_material_data=True)
        for item in res:
            print_item(item)
    except Exception as e:
        print('Ошибка при поиске по названию:', e)


def search_by_id(id_value: str, id_type: str, limit: int = 20):
    kp = KodikParser()
    try:
        res = kp.search_by_id(id_value, id_type, limit=limit)
        for item in res:
            print_item(item)
    except Exception as e:
        print('Ошибка при поиске по id:', e)


def main():
    parser = argparse.ArgumentParser(description='Kodik media viewer')
    parser.add_argument('--title', help='Поиск по названию')
    parser.add_argument('--id', help='Поиск по id (kinopoisk, shikimori, imdb, kodik, mdl, worldart_animation, worldart_cinema)')
    parser.add_argument('--id-type', help='Тип id для --id', default='kinopoisk')
    parser.add_argument('--list', help='list: movies|serials|anime|all')
    parser.add_argument('--limit', help='Ограничение на количество результатов', type=int, default=20)
    args = parser.parse_args()

    if args.title:
        search_title(args.title, limit=args.limit)
    elif args.id:
        search_by_id(args.id, args.id_type, limit=args.limit)
    elif args.list:
        kind = args.list
        if kind == 'all':
            list_types('movies', limit=args.limit)
            print('\n---\n')
            list_types('serials', limit=args.limit)
            print('\n---\n')
            list_types('anime', limit=args.limit)
        else:
            list_types(kind, limit=args.limit)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
