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

## Publish with GitHub Pages

To publish:

1. Create a GitHub repository for this project and push these files to its `main` branch.
2. In the repository, open **Settings → Pages**.
3. Set the build source to **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. GitHub will show the published URL in the Pages settings once its deployment finishes.

