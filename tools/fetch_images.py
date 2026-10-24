#!/usr/bin/env python3
"""Fetch watercolor / storybook illustrations from Pixabay for each story.

The API key is read from the PIXABAY_KEY environment variable; it is never
written to disk. Output:

  assets/img/stories/<id>-<n>.webp   three illustrations per story
  assets/img/splash-bg.webp          splash screen painting
  assets/img/hero-banner.webp        home page banner
  assets/img/credits.json            photographer credit per file
  js/img-manifest.js                 window.IMG_MANIFEST used by the site
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "img" / "stories"
CREDITS = ROOT / "assets" / "img" / "credits.json"
MANIFEST = ROOT / "js" / "img-manifest.js"
USED = ROOT / "tools" / "used_images.json"
API = "https://pixabay.com/api/"
UA = "sanu-ki-kahaniyan/1.0 (static storybook site)"

STYLE_QUERIES = [
    "watercolor {subject}",
    "cartoon {subject}",
    "{subject} storybook illustration",
    "{subject} cute art",
]
IMAGES_PER_STORY = len(STYLE_QUERIES)
MAX_WIDTH = 900
QUALITY = 80


def api_key():
    key = os.environ.get("PIXABAY_KEY", "").strip()
    if not key:
        sys.exit("PIXABAY_KEY environment variable is required")
    return key


def search(key, query, per_page=20):
    params = urllib.parse.urlencode({
        "key": key,
        "q": query,
        "image_type": "illustration",
        "safesearch": "true",
        "per_page": per_page,
        "order": "popular",
    })
    request = urllib.request.Request(f"{API}?{params}", headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8")).get("hits", [])


def load_used():
    """Pixabay ids already used by any story, so no illustration repeats across the site."""
    if USED.exists():
        try:
            return json.loads(USED.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def subject_tokens(subject):
    return [token for token in re.split(r"[^a-z]+", subject.lower()) if len(token) > 2]


def tag_score(hit, tokens):
    """How many words of the subject the Pixabay tags actually mention."""
    tags = (hit.get("tags") or "").lower()
    return sum(1 for token in tokens if token in tags)


def pick(hits, used, tokens, require_tags=True):
    """Most relevant unused illustration: tag-matched first, then the most liked."""
    usable = []
    fallback = None
    for hit in hits:
        if hit["id"] in used:
            continue
        width, height = hit.get("imageWidth", 0), hit.get("imageHeight", 0)
        ratio = width / max(height, 1)
        if width < 640 or height < 480 or not 0.55 <= ratio <= 1.85:
            fallback = fallback or hit
            continue
        score = tag_score(hit, tokens)
        if require_tags and score == 0:
            fallback = fallback or hit
            continue
        usable.append((score, hit.get("likes", 0), hit))
    if usable:
        usable.sort(key=lambda item: (item[0], item[1]), reverse=True)
        return usable[0][2]
    return fallback


def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def save_webp(raw, destination, max_width=MAX_WIDTH, quality=QUALITY):
    image = Image.open(BytesIO(raw)).convert("RGB")
    if image.width > max_width:
        height = round(image.height * max_width / image.width)
        image = image.resize((max_width, height), Image.LANCZOS)
    image.save(destination, "WEBP", quality=quality, method=6)
    return image.size


def load_credits():
    if CREDITS.exists():
        try:
            return json.loads(CREDITS.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", help="comma separated story ids, default all known subjects")
    parser.add_argument("--force", action="store_true", help="refetch images that already exist")
    parser.add_argument("--special", action="store_true", help="also fetch splash and hero art")
    args = parser.parse_args()

    key = api_key()
    subjects = json.loads((ROOT / "tools" / "subjects.json").read_text(encoding="utf-8"))
    if args.ids:
        wanted = [int(part) for part in args.ids.split(",") if part.strip()]
    else:
        wanted = sorted(int(story_id) for story_id in subjects)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    credits = load_credits()
    used_ids = load_used()
    manifest = {}
    existing_manifest = ROOT / "js" / "img-manifest.js"
    if existing_manifest.exists():
        text = existing_manifest.read_text(encoding="utf-8")
        start, end = text.find("{"), text.rfind("}")
        if 0 < start < end:
            try:
                manifest = json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                manifest = {}

    for story_id in wanted:
        subject = subjects.get(str(story_id))
        if not subject:
            print(f"[skip] story {story_id}: no subject")
            continue
        tokens = subject_tokens(subject)
        files = manifest.get(str(story_id), [])
        if len(files) >= IMAGES_PER_STORY and not args.force:
            print(f"[keep] story {story_id}: {len(files)} images")
            continue
        used, saved = set(), []
        for index, template in enumerate(STYLE_QUERIES, start=1):
            query = template.format(subject=subject)
            try:
                hits = search(key, query)
            except Exception as error:  # network / rate limit
                print(f"[warn] story {story_id} query failed: {error}")
                hits = []
            time.sleep(0.6)
            hit = pick(hits, used | set(used_ids), tokens)
            if not hit:
                print(f"[warn] story {story_id}: no result for '{query}'")
                continue
            used.add(hit["id"])
            used_ids[str(hit["id"])] = story_id
            USED.write_text(json.dumps(used_ids, indent=2), encoding="utf-8")
            destination = OUT_DIR / f"{story_id}-{index}.webp"
            try:
                size = save_webp(download(hit["largeImageURL"]), destination)
            except Exception as error:
                print(f"[warn] story {story_id} download failed: {error}")
                continue
            relative = destination.relative_to(ROOT).as_posix()
            saved.append(relative)
            credits[relative] = {
                "title": subject,
                "author": hit.get("user", ""),
                "author_url": f"https://pixabay.com/users/{hit.get('user', '')}/",
                "page": hit.get("pageURL", ""),
                "license": "Pixabay Content License",
                "width": size[0],
                "height": size[1],
            }
            print(f"[ok] story {story_id} image {index}: {relative} {size}")
        if saved:
            manifest[str(story_id)] = saved
            CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2), encoding="utf-8")
            MANIFEST.write_text(
                "window.IMG_MANIFEST = "
                + json.dumps(manifest, ensure_ascii=False, indent=2)
                + ";\n",
                encoding="utf-8",
            )

    if args.special:
        specials = {
            "splash-bg": "watercolor landscape mountains river blossoms",
            "hero-banner": "watercolor animals friends forest rabbit bear",
        }
        for name, query in specials.items():
            destination = ROOT / "assets" / "img" / f"{name}.webp"
            if destination.exists() and not args.force:
                print(f"[keep] {name}")
                continue
            hit = pick(search(key, query, per_page=30), set(used_ids), [], require_tags=False)
            time.sleep(0.6)
            if hit:
                used_ids[str(hit["id"])] = name
                USED.write_text(json.dumps(used_ids, indent=2), encoding="utf-8")
            if not hit:
                print(f"[warn] no result for {query}")
                continue
            try:
                size = save_webp(download(hit["largeImageURL"]), destination, max_width=1280, quality=80)
            except Exception as error:
                print(f"[warn] {name} download failed: {error}")
                continue
            relative = destination.relative_to(ROOT).as_posix()
            credits[relative] = {
                "title": name,
                "author": hit.get("user", ""),
                "author_url": f"https://pixabay.com/users/{hit.get('user', '')}/",
                "page": hit.get("pageURL", ""),
                "license": "Pixabay Content License",
                "width": size[0],
                "height": size[1],
            }
            print(f"[ok] {relative} {size}")
        CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"manifest entries: {len(manifest)}")


if __name__ == "__main__":
    main()
