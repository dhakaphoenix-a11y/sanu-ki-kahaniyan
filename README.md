# Sanu Ki Kahaniyan

A Hindi storybook website for Sanu, designed as a static site for GitHub Pages.

## Project layout

```text
index.html
css/styles.css
js/stories.js
js/stories-part2.js
js/stories-part3.js
js/app.js
```

## Source review

The supplied `sanu stories.txt` is a conversation transcript containing multiple drafts and code blocks, not a single complete source bundle. The extracted page includes a splash screen, a story catalog, and responsive styling. Its 50 stories (IDs 1–50) are split across three JavaScript files. The app supports night mode, read aloud, search, bookmarks, ratings, progress, font sizing, auto-scroll, and swipe navigation.

The source transcript needed cleanup before deployment:

- The transcript's original app script and story blocks were malformed by interleaved conversation text. The project now has separated story data files and a rewritten app script.
- The transcript acknowledges that stories 51–100 were not completed, so this release contains 50 stories.
- Illustrations are colorful emoji and CSS story scenes; the transcript does not provide 3–4 authored image files for every story.

The page is a dependency-free static site. Google Fonts are optional; the browser's fallback fonts are used if they are unavailable.

## Live site

The site is published at [dhakaphoenix-a11y.github.io/sanu-ki-kahaniyan](https://dhakaphoenix-a11y.github.io/sanu-ki-kahaniyan/). Source code is in the public [GitHub repository](https://github.com/dhakaphoenix-a11y/sanu-ki-kahaniyan).

GitHub Pages is enabled from the `main` branch at the repository root. New commits to `main` publish automatically.


