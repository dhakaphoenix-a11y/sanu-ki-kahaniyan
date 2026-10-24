let currentCategory = 'all';
let currentStoryId = null;
let autoScrollTimer = null;
let fontScale = 1;
let speaking = false;

const categoryInfo = [
  ['panchatantra', 'पंचतंत्र', '🦁'], ['jataka', 'जातक कथाएँ', '🪷'],
  ['akbar-birbal', 'अकबर-बीरबल', '👑'], ['tenali', 'तेनाली रामन', '🎭'],
  ['moral', 'नैतिक कहानियाँ', '💡'], ['fairy', 'परियों की कहानियाँ', '🧚'],
  ['nature', 'प्रकृति की कहानियाँ', '🌿'], ['adventure', 'सानू के कारनामे', '🚀']
];
const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(`sanu_${key}`)) ?? fallback; } catch { return fallback; } };
const writeStore = (key, value) => { try { localStorage.setItem(`sanu_${key}`, JSON.stringify(value)); } catch {} };
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const byId = id => document.getElementById(id);
const READER_LAYOUTS = ['layout-side-left', 'layout-side-right', 'layout-stack', 'layout-overlay', 'layout-image-top', 'layout-image-bottom'];
const imageList = story => (window.IMG_MANIFEST && window.IMG_MANIFEST[story.id]) || [];

function sceneFigure(story, scene, index, eager) {
  const images = imageList(story);
  const image = images.length ? images[index % images.length] : null;
  const badge = `<span class="scene-number">${index + 1} / ${story.scenes.length}</span>`;
  if (!image) {
    return `<figure class="scene-figure scene-figure--plain" style="background:${escapeHtml(scene.image?.bg || story.bgGradient)}"><span class="scene-emoji">${escapeHtml(scene.image?.emoji || story.emoji)}</span>${badge}</figure>`;
  }
  return `<figure class="scene-figure"><img src="${escapeHtml(image)}" alt="${escapeHtml(story.title)} का दृश्य ${index + 1}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">${badge}</figure>`;
}

function sceneMarkup(story, scene, index) {
  const layout = READER_LAYOUTS[(story.id + index) % READER_LAYOUTS.length];
  return `<section class="story-scene ${layout}">${sceneFigure(story, scene, index, index === 0)}<p class="story-segment-text">${escapeHtml(scene.text)}</p></section>`;
}

function cardThumb(story) {
  const image = imageList(story)[0];
  if (!image) return `<div class="story-illustration" style="background:${escapeHtml(story.bgGradient)}"><span>${escapeHtml(story.emoji)}</span></div>`;
  return `<img src="${escapeHtml(image)}" alt="${escapeHtml(story.title)}" loading="lazy" decoding="async">`;
}

function showToast(message) {
  const toast = byId('toast');
  if (!toast) return;
  byId('toast-message').textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

function enterWebsite() {
  byId('splash-screen')?.classList.add('hidden');
  byId('main-app')?.classList.remove('hidden');
}

function toggleSidebar() {
  const sidebar = byId('sidebar');
  const overlay = byId('sidebar-overlay');
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('hidden');
}

function filterCategory(category) {
  currentCategory = category;
  byId('home-page')?.classList.remove('hidden');
  byId('story-reader')?.classList.add('hidden');
  byId('bookmarks-page')?.classList.add('hidden');
  byId('progress-page')?.classList.add('hidden');
  byId('floating-mascot')?.classList.remove('hidden');
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
  document.querySelector(`.sidebar-item[onclick="filterCategory('${category}')"]`)?.classList.add('active');
  renderStories(category);
  byId('stories-section')?.scrollIntoView({behavior:'smooth', block:'start'});
  if (!byId('sidebar-overlay')?.classList.contains('hidden')) toggleSidebar();
}

function renderStories(category = 'all') {
  const grid = byId('stories-grid');
  if (!grid) return;
  const stories = category === 'all' ? STORIES : STORIES.filter(story => story.category === category);
  const reads = readStore('readStories', []);
  const favorites = readStore('bookmarks', []);
  const ratings = readStore('ratings', {});
  const label = categoryInfo.find(item => item[0] === category)?.[1] || 'सभी कहानियाँ';
  byId('stories-section-title').textContent = `${category === 'all' ? '📖' : categoryInfo.find(item => item[0] === category)?.[2] || '📖'} ${label} (${stories.length})`;
  byId('back-to-cats').style.display = category === 'all' ? 'none' : 'inline-flex';
  grid.innerHTML = stories.map(story => `
    <article class="story-card" role="button" tabindex="0" onclick="openStory(${story.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openStory(${story.id})}">
      <div class="story-card-image">${cardThumb(story)}</div>
      <div class="story-card-body"><div class="story-card-category">${escapeHtml(story.categoryLabel)}</div><h3 class="story-card-title">${escapeHtml(story.title)}</h3>
      <div class="story-card-meta"><span>📖 ${story.scenes.length} चित्र</span><span>${reads.includes(story.id)?'✅ पढ़ी':''} ${favorites.includes(story.id)?'❤️':''} ${ratings[story.id]?'⭐'.repeat(ratings[story.id]):''}</span></div></div>
    </article>`).join('') || '<div class="empty-state"><span class="empty-emoji">📚</span><p>इस श्रेणी में अभी कहानियाँ नहीं हैं।</p></div>';
  categoryInfo.forEach(([key]) => {
    const count = STORIES.filter(story => story.category === key).length;
    const el = byId(`count-${key}`); if (el) el.textContent = count;
    const button = document.querySelector(`.sidebar-item[onclick="filterCategory('${key}')"]`);
    if (button) button.hidden = count === 0;
    const cards = document.querySelectorAll(`.category-card[onclick="filterCategory('${key}')"]`);
    cards.forEach(card => card.hidden = count === 0);
  });
  const allCount = byId('count-all'); if (allCount) allCount.textContent = STORIES.length;
  updateBookmarkCount();
}

function openStory(id) {
  const story = STORIES.find(item => item.id === Number(id));
  if (!story) return;
  currentStoryId = story.id;
  const read = readStore('readStories', []);
  if (!read.includes(story.id)) { read.push(story.id); writeStore('readStories', read); }
  const savedRating = readStore('ratings', {})[story.id] || 0;
  const bookmarked = readStore('bookmarks', []).includes(story.id);
  byId('home-page').classList.add('hidden'); byId('bookmarks-page').classList.add('hidden'); byId('progress-page').classList.add('hidden');
  byId('story-reader').classList.remove('hidden'); byId('floating-mascot').classList.add('hidden');
  byId('reader-content').innerHTML = `
    <header class="story-reader-header"><span>${escapeHtml(story.categoryLabel)}</span><h1>${escapeHtml(story.title)}</h1></header>
    ${story.scenes.map((scene, index) => sceneMarkup(story, scene, index)).join('')}
    <aside class="moral-box"><strong>🌟 कहानी की सीख</strong><p>${escapeHtml(story.moral)}</p></aside>`;
  byId('bookmark-btn').textContent = bookmarked ? '❤️' : '🤍';
  document.querySelectorAll('.star-btn').forEach((button,index) => button.classList.toggle('active', index < savedRating));
  byId('prev-story-btn').disabled = !getAdjacentStory(-1);
  byId('next-story-btn').disabled = !getAdjacentStory(1);
  window.scrollTo({top:0, behavior:'smooth'});
  renderStories(currentCategory);
}

function getAdjacentStory(direction) {
  const list = currentCategory === 'all' ? STORIES : STORIES.filter(story => story.category === currentCategory);
  const index = list.findIndex(story => story.id === currentStoryId);
  return list[index + direction] || null;
}
function closeStory() { stopAutoScroll(); stopSpeaking(); byId('story-reader').classList.add('hidden'); byId('home-page').classList.remove('hidden'); byId('floating-mascot').classList.remove('hidden'); renderStories(currentCategory); window.scrollTo({top:0,behavior:'smooth'}); }
function goHome() { currentCategory = 'all'; closeStory(); }
function prevStory() { const story = getAdjacentStory(-1); if (story) openStory(story.id); }
function nextStory() { const story = getAdjacentStory(1); if (story) openStory(story.id); }

function toggleBookmark() {
  const items = readStore('bookmarks', []); const index = items.indexOf(currentStoryId);
  if (index >= 0) items.splice(index,1); else items.push(currentStoryId);
  writeStore('bookmarks',items); byId('bookmark-btn').textContent = index >= 0 ? '🤍' : '❤️';
  updateBookmarkCount(); showToast(index >= 0 ? 'पसंदीदा से हटाया' : 'पसंदीदा में जोड़ा!');
}
function updateBookmarkCount() { const count = byId('count-bookmarks'); if (count) count.textContent = readStore('bookmarks',[]).length; }
function showBookmarks() {
  if (!byId('sidebar-overlay').classList.contains('hidden')) toggleSidebar();
  const list = STORIES.filter(story => readStore('bookmarks',[]).includes(story.id));
  byId('home-page').classList.add('hidden'); byId('story-reader').classList.add('hidden'); byId('progress-page').classList.add('hidden'); byId('bookmarks-page').classList.remove('hidden');
  byId('bookmarks-grid').innerHTML = list.map(story => `<article class="story-card" onclick="openStory(${story.id})"><div class="story-card-image">${cardThumb(story)}</div><div class="story-card-body"><div class="story-card-category">${escapeHtml(story.categoryLabel)}</div><h3 class="story-card-title">${escapeHtml(story.title)}</h3></div></article>`).join('') || '<div class="empty-state"><span class="empty-emoji">🔖</span><p>अभी कोई पसंदीदा कहानी नहीं है।</p><p>कहानी में ❤️ दबाकर यहाँ जोड़ें।</p></div>';
}
function rateStory(stars) { const ratings = readStore('ratings',{}); ratings[currentStoryId] = stars; writeStore('ratings',ratings); document.querySelectorAll('.star-btn').forEach((button,index)=>button.classList.toggle('active',index<stars)); renderStories(currentCategory); showToast('⭐ रेटिंग सहेजी गई'); }

function toggleNightMode() { document.body.classList.toggle('night-mode'); const enabled=document.body.classList.contains('night-mode'); writeStore('nightMode',enabled); byId('night-mode-btn').textContent=enabled?'☀️':'🌙'; }
function increaseFontSize() { fontScale=Math.min(fontScale+0.1,1.6); applyFontSize(); }
function decreaseFontSize() { fontScale=Math.max(fontScale-0.1,0.8); applyFontSize(); }
function applyFontSize() { document.querySelectorAll('.story-segment-text').forEach(el=>el.style.fontSize=`${fontScale}rem`); }
function toggleAutoScroll() { if(autoScrollTimer){stopAutoScroll();return;} byId('auto-scroll-btn').textContent='⏸️'; autoScrollTimer=setInterval(()=>{window.scrollBy(0,1);if(innerHeight+scrollY>=document.body.scrollHeight-2)stopAutoScroll();},35); }
function stopAutoScroll() { clearInterval(autoScrollTimer);autoScrollTimer=null;if(byId('auto-scroll-btn'))byId('auto-scroll-btn').textContent='▶️'; }
function readAloud() {
  if (!('speechSynthesis' in window)) { showToast('इस डिवाइस पर पढ़कर सुनाना उपलब्ध नहीं है'); return; }
  if(speaking){speechSynthesis.cancel();speaking=false;byId('read-aloud-btn').textContent='🔊';return;}
  const story=STORIES.find(item=>item.id===currentStoryId); if(!story)return;
  const text=[story.title,...story.scenes.map(scene=>scene.text),'कहानी की सीख',story.moral].join('। ');
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='hi-IN';utterance.rate=0.85;
  const voice=speechSynthesis.getVoices().find(item=>item.lang.toLowerCase().startsWith('hi'));if(voice)utterance.voice=voice;
  utterance.onstart=()=>{speaking=true;byId('read-aloud-btn').textContent='🔇';};
  utterance.onend=utterance.onerror=()=>{speaking=false;byId('read-aloud-btn').textContent='🔊';};
  speechSynthesis.cancel();speechSynthesis.speak(utterance);
}
function stopSpeaking(){if('speechSynthesis'in window)speechSynthesis.cancel();speaking=false;if(byId('read-aloud-btn'))byId('read-aloud-btn').textContent='🔊';}

function toggleSearch() { const bar=byId('search-bar');bar.classList.toggle('hidden');if(!bar.classList.contains('hidden'))byId('search-input').focus();else{byId('search-input').value='';byId('search-results').innerHTML='';} }
function searchStories(query) {
  const results=byId('search-results');if(query.trim().length<2){results.innerHTML='';return;}
  const q=query.trim().toLocaleLowerCase('hi');
  const matches=STORIES.filter(story=>[story.title,story.categoryLabel,story.moral,...story.scenes.map(scene=>scene.text)].join(' ').toLocaleLowerCase('hi').includes(q)).slice(0,12);
  results.innerHTML=matches.map(story=>`<button class="search-result-item" onclick="openStory(${story.id});toggleSearch()"><span>${escapeHtml(story.emoji)}</span><span><b>${escapeHtml(story.title)}</b><small>${escapeHtml(story.categoryLabel)}</small></span></button>`).join('') || '<div class="search-result-item">कोई कहानी नहीं मिली 😔</div>';
}
function showProgress() {
  if (!byId('sidebar-overlay').classList.contains('hidden')) toggleSidebar();
  byId('home-page').classList.add('hidden');byId('story-reader').classList.add('hidden');byId('bookmarks-page').classList.add('hidden');byId('progress-page').classList.remove('hidden');updateProgressStats();
}
function updateProgressStats() {
  const reads=readStore('readStories',[]),ratings=Object.values(readStore('ratings',{})),saved=readStore('bookmarks',[]);
  const percent=Math.round(reads.length/STORIES.length*100);byId('progress-text').textContent=`${percent}%`;byId('stories-read-count').textContent=`${reads.length} / ${STORIES.length}`;byId('avg-rating').textContent=ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1):'0';byId('fav-count').textContent=saved.length;byId('streak-count').textContent=readStore('streak',0);
  const ring=byId('progress-ring');if(ring){const c=2*Math.PI*54;ring.style.strokeDasharray=c;ring.style.strokeDashoffset=c*(1-percent/100);}
  byId('category-progress').innerHTML=categoryInfo.filter(([key])=>STORIES.some(s=>s.category===key)).map(([key,label,emoji])=>{const list=STORIES.filter(s=>s.category===key),read=list.filter(s=>reads.includes(s.id)).length;return `<div class="cat-progress-item"><div class="cat-progress-header"><span>${emoji} ${label}</span><span>${read}/${list.length}</span></div><div class="cat-progress-bar"><div class="cat-progress-fill" style="width:${read/list.length*100}%"></div></div></div>`;}).join('');
}
function updateStreak(){const today=new Date().toDateString(),last=readStore('lastReadDate','');let streak=readStore('streak',0);if(last!==today){const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);streak=last===yesterday.toDateString()?streak+1:1;writeStore('streak',streak);writeStore('lastReadDate',today);}}
const mascotMessages=['नमस्ते सानू! कहानी पढ़ो! 📖','आज कौन सी कहानी?','गोलू खरगोश तैयार है! 🐰','कहानी में मज़ा आएगा! ✨'];
function mascotSpeak(){const bubble=byId('mascot-bubble');if(!bubble)return;byId('mascot-message').textContent=mascotMessages[Math.floor(Math.random()*mascotMessages.length)];bubble.classList.remove('hidden');setTimeout(()=>bubble.classList.add('hidden'),2800);}

document.addEventListener('DOMContentLoaded',()=>{
  if(readStore('nightMode',false))document.body.classList.add('night-mode');
  byId('night-mode-btn').textContent=document.body.classList.contains('night-mode')?'☀️':'🌙';
  updateStreak();renderStories('all');updateProgressStats();
  setTimeout(mascotSpeak,2500);
});
let touchX=0;document.addEventListener('touchstart',event=>touchX=event.changedTouches[0].screenX,{passive:true});
document.addEventListener('touchend',event=>{if(byId('story-reader').classList.contains('hidden'))return;const dx=touchX-event.changedTouches[0].screenX;if(Math.abs(dx)>90)(dx>0?nextStory:prevStory)();},{passive:true});
