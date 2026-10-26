# Sanu Ki Kahaniyan

A Hindi storybook website for Sanu, built as a dependency-free static site for GitHub Pages.

## Project layout

```text
index.html
css/styles.css            whole jungle theme (tokens, splash, nav, cards, reader, night mode)
js/stories.js             stories 1-15   (Panchatantra)
js/stories-part2.js       stories 16-25  (Jataka) + 26-40 (Akbar-Birbal)
js/stories-part3.js       stories 41-50  (Tenali Raman)
js/stories-part4.js       stories 51-70  (moral stories)
js/stories-part5.js       stories 71-85  (fairy tales)
js/stories-part6.js       stories 86-95  (nature stories)
js/stories-part7.js       stories 96-100 (Sanu's adventures)
js/img-manifest.js        window.IMG_MANIFEST - illustration files per story
js/app.js                 catalog, reader, search, bookmarks, ratings, progress, TTS
assets/img/stories/       story illustrations, all 800x600 (4:3)
assets/img/thumbs/        400x300 thumbnails used by the home-page cards
assets/img/splash-bg.webp splash painting
assets/img/hero-banner.webp home page banner (deer, peacock, frog, butterfly)
assets/img/credits.json   photographer credit for every image file
tools/fetch_images.py     Pixabay downloader that builds the manifest and credits
tools/normalize_images.py repairs damaged files, makes every picture 4:3, builds thumbnails
tools/make_scene_art.js   draws kid-friendly illustrations for missing / duplicated slots
tools/duplicates.json     slots whose picture was a duplicate (replaced by drawn art)
tools/subjects.json       per-story illustration subject
tools/assign_heroes.py    stable hero-name assignment per story
```

## The stories

100 stories in eight categories:

| Category | Stories | Count |
| --- | --- | --- |
| पंचतंत्र | 1-15 | 15 |
| जातक कथाएँ | 16-25 | 10 |
| अकबर-बीरबल | 26-40 | 15 |
| तेनाली रामन | 41-50 | 10 |
| नैतिक कहानियाँ | 51-70 | 20 |
| परियों की कहानियाँ | 71-85 | 15 |
| प्रकृति की कहानियाँ | 86-95 | 10 |
| सानू के कारनामे | 96-100 | 5 |

Every story has four illustrated scenes and a one-line moral. Stories 51-100 are newly written
(roughly 320-460 words each); stories 1-50 are the original Panchatantra, Jataka, Akbar-Birbal and
Tenali tales.

### Rotating heroes

Story text is written with `सानू` as a placeholder. `tools/assign_heroes.py` gives each story one
steady hero - नानू (30 stories), लक्षु (29), रूबी (24), सानू (11) and कुकु (6) - and rewrites that
story's title, every scene and the moral. The assignment is seeded, so it is stable across runs.
All heroes are written with feminine verb forms.

## Illustrations

* 400 watercolour / cartoon storybook illustrations, four per story, downloaded from Pixabay under
  the Pixabay Content License.
* No picture is reused: duplicates found by `tools/normalize_images.py` runs were removed, and every slot that had
  no usable picture (damaged, blank or duplicated - 94 in all) now has its own illustration drawn by
  `node tools/make_scene_art.js` from that scene's data (characters, scenery and colours in `js/stories*.js`).
  Frightening emoji are swapped for gentler ones. Run order for a fresh checkout: `normalize_images.py`, then
  `make_scene_art.js`.
* Each story has its own subject in `tools/subjects.json`; a picture is only accepted when Pixabay's
  tags mention that subject, so the art matches the story.
* Every picture is 800x600 (4:3) and every card / scene frame is 4:3, so nothing looks square or tall.
  `tools/normalize_images.py` crops pictures that are close to 4:3 and shows tall or wide ones whole on a
  blurred copy of themselves. Cards load 400x300 thumbnails (`assets/img/thumbs/`); the reader loads the full file.
* Some downloads had lost their transparency (black backgrounds, colour streaks, or fully black files).
  The script repairs what it can; slots it cannot repair are `null` in `js/img-manifest.js` and the reader shows
  the scene's emoji panel instead.
* Attribution for each file is in `assets/img/credits.json`.

### Refreshing the art

```bash
PIXABAY_KEY=your_key python3 tools/fetch_images.py --ids 1,2,3 --force
PIXABAY_KEY=your_key python3 tools/fetch_images.py --special
```

The key is read from the environment only; it is never written to a file.

## Reader layout

Every scene is one card with a 4:3 picture and large text. On wide screens the picture alternates left / right;
on phones the picture sits on top. A reading-progress bar runs under the header, and A- / A+, auto-scroll and
read-aloud work on the reader itself.

## Live site

The site is published at [dhakaphoenix-a11y.github.io/sanu-ki-kahaniyan](https://dhakaphoenix-a11y.github.io/sanu-ki-kahaniyan/).
Source code is in the public [GitHub repository](https://github.com/dhakaphoenix-a11y/sanu-ki-kahaniyan).

GitHub Pages is enabled from the `main` branch at the repository root. New commits to `main` publish
automatically.
