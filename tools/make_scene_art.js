#!/usr/bin/env node
/* Draws a fresh, kid-friendly illustration for every scene slot that has no usable picture:
 *   - slots that are `null` in js/img-manifest.js (damaged / blank downloads)
 *   - slots listed in tools/duplicates.json (the same picture was used in several stories)
 *   - slots listed in tools/unsuitable.json (stock photos judged not suitable for a 5-year-old, or not matching the story)
 * Each picture comes from the scene's own data in js/stories*.js: its characters (emoji), its
 * background colours and its scenery emoji, so it always matches what the text says.
 *
 *   npm i puppeteer            # once
 *   node tools/make_scene_art.js [--chrome /path/to/chrome]
 *
 * Writes assets/img/stories/N-k.webp (800x600) and assets/img/thumbs/N-k.webp (400x300) and
 * updates js/img-manifest.js.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };

const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': types[path.extname(p)] || 'application/octet-stream'}); res.end(d); });
});

// Gentler stand-ins so nothing frightening reaches a 5-year-old.
const SOFT = {'😈': '😠', '👿': '😠', '😱': '😮', '😨': '😟', '😰': '😟', '😭': '😢', '💔': '💛', '🤯': '😮',
              '💊': '🌡️', '🗡️': '🛡️', '🗡': '🛡️', '⚔️': '🛡️', '💀': '😴', '☠️': '😴', '👻': '🌙', '🔪': '🍎', '💣': '🎈', '🩸': '🍓'};
const soft = e => SOFT[e] || e;

function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function artHtml(story, scene, index) {
  const art = scene.image || {};
  const seg = new Intl.Segmenter('en', {granularity: 'grapheme'});
  const main = [...seg.segment(art.emoji || story.emoji)].map(s => soft(s.segment)).filter(s => s.trim());
  const deco = (art.bgEmojis || []).slice(0, 2).map(soft);
  const h = hash(story.id + ':' + index);
  const size = Math.min(290, Math.floor(660 / Math.max(1, main.length) * 0.82));
  const sparkles = Array.from({length: 7}, (_, i) => {
    const r = hash(h + ':' + i);
    return `<i class="sp" style="left:${6 + r % 88}%;top:${4 + (r >> 8) % 60}%;font-size:${14 + (r >> 16) % 18}px;opacity:${0.35 + (r % 5) / 10}">✦</i>`;
  }).join('');
  const lift = main.map((_, i) => `transform:translateY(${i % 2 ? 16 : -10}px) rotate(${(i % 3 - 1) * 4}deg)`);
  return `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}
    html,body{width:800px;height:600px;overflow:hidden}
    body{position:relative;background:${art.bg || story.bgGradient};font-family:'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif}
    .glow{position:absolute;inset:0;background:radial-gradient(ellipse 60% 55% at ${25 + h % 50}% 28%,rgba(255,255,255,.42),transparent 70%)}
    .cloud{position:absolute;background:rgba(255,255,255,.5);border-radius:999px;filter:blur(1px)}
    .cloud::before,.cloud::after{content:'';position:absolute;background:inherit;border-radius:50%}
    .cloud::before{width:46%;height:150%;left:14%;top:-70%}.cloud::after{width:36%;height:120%;right:12%;top:-45%}
    .hill{position:absolute;border-radius:50%}
    .h1{left:-12%;bottom:-34%;width:80%;height:56%;background:rgba(255,255,255,.30)}
    .h2{right:-18%;bottom:-40%;width:92%;height:60%;background:rgba(0,0,0,.10)}
    .sp{position:absolute;color:#fff;font-style:normal}
    .deco{position:absolute;font-size:96px;line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.18))}
    .stage{position:absolute;left:0;right:0;top:25%;height:62%;display:flex;align-items:center;justify-content:center;gap:${main.length > 2 ? 0 : 24}px}
    .hero{font-size:${size}px;line-height:1;filter:drop-shadow(0 14px 12px rgba(0,0,0,.28));display:block}
    .shadow{position:absolute;left:50%;bottom:7%;width:${Math.min(620, main.length * size * 0.9)}px;height:34px;transform:translateX(-50%);background:radial-gradient(ellipse,rgba(0,0,0,.28),transparent 70%)}
  </style>
  <div class="glow"></div>
  <div class="cloud" style="left:${5 + h % 20}%;top:${8 + h % 9}%;width:150px;height:34px"></div>
  <div class="cloud" style="right:${6 + (h >> 4) % 18}%;top:${20 + (h >> 7) % 12}%;width:110px;height:26px;opacity:.8"></div>
  <div class="hill h1"></div><div class="hill h2"></div>
  ${sparkles}
  ${deco[0] ? `<div class="deco" style="left:7%;top:7%;transform:rotate(-8deg)">${deco[0]}</div>` : ''}
  ${deco[1] ? `<div class="deco" style="right:7%;top:9%;transform:rotate(9deg)">${deco[1]}</div>` : ''}
  <div class="shadow"></div>
  <div class="stage">${main.map((e, i) => `<span class="hero" style="${lift[i]}">${e}</span>`).join('')}</div>`;
}

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await puppeteer.launch({executablePath: arg('--chrome'), headless: 'new', args: ['--no-sandbox']});
  const page = await browser.newPage();
  await page.setViewport({width: 800, height: 600, deviceScaleFactor: 1});
  await page.goto(`http://localhost:${port}/`, {waitUntil: 'load'});
  const {stories, manifest} = await page.evaluate(() => ({stories: STORIES, manifest: IMG_MANIFEST}));
  const dups = new Set(['duplicates.json', 'unsuitable.json'].flatMap(f => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')); } catch { return []; } }));
  const slots = [];
  for (const s of stories) (manifest[s.id] || []).forEach((p, i) => { if (!p || dups.has(`${s.id}-${i + 1}`)) slots.push([s, i]); });
  fs.mkdirSync(path.join(ROOT, 'assets/img/thumbs'), {recursive: true});
  for (const [story, i] of slots) {
    await page.setContent(artHtml(story, story.scenes[i % story.scenes.length], i), {waitUntil: 'load'});
    await page.evaluate(() => document.fonts.ready);
    const name = `${story.id}-${i + 1}.webp`;
    const full = {x: 0, y: 0, width: 800, height: 600};
    await page.screenshot({path: path.join(ROOT, 'assets/img/stories', name), type: 'webp', quality: 82, clip: full});
    await page.screenshot({path: path.join(ROOT, 'assets/img/thumbs', name), type: 'webp', quality: 78, clip: {...full, scale: 0.5}});
    manifest[story.id][i] = `assets/img/stories/${name}`;
  }
  fs.writeFileSync(path.join(ROOT, 'js/img-manifest.js'), 'window.IMG_MANIFEST = ' + JSON.stringify(manifest, null, 1) + ';\n');
  console.log(`drew ${slots.length} illustrations`);
  await browser.close(); server.close();
});
