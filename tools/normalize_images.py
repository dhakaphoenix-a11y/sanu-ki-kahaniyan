#!/usr/bin/env python3
"""One-time migration: make every story illustration the same shape and repair damaged files.

    python3 tools/normalize_images.py            # run once on the original Pixabay downloads

What it does
  1. Cut-out pictures that were saved with a black background (lost transparency) get a soft cream
     background; horizontal colour streaks left behind by the lost alpha channel are removed.
  2. Pictures that are completely black, or still badly damaged, are dropped. The site then shows the
     scene's emoji panel instead (js/img-manifest.js holds `null` for those slots).
  3. Every remaining picture becomes 800x600 (4:3):
       - close to 4:3  -> cropped, keeping the most detailed part of the picture
       - tall / wide   -> shown whole on top of a blurred copy of itself
  4. A 400x300 thumbnail of each is written to assets/img/thumbs/ for the home-page cards.
  5. js/img-manifest.js is rewritten.

Needs: pillow, numpy, scipy.
"""
import glob, json, os, re, sys
import numpy as np
from PIL import Image, ImageFilter, ImageStat
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/img/stories')
THUMBS = os.path.join(ROOT, 'assets/img/thumbs')
MANIFEST = os.path.join(ROOT, 'js/img-manifest.js')
FULL, THUMB = (800, 600), (400, 300)
CREAM = (255, 249, 236)

# Reviewed by eye. Real dark paintings (moon, forest ...) must keep their dark sky / edges.
KEEP_ORIGINAL = {'14-1', '14-3', '14-4', '18-2', '18-3', '18-4', '25-1', '26-3', '27-3', '29-3', '35-1',
                 '35-3', '40-3', '42-3', '46-3', '48-3', '56-3', '63-3', '88-3'}
# Cut-outs whose streaks / damage could not be repaired cleanly -> use the emoji panel instead.
DAMAGED = {'3-2', '24-1', '56-2', '57-2', '61-2', '68-2', '85-1', '89-2', '3-1', '11-4', '25-2', '25-3', '28-1', '34-4', '36-1', '42-1', '45-1', '51-3', '53-3', '58-2',
           '62-1', '62-4', '64-2', '67-4', '68-4', '70-4', '80-4', '82-4', '91-2'}
# Cut-outs whose corners are not black but that carry the same smeared streaks - repaired too.
STREAK_REPAIR = {'19-1', '20-4', '21-2', '21-4', '44-3', '47-2', '52-1', '55-4', '67-3', '77-2', '86-2', '96-2', '98-2'}
FILL_ENCLOSED = {'72-2'}      # rainbow: the hole in the middle was transparent too


def is_blank(a):
    return a.max() < 40 and a.mean() < 4


def is_cutout(a):
    h, w, _ = a.shape
    corners = [a[2, 2], a[2, w - 3], a[h - 3, 2], a[h - 3, w - 3]]
    return sum(int(p.sum()) < 30 for p in corners) >= 3


def repair(im, fill_enclosed=False):
    a = np.asarray(im.convert('RGB')).copy()
    h, w, _ = a.shape
    black = a.astype(int).sum(2) / 3 < 7
    close = np.all(np.abs(a[:, 1:].astype(int) - a[:, :-1].astype(int)) <= 5, axis=2)
    streak = np.zeros((h, w), bool)                       # runs that reach the left / right edge
    for y in range(h):
        row = close[y]
        x = 0
        while x < w - 1 and row[x]:
            x += 1
        if x >= 10:
            streak[y, :x + 1] = True
        x = w - 2
        while x >= 0 and row[x]:
            x -= 1
        if w - 2 - x >= 10:
            streak[y, x + 1:] = True
    lab, _ = ndi.label(black | streak)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    if fill_enclosed:
        lab2, n = ndi.label(black)
        for i in range(1, n + 1):
            if (lab2 == i).sum() > 2500:
                bg |= lab2 == i
    bg = ndi.binary_erosion(bg, iterations=2)             # keep a thin dark outline round the subject
    a[bg] = CREAM
    return Image.fromarray(a), bg.mean()


def energy(im):
    edges = im.convert('L').resize((64, 64)).filter(ImageFilter.FIND_EDGES)
    sat = im.resize((16, 16)).convert('HSV').split()[1]
    return ImageStat.Stat(edges).mean[0] + ImageStat.Stat(sat).mean[0] * 0.25


def smart_cover(im, size):
    tw, th = size
    scale = max(tw / im.width, th / im.height)
    big = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if big.size == size:
        return big
    best, best_score, steps = (0, 0), -1, 9
    for i in range(steps):
        off = (0, round((big.height - th) * i / (steps - 1))) if big.height > th else (round((big.width - tw) * i / (steps - 1)), 0)
        crop = big.crop((off[0], off[1], off[0] + tw, off[1] + th))
        score = energy(crop) - 0.02 * abs(i - (steps - 1) / 2)
        if score > best_score:
            best, best_score = off, score
    return big.crop((best[0], best[1], best[0] + tw, best[1] + th))


def blur_fit(im, size):
    tw, th = size
    bg = smart_cover(im, size).filter(ImageFilter.GaussianBlur(22))
    bg = Image.blend(bg, Image.new('RGB', size, CREAM), 0.35)
    scale = min((tw - 24) / im.width, (th - 24) / im.height)
    fg = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    bg.paste(fg, ((tw - fg.width) // 2, (th - fg.height) // 2))
    return bg


def main():
    os.makedirs(THUMBS, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC, '*.webp')))
    before = sum(os.path.getsize(f) for f in files)
    missing = []
    for n, path in enumerate(files, 1):
        key = os.path.basename(path)[:-5]
        thumb = os.path.join(THUMBS, key + '.webp')
        im = Image.open(path).convert('RGB')
        arr = np.asarray(im)
        if key in DAMAGED or is_blank(arr):
            missing.append(key)
            os.remove(path)
            if os.path.exists(thumb):
                os.remove(thumb)
            continue
        if key in STREAK_REPAIR or (key not in KEEP_ORIGINAL and is_cutout(arr)):
            im, _ = repair(im, key in FILL_ENCLOSED)
        ratio = im.width / im.height
        out = smart_cover(im, FULL) if 0.9 <= ratio <= 2.0 else blur_fit(im, FULL)
        out.save(path, 'WEBP', quality=78, method=6)
        out.resize(THUMB, Image.LANCZOS).save(thumb, 'WEBP', quality=72, method=6)
        if n % 50 == 0:
            print(f'{n}/{len(files)}', file=sys.stderr)
    # manifest: keep slot order, null where the picture is gone
    text = open(MANIFEST, encoding='utf-8').read()
    start = text.index('{')
    end = text.index('};', start) + 1
    manifest = json.loads(text[start:end])
    for sid, paths in manifest.items():
        manifest[sid] = [p if p and os.path.exists(os.path.join(ROOT, p)) else None for p in paths]
    open(MANIFEST, 'w', encoding='utf-8').write(
        'window.IMG_MANIFEST = ' + json.dumps(manifest, indent=1, ensure_ascii=False) + ';\n')
    after = sum(os.path.getsize(f) for f in glob.glob(os.path.join(SRC, '*.webp')))
    th = sum(os.path.getsize(f) for f in glob.glob(os.path.join(THUMBS, '*.webp')))
    print(f'{len(files)} images | missing -> emoji panel: {len(missing)} | stories {before/1e6:.1f} MB -> {after/1e6:.1f} MB | thumbs {th/1e6:.1f} MB')


if __name__ == '__main__':
    main()
