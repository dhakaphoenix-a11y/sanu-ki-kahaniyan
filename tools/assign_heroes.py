#!/usr/bin/env python3
"""Give every story one steady hero: नानू, रूबी or लक्षु, plus a few सानू / कुकु stories.

The assignment is seeded, so rerunning the script produces the same result.
Story text is written with सानू as a placeholder; each story block is rewritten
with that story's hero so a name never changes mid-story.
"""

import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    "js/stories.js",
    "js/stories-part2.js",
    "js/stories-part3.js",
    "js/stories-part4.js",
    "js/stories-part5.js",
    "js/stories-part6.js",
    "js/stories-part7.js",
]
HEROES = ["नानू", "रूबी", "लक्षु"]
PLACEHOLDER = "सानू"

# Six नानू stories retold with the site's own hero, and six लक्षु stories for कुकु.
TO_SANU = [22, 23, 25, 27, 34, 38, 96, 97, 98, 99, 100]
TO_KUKU = [16, 18, 24, 31, 33, 36]

STORY_RE = re.compile(r"\{\s*id:\s*(\d+),")


def build_map():
    rng = random.Random(20261024)
    heroes = {}
    for story_id in range(1, 101):
        heroes[story_id] = rng.choice(HEROES)
    for story_id in TO_SANU:
        heroes[story_id] = "सानू"
    for story_id in TO_KUKU:
        heroes[story_id] = "कुकु"
    return heroes


def main():
    heroes = build_map()
    for relative in FILES:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        matches = list(STORY_RE.finditer(text))
        if not matches:
            continue
        pieces = []
        for index, match in enumerate(matches):
            start = match.start()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            block = text[start:end]
            hero = heroes[int(match.group(1))]
            pieces.append((text[:match.start()] if index == 0 else "", block.replace(PLACEHOLDER, hero)))
        rebuilt = pieces[0][0] + "".join(piece for _, piece in pieces)
        path.write_text(rebuilt, encoding="utf-8")

    counts = {}
    for hero in heroes.values():
        counts[hero] = counts.get(hero, 0) + 1
    print("hero distribution:", counts)


if __name__ == "__main__":
    main()
