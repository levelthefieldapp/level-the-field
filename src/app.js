/* ================= the frame around every page ================= */
const $ = id => document.getElementById(id);
const view = $('view'), pop = $('pop');
/* Six doors. The front page is this week. Every other section opens on its main page and shows a short row of its own
   pages under the header, so the pages that belong together are always one click apart. */
const SECTIONS = [
  {k:'home', label:'This week', pages:[]},
  {k:'rankings', label:'Rankings', pages:[['rankings','LTF rankings'],['conferences','Conferences'],['momentum','Momentum'],['radar','Under the radar'],['reputation','Reputation gap'],['luck','Luck'],['weights','Build your own']]},
  {k:'games', label:'Games', pages:[['games','Scores and schedule'],['picks','Picks'],['spread','Spread'],['recap','Recap']]},
  {k:'teams', label:'Teams', pages:[['teams','All teams'],['stats','Stats'],['compare','Compare'],['blind','Blind résumé']]},
  {k:'playoff', label:'Playoff', pages:[['playoff','Bracket'],['odds','Season odds']]},
  {k:'scorecard', label:'Track record', pages:[['scorecard','Scorecard'],['track','LTF track record'],['model','Model tracker'],['how','How it works'],['about','About']]},
];
const PARENT = {team:'teams', game:'games', conference:'conferences', contact:'about'};      // a detail page lights up the page it sits under
const ALLPAGES = [...SECTIONS.flatMap(s => s.pages), ['contact','Contact']];
const sectionOf = page => SECTIONS.find(s => s.k === page || s.pages.some(p => p[0] === page)) || null;
const VIEWS = {home:viewHome, rankings:viewRankings, teams:viewTeams, team:viewTeam, conferences:viewConferences, conference:viewConference,
               games:viewGames, game:viewGame, stats:viewStats, compare:viewCompare, playoff:viewPlayoff, radar:viewRadar, spread:viewSpread,
               track:viewTrack, weights:viewWeights, how:viewHow, about:viewAbout, contact:viewContact, picks:viewPicks, recap:viewRecap, odds:viewOdds, model:viewModel, reputation:viewReputation, blind:viewBlind, luck:viewLuck, momentum:viewMomentum, scorecard:viewScorecard};
function ribbon(){
  const games = nextGames().filter(x => x.pr).sort((a,b) => Math.min(byName[a.g.h].rank, byName[a.g.a].rank) - Math.min(byName[b.g.h].rank, byName[b.g.a].rank)).slice(0,16);
  if (!games.length) return `<div class="rib-h">Season complete<small>Final LTF Index</small></div><a class="gm all" href="${L('rankings')}">Final rankings</a>`;
  const side = n => { const t = byName[n]; return `<span class="t">${logoOf(t) ? badge(t,'xs') : `<i style="background:${esc(t.col)}"></i>`}${esc(t.ab)} <small>${t.rank}</small></span>`; };
  return `<div class="rib-h">Week ${M.next}<small>LTF lines</small></div>` + games.map(x => `<a class="gm" href="${gameL(x.g)}" title="${esc(x.g.a)} ${x.g.n?'vs':'at'} ${esc(x.g.h)}">${side(x.g.a)}${side(x.g.h)}<span class="ln">LTF line<b>${lineTxt(x.pr, true)}</b></span></a>`).join('')
    + `<a class="gm all" href="${L('games')}">All ${G.filter(g => g.w === M.next).length} games</a>`;
}
function shell(){
  const here = PARENT[R.page] || R.page, sec = sectionOf(here), cur = k => k === here ? ' aria-current="page"' : '';
  const links = arr => arr.map(([k,l]) => `<a href="${L(k)}"${cur(k)}>${l}</a>`).join('');
  $('nav').innerHTML = SECTIONS.map(s => `<a href="${L(s.k)}"${s === sec ? (s.pages.length ? ' class="on"' : ' aria-current="page"') : ''}>${s.label}</a>`).join('');
  const sub = sec && sec.pages.length ? sec.pages : null;
  $('subbar').hidden = !sub; $('subnav').innerHTML = sub ? `<span class="sublab">${sec.label}</span>${links(sub)}` : '';
  if (sub){ const on = $('subnav').querySelector('[aria-current]'); if (on && on.scrollIntoView) try { on.scrollIntoView({block:'nearest', inline:'center'}); } catch(e){} }
  $('menunav').innerHTML = SECTIONS.map(s => s.pages.length ? `<h3>${s.label}</h3>${links(s.pages)}` : `<a class="top" href="${L(s.k)}"${cur(s.k)}>${s.label}</a>`).join('') + `<h3>The site</h3>${links([['contact','Contact']])}`;
  document.querySelectorAll('a.brand').forEach(a => { a.setAttribute('href', L('home')); });
  $('ribbon').innerHTML = ribbon();
  const col = (h, arr) => `<div><h3>${h}</h3>${arr.map(([k,l]) => `<a href="${L(k)}">${l}</a>`).join('')}</div>`;
  const off = store.get('ltf.logos') === false;
  $('foot').innerHTML = `<nav class="fnav" aria-label="Footer">${SECTIONS.filter(s => s.pages.length).map(s => col(s.label, s.k === 'scorecard' ? [...s.pages, ['contact','Contact']] : s.pages)).join('')}</nav>
    <p class="fine"><b>${esc(BRAND)}</b> Every team, one scale. ${M.season} season, LTF Index through week ${M.through}. Updated ${builtTxt(true)}.${STALE ? ' The daily update has not run since then.' : ''}</p>
    ${LOGO_OK && !LOGOS_OFF ? `<p class="fine">Team logos are ${off ? 'off' : 'on'}. <button type="button" class="more inl" data-logos="${off ? 'on' : 'off'}">${off ? 'Show logos' : 'Use team colors instead'}</button></p>` : ''}
    <p class="fine">For information and entertainment. Nothing here is betting advice. This site is independent and is not connected to any school, conference or sportsbook. Team names, colors and logos belong to the schools. Data from the public cfbfastR data sets and the CollegeFootballData.com API.</p>`;
}
function controls(show){
  $('controls').hidden = !show; if (!show) return;
  const k = groupKey();
  $('groupseg').innerHTML = ['all','p4','g6'].map(g => `<a data-keep href="${Lq({group: g==='all' ? null : g})}" aria-current="${k===g}">${GROUPS[g]}</a>`).join('');
  $('conf').value = GROUPS[k] ? '' : k;
  const f = $('find'); if (document.activeElement !== f) f.value = R.q.find || '';
}
function chrome(){   // everything outside the page body
  shell();
  const note = customWeights() ? `<p class="wnote">You are seeing your own weights, not the LTF Index: ${COMP.map(c => `${c.name.toLowerCase()} ${share(c.k)}%`).join(', ')}. <button type="button" class="more inl" data-resetw="1">Back to the LTF Index</button></p>` : '';
  return note;
}
function render(){
  const wq = parseWeights(R.q.w);
  if (wq && weightStr(wq) !== weightStr(W)){ W = wq; store.set('ltf.weights', W); recompute(); }
  hidePop();
  const v = (VIEWS[R.page] || viewNotFound)();
  document.title = v.title ? `${v.title} | ${BRAND}` : BRAND;
  $('top').innerHTML = chrome() + (v.top || '');
  controls(!!v.controls);
  view.innerHTML = v.body;
  if (v.after) v.after();
}

/* ================= getting around ================= */
let cur = '#/';
const scrolls = {};
const toTop = y => { try { window.scrollTo(0, y || 0); } catch(e){} };
function setUrl(url, replace){
  let ok = false;
  try { history[replace ? 'replaceState' : 'pushState'](null, '', url); ok = true; } catch(e){}
  if (!ok){ try { if (replace) location.replace(url); else location.hash = url.slice(1); } catch(e){} }
  cur = url;
}
function go(url, opt = {}){
  if (!opt.replace) scrolls[cur] = window.scrollY || 0;
  setUrl(url, opt.replace); R = parse(url); closeMenus(); render();
  if (!opt.keep) toTop(0);
}
function onUrlChange(){   // back and forward buttons, or a typed address
  const url = location.hash || '#/';
  if (url === cur) return;
  scrolls[cur] = window.scrollY || 0; cur = url; R = parse(url); closeMenus(); render(); toTop(scrolls[url] || 0);
}
window.addEventListener('popstate', onUrlChange);
window.addEventListener('hashchange', onUrlChange);

/* ================= menu, search, definitions ================= */
function closeMenus(){
  document.body.classList.remove('menu-open'); $('menuBtn').setAttribute('aria-expanded', 'false');
  document.querySelectorAll('.sres').forEach(r => { r.hidden = true; });
  document.querySelectorAll('.gs').forEach(i => { i.value = ''; });
  document.querySelectorAll('.nav details[open]').forEach(d => { d.open = false; });
}
function searchResults(text){
  const q = text.trim().toLowerCase(); if (!q) return [];
  const teams = T.filter(t => t.n.toLowerCase().includes(q) || t.ab.toLowerCase() === q)
    .sort((a,b) => (b.n.toLowerCase().startsWith(q) - a.n.toLowerCase().startsWith(q)) || a.rank - b.rank).slice(0,7)
    .map(t => ({href:teamL(t), html:`${badge(t,'sm')}${esc(t.n)}<small>No. ${t.rank}, ${t.w}-${t.l}</small>`}));
  const confs = CONFS.filter(c => c.label.toLowerCase().includes(q)).slice(0,2).map(c => ({href:confL(c), html:`${esc(c.label)}<small>Conference</small>`}));
  const pages = [['home','This week'], ...ALLPAGES].filter(([k,l]) => l.toLowerCase().includes(q)).slice(0,2).map(([k,l]) => ({href:L(k), html:`${l}<small>Page</small>`}));
  return [...teams, ...confs, ...pages];
}
document.querySelectorAll('.search').forEach(box => {
  const input = box.querySelector('.gs'), res = box.querySelector('.sres');
  const show = () => { const r = searchResults(input.value);
    res.hidden = !input.value.trim();
    res.innerHTML = r.length ? r.map((x,i) => `<a href="${x.href}"${i===0?' class="on"':''}>${x.html}</a>`).join('') : `<p>No team or page matches "${esc(input.value)}".</p>`; };
  input.addEventListener('input', show);
  input.addEventListener('focus', () => { if (input.value.trim()) show(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter'){ const first = res.querySelector('a'); if (first){ e.preventDefault(); go(first.getAttribute('href')); input.blur(); } }
    else if (e.key === 'Escape'){ input.value = ''; res.hidden = true; }
  });
});
/* One pop-up serves both kinds of help. Pointing at a column heading or a dotted word shows it. Tapping a dotted word pins it open. */
let popFor = null, popPinned = false, popTimer = null;
function hidePop(){ clearTimeout(popTimer); pop.hidden = true; popFor = null; popPinned = false; }
function showPop(el, pin){
  const html = tipHtml(el.dataset.term || el.dataset.tip); if (!html) return;
  pop.innerHTML = html; pop.hidden = false; popFor = el; popPinned = !!pin;
  const r = el.getBoundingClientRect(), sx = window.scrollX || 0, sy = window.scrollY || 0, vw = document.documentElement.clientWidth, vh = window.innerHeight || 800;
  pop.style.left = clamp(r.left + sx - 6, sx + 8, sx + vw - pop.offsetWidth - 8) + 'px';
  const below = r.bottom + 8 + pop.offsetHeight <= vh || r.top < pop.offsetHeight + 16;
  pop.style.top = (below ? r.bottom + sy + 8 : r.top + sy - pop.offsetHeight - 8) + 'px';
}
document.addEventListener('mouseover', e => {
  const el = e.target.closest && e.target.closest('[data-tip],[data-term]'); if (!el || popPinned || el === popFor) return;
  clearTimeout(popTimer); popTimer = setTimeout(() => showPop(el, false), 140);
});
document.addEventListener('mouseout', e => {
  const el = e.target.closest && e.target.closest('[data-tip],[data-term]'); if (!el) return;
  if (el.contains(e.relatedTarget)) return;
  clearTimeout(popTimer); if (!popPinned) hidePop();
});
document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && !popPinned) showPop(el, false); });
document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('[data-tip]') && !popPinned) hidePop(); });

/* logos that fail to load fall back to the team's color mark */
document.addEventListener('error', e => {
  const el = e.target; if (!el || !el.dataset || !el.dataset.t) return;
  const t = bySlug[el.dataset.t]; if (!t) return;
  const isImg = el.tagName === 'IMG', src = isImg ? el.getAttribute('src') : (el.getAttribute('href') || '');
  if (/^logos\//.test(src) && !t.noLocal){ t.noLocal = true; const u = logoSrc(t, /^logos\/dark\//.test(src)); if (isImg) el.setAttribute('src', u); else el.setAttribute('href', u); return; }   // the local copy is missing, so try the public one
  if (/500-dark/.test(src) && !t.noDark){ t.noDark = true; const u = logoSrc(t, false); if (isImg) el.setAttribute('src', u); else el.setAttribute('href', u); return; }
  t.lgBad = true;
  if (isImg) el.outerHTML = chip(t, el.dataset.s || ''); else if (R.page === 'stats') plotDraw();
}, true);

/* ================= clicks and inputs ================= */
document.addEventListener('click', e => {
  const t = e.target.closest ? e.target : e.target.parentNode;
  const termBtn = t.closest('[data-term]');
  if (termBtn){ e.preventDefault(); if (popFor === termBtn && popPinned) hidePop(); else showPop(termBtn, true); return; }
  if (!t.closest('#pop')) hidePop();
  if (!t.closest('.search')) document.querySelectorAll('.sres').forEach(r => { r.hidden = true; });
  if (!t.closest('.nav details')) document.querySelectorAll('.nav details[open]').forEach(d => { d.open = false; });
  const a = t.closest('a');
  if (a){
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#/') && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){
      e.preventDefault(); const keep = a.hasAttribute('data-keep'); go(href, {replace: keep, keep});
    }
    return;
  }
  const b = t.closest('button'); if (!b) return;
  if (b.id === 'menuBtn'){ document.body.classList.add('menu-open'); b.setAttribute('aria-expanded', 'true'); const i = document.querySelector('#menu .gs'); if (i) i.focus({preventScroll:true}); }
  else if (b.id === 'menuClose'){ closeMenus(); $('menuBtn').focus(); }
  else if (b.dataset.zoom){ if (b.dataset.zoom === 'reset') plotReset(); else plotZoom(b.dataset.zoom === 'in' ? 1.6 : 1/1.6); }
  else if (b.dataset.logos){ store.set('ltf.logos', b.dataset.logos === 'on'); render(); }
  else if (b.dataset.follow){ const cur = favs().map(x => x.slug), sl = b.dataset.follow; store.set('ltf.favs', cur.includes(sl) ? cur.filter(x => x !== sl) : [...cur, sl]); store.set('ltf.fav', null); render(); }
  else if (b.dataset.dismiss){ store.set('ltf.started', true); render(); }
  else if (b.dataset.share){
    let url = ''; try { url = location.href; } catch(e){}
    const said = msg => { const old = b.textContent; b.textContent = msg; setTimeout(() => { b.textContent = old; }, 1600); };
    if (navigator.share) navigator.share({title: `${b.dataset.share} | ${BRAND}`, url}).catch(() => {});
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => said('Link copied'), () => said('Copy the address bar'));
    else said('Copy the address bar');
  }
  else if (b.id === 'reset' || b.dataset.resetw){ W = {...DEFAULTS}; store.set('ltf.weights', W); recompute(); const q = {...R.q}; delete q.w; go(L(R.page, R.id, q), {replace:true, keep:true}); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape'){ hidePop(); if (document.body.classList.contains('menu-open')){ closeMenus(); $('menuBtn').focus(); } } });
$('conf').addEventListener('change', e => go(Lq({group: e.target.value || null}), {replace:true, keep:true}));
$('find').addEventListener('input', e => go(Lq({find: e.target.value.trim() ? e.target.value : null}), {replace:true, keep:true}));
view.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.pick; if (k) go(Lq({[k]: e.target.value}), {replace:true, keep:true}); });
view.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.weight; if (!k) return;
  const next = {...W, [k]: Number(e.target.value)};
  if (!COMP.some(c => next[c.k] > 0)){ e.target.value = W[k]; return; }       // at least one part has to count
  W = next; store.set('ltf.weights', W); recompute();
  const q = {...R.q}; delete q.w; setUrl(L(R.page, R.id, q), true); R = parse(cur);
  COMP.forEach(c => { const o = $('o-'+c.k); if (o) o.textContent = share(c.k)+'%'; });
  const p = $('preview'); if (p) p.innerHTML = previewList();
  const ws = $('wstate'); if (ws) ws.innerHTML = customWeights() ? 'You are on <b>your own weights</b>.' : 'You are on the <b>LTF Index</b>.';
  const note = chrome(), top = $('top'), old = top.querySelector('.wnote');
  if (old) old.remove(); if (note) top.insertAdjacentHTML('afterbegin', note);
});
let resizeTimer, lastW = window.innerWidth; window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (R.page === 'stats' && window.innerWidth !== lastW){ lastW = window.innerWidth; render(); } }, 200); });

/* ================= start ================= */
{
  const sel = $('conf');
  CONFS.forEach(c => { const o = document.createElement('option'); o.value = c.slug; o.textContent = c.label; sel.appendChild(o); });
  document.querySelectorAll('.brandname').forEach(el => { el.innerHTML = BRAND.split(' ').map(w => /^the$/i.test(w) ? `<span class="thin">${esc(w)}</span>` : esc(w)).join(' '); });
  let start = '#/'; try { start = location.hash || '#/'; } catch(e){}
  cur = start; R = parse(start);
  const saved = store.get('ltf.weights');
  W = parseWeights(R.q.w) || (saved && parseWeights(COMP.map(c => saved[c.k]).join('-'))) || {...DEFAULTS};
  recompute();
  {   // what changed since the last visit, for followed teams (or the top three)
    const seen = store.get('ltf.seen');
    if (seen && seen.built && seen.built !== M.built && seen.ranks){ const fl = favs(), pool = fl.length ? fl : byRank().slice(0,3); window._since = pool.filter(t => seen.ranks[t.slug] != null).map(t => ({t, from: seen.ranks[t.slug]})); }
    store.set('ltf.seen', {built: M.built, ranks: Object.fromEntries(T.map(t => [t.slug, t.rank]))});
  }
  if (customWeights() && !R.q.w) setUrl(L(R.page, R.id, R.q), true);
  LOGO_OK = LOCAL.size > 0 || store.get('ltf.logoOk') === true;          // logos published with the site always load; otherwise go by last time
  render();
  if (!LOCAL.size && !LOGOS_OFF){   // find out whether this browser can load team logos at all. Some viewers block outside images.
    const tries = byRank().slice(0, 3).map(t => logoSrc(t, false)).filter(Boolean), im = new Image();
    im.onload = () => { store.set('ltf.logoOk', true); if (!LOGO_OK){ LOGO_OK = true; render(); } };
    im.onerror = () => { if (tries.length){ im.src = tries.shift(); return; } store.set('ltf.logoOk', false); if (LOGO_OK){ LOGO_OK = false; render(); } };
    if (tries.length) im.src = tries.shift();
  }
}
