/* ================= the frame around every page ================= */
const $ = id => document.getElementById(id);
const view = $('view'), pop = $('pop');
/* Six doors and sixteen pages. The front page is this week. Every other section opens on its main page and shows a short
   row of its own pages under the header. Pages that answer the same question share one entry and show as tabs at the
   top of the page (HUBS). Every one of them keeps its own address, so no old link breaks. About and Contact live in the footer. */
const SECTIONS = [
  {k:'home', label:'This week', pages:[]},
  {k:'rankings', label:'Rankings', pages:[['rankings','LTF rankings'],['conferences','Conferences'],['momentum','Trends'],['weights','Build your own']]},
  {k:'games', label:'Games', pages:[['games','Games and picks'],['upsets','Upset watch'],['buysell','Buying and selling'],['recap','Recap']]},
  {k:'teams', label:'Teams', pages:[['teams','All teams'],['leaders','Stats'],['compare','Compare'],['blind','Blind résumé']]},
  {k:'playoff', label:'Playoff', pages:[['playoff','Playoff']]},
  {k:'scorecard', label:'Track record', pages:[['scorecard','Track record'],['how','How it works']]},
];
const HUBS = {
  conferences: [['conferences','By conference'], ['leagues','League strength']],
  momentum: [['momentum','Momentum'], ['luck','Luck'], ['radar','Under the radar']],
  games: [['games','Scores and schedule'], ['picks','Picks']],
  playoff: [['playoff','Bracket'], ['odds','Season odds']],
  scorecard: [['scorecard','This season'], ['track','Past seasons'], ['vsline','Against the line'], ['market','LTF and the market']],
  leaders: [['leaders','Stat leaders'], ['stats','Chart and table'], ['styles','How teams play']],
  how: [['how','How it works'], ['inputs','What goes in']],
};
const HUB_OF = Object.fromEntries(Object.entries(HUBS).flatMap(([h, tabs]) => tabs.map(([k]) => [k, h])));
const PARENT = {team:'teams', game:'games', conference:'conferences', stat:'leaders'};      // a detail page lights up the page it sits under
const SITE_PAGES = [['about','About'], ['contact','Contact']];
const ALIASES = [['scorecard','Scorecard'], ['track','LTF track record'], ['weights','Your own weights'], ['radar','Polls vs LTF'], ['leaders','Stat leaders'], ['styles','Run and pass styles'], ['market','Market rankings']];      // names people may still search for
const ALLPAGES = [...SECTIONS.flatMap(s => s.pages), ...Object.values(HUBS).flat(), ...SITE_PAGES, ...ALIASES].filter((p, i, a) => a.findIndex(q => q[1] === p[1]) === i);      // for search: every page by every name it goes by
const entryOf = page => HUB_OF[page] || page;
const sectionOf = page => SECTIONS.find(s => s.k === page || s.pages.some(p => p[0] === entryOf(page))) || null;
const hubTabs = page => { const h = HUB_OF[page]; if (!h) return '';
  const keep = R.q.group ? {group: R.q.group} : null;
  return `<nav class="ptabs" aria-label="${esc(sectionOf(page) ? (sectionOf(page).pages.find(p => p[0] === h) || [h, ''])[1] : '')}">${HUBS[h].map(([k, l]) => `<a href="${L(k, null, ['momentum', 'luck', 'leaders', 'styles'].includes(k) ? keep : null)}"${k === page ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`; };
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9.5H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  rankings: '<path d="M4 20V11M10 20V4M16 20v-7M2 20.5h20" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  games: '<rect x="3" y="5" width="18" height="15.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 2.5v4M16 2.5v4" stroke="currentColor" stroke-width="2"/>',
  playoff: '<path d="M2.5 5h5v4h-5zM2.5 15h5v4h-5zM7.5 7H11v10H7.5M11 12h5.5M16.5 10h5v4h-5z" fill="none" stroke="currentColor" stroke-width="2"/>',
  more: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const VIEWS = {home:viewHome, rankings:viewRankings, teams:viewTeams, team:viewTeam, conferences:viewConferences, conference:viewConference,
               games:viewGames, game:viewGame, stats:viewStats, compare:viewCompare, playoff:viewPlayoff, radar:viewRadar, upsets:viewUpsets, buysell:viewBuySell, vsline:viewVsLine, leagues:viewLeagues, inputs:viewInputs,
               track:viewTrack, weights:viewWeights, leaders:viewLeaders, stat:viewStat, styles:viewStyles, market:viewMarket, how:viewHow, about:viewAbout, contact:viewContact, picks:viewPicks, recap:viewRecap, odds:viewOdds, blind:viewBlind, luck:viewLuck, momentum:viewMomentum, scorecard:viewScorecard};
const MOVED = {spread:'picks', model:'scorecard', reputation:'radar'};      // pages retired on October 7, 2026. An old link lands on the nearest page that is still here.
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
  const entry = entryOf(here), on = k => k === entry ? ' aria-current="page"' : '';
  $('nav').innerHTML = SECTIONS.map(s => `<a href="${L(s.k)}"${s === sec ? (s.pages.length > 1 ? ' class="on"' : ' aria-current="page"') : ''}>${s.label}</a>`).join('');
  const sub = sec && sec.pages.length > 1 ? sec.pages : null;
  $('subbar').hidden = !sub; $('subnav').setAttribute('aria-label', sec ? `${sec.label} pages` : 'Pages in this section');
  $('subnav').innerHTML = sub ? sub.map(([k,l]) => `<a href="${L(k)}"${on(k)}>${l}</a>`).join('') : '';
  if (sub){ const o = $('subnav').querySelector('[aria-current]'); if (o && o.scrollIntoView && $('subnav').scrollWidth > $('subnav').clientWidth) try { o.scrollIntoView({block:'nearest', inline:'center'}); } catch(e){} }
  const open = s => s === sec ? ' open' : '';
  $('menunav').innerHTML = `<a class="top" href="${L('home')}"${here === 'home' ? ' aria-current="page"' : ''}>This week</a>`
    + SECTIONS.filter(s => s.pages.length > 1).map(s => `<details${open(s)}><summary>${s.label}</summary>${s.pages.map(([k,l]) => `<a href="${L(k)}"${on(k)}>${l}</a>`).join('')}</details>`).join('')
    + SECTIONS.filter(s => s.k !== 'home' && s.pages.length === 1).map(s => `<a class="top" href="${L(s.k)}"${s === sec ? ' aria-current="page"' : ''}>${s.label}</a>`).join('')
    + `<div class="mfoot">${links(SITE_PAGES)}</div>`;
  const inTab = k => sec && sec.k === k;
  $('tabbar').innerHTML = [['home','This week','home'], ['rankings','Rankings','rankings'], ['games','Games','games'], ['playoff','Playoff','playoff']].map(([k, l, ic]) =>
      `<a href="${L(k)}"${inTab(k) ? ' aria-current="page"' : ''}>${icon(ic)}${l}</a>`).join('')
    + `<button type="button" id="menuBtn" aria-controls="menu" aria-expanded="${document.body.classList.contains('menu-open')}"${sec && !['home','rankings','games','playoff'].includes(sec.k) || !sec ? ' class="here"' : ''}>${icon('more')}More</button>`;
  document.querySelectorAll('a.brand').forEach(a => { a.setAttribute('href', L('home')); });
  $('ribbon').innerHTML = ribbon(); document.body.classList.toggle('at-home', R.page === 'home'); document.body.classList.toggle('show-ribbon', ['home', 'games', 'picks'].includes(R.page));
  const col = (h, arr) => `<div><h3>${h}</h3>${arr.map(([k,l]) => `<a href="${L(k)}">${l}</a>`).join('')}</div>`;
  const off = store.get('ltf.logos') === false;
  $('foot').innerHTML = `<nav class="fnav" aria-label="Footer">${SECTIONS.filter(s => s.pages.length > 1).map(s => col(s.label, s.pages)).join('')}${col('The site', [['home','This week'], ['playoff','Playoff'], ...SITE_PAGES])}</nav>
    <p class="brandline">${markSvg('mark')}<b>${esc(BRAND)}</b></p>
    <p class="fine">Every team, one scale. This season only. ${M.season} season, LTF Index through week ${M.through}. Updated ${builtTxt(true)}.${STALE ? ' The daily update has not run since then.' : ''}</p>
    ${LOGO_OK && !LOGOS_OFF ? `<p class="fine">Team logos are ${off ? 'off' : 'on'}. <button type="button" class="more inl" data-logos="${off ? 'on' : 'off'}">${off ? 'Show logos' : 'Use team colors instead'}</button></p>` : ''}
    <p class="fine">Built from this season's games and nothing else: no polls, no preseason rankings, no betting lines. For fun and for arguments. Nothing here is betting advice. This site is independent and is not connected to any school, conference or sportsbook. Team names, colors and logos belong to the schools. Data from the public cfbfastR data sets and the CollegeFootballData.com API.</p>`;
}
function controls(show, v){
  $('controls').hidden = !show; $('ctlx').innerHTML = show && v && v.ctl ? v.ctl : ''; $('find').closest('label').hidden = !!(v && v.nofind); if (!show){ document.body.classList.remove('has-filters'); return; }
  const k = groupKey();
  $('groupseg').innerHTML = ['all','p4','g6'].map(g => `<a data-keep href="${Lq({group: g==='all' ? null : g})}" aria-current="${k===g}">${GROUPS[g]}</a>`).join('');
  $('conf').value = GROUPS[k] ? '' : k;
  const f = $('find'); if (document.activeElement !== f) f.value = R.q.find || '';
  // on a phone the conference, the search box and any week picker sit behind one Filter button. It says how many are in use.
  const n = (GROUPS[k] ? 0 : 1) + (R.q.find ? 1 : 0) + (R.q.week && document.querySelector('#view .fhide [aria-current="true"]') ? 1 : 0);
  document.body.classList.add('has-filters');
  $('filterBtn').innerHTML = `${FILTER_ICON}Filter${n ? ` <span class="fcount">${n}</span>` : ''}`;
}
const FILTER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg>';
/* A grey line under a section heading says what the section shows. It is tucked behind a small "i" button next to the
   heading, so the lists come first. The page-wide explanation sits behind "About this page" the same way. */
function tuckHints(){
  view.querySelectorAll('.sec>h2+.hint, .panel>h2+.hint').forEach((p, i) => {
    const h = p.previousElementSibling, id = 'hint' + i, wrap = document.createElement('div');
    wrap.className = 'shead'; h.parentNode.insertBefore(wrap, h); wrap.appendChild(h);
    wrap.insertAdjacentHTML('beforeend', `<button type="button" class="ibtn" aria-expanded="false" aria-controls="${id}" aria-label="What this shows"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10.5v6.5M12 7v.6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>`);
    p.id = id; p.hidden = true; p.classList.add('tucked');
  });
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
  if (MOVED[R.page]){ go(L(MOVED[R.page]), {replace:true}); return; }
  const v = (VIEWS[R.page] || viewNotFound)();
  document.title = v.title ? `${v.title} | ${BRAND}` : BRAND;
  $('top').innerHTML = chrome() + hubTabs(R.page) + fillTop(v.top, v);
  controls(!!v.controls, v);
  view.innerHTML = v.body;
  tuckHints();
  if (v.after) v.after();
  document.documentElement.setAttribute('data-drawn', R.page);      // the publish check looks for this to know the page drew itself
}

/* ================= getting around ================= */
let cur = addr('home');
const scrolls = {};
const toTop = y => { try { window.scrollTo(0, y || 0); } catch(e){} };
function setUrl(url, replace){
  let ok = false;
  try { history[replace ? 'replaceState' : 'pushState'](null, '', url); ok = true; } catch(e){}
  if (!ok){ try { if (PATHS) location.assign(url); else if (replace) location.replace(url); else location.hash = url.slice(1); } catch(e){} }
  cur = url;
}
function go(url, opt = {}){
  if (PATHS === url.startsWith('#')) url = canon(url);      // accept either form of an address, keep the bar in this site's form
  if (!opt.replace) scrolls[cur] = window.scrollY || 0;
  closeSheet(); setUrl(url, opt.replace); R = parse(url); closeMenus(); render();
  if (!opt.keep){ toTop(0); countView(); }
}
function onUrlChange(){   // back and forward buttons, or a typed address
  const url = here();
  if (url === cur) return;
  closeSheet(); scrolls[cur] = window.scrollY || 0; cur = url; R = parse(url); closeMenus(); render(); toTop(scrolls[url] || 0); countView();
}
window.addEventListener('popstate', onUrlChange);
window.addEventListener('hashchange', onUrlChange);

/* ================= menu, search, definitions ================= */
let menuOpener = null;
function closeMenus(){
  document.body.classList.remove('menu-open'); ['menuBtn', 'searchBtn'].forEach(id => { const b = $(id); if (b) b.setAttribute('aria-expanded', 'false'); });
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
  if (src.startsWith(ROOT + 'logos/') && !t.noLocal){ t.noLocal = true; const u = logoSrc(t, src.startsWith(ROOT + 'logos/dark/')); if (isImg) el.setAttribute('src', u); else el.setAttribute('href', u); return; }   // the local copy is missing, so try the public one
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
    if (a.dataset.alt){ e.preventDefault(); openSheet(a.dataset.alt); return; }
    const href = a.getAttribute('href') || '';
    if (isPage(href) && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){
      e.preventDefault(); const keep = a.hasAttribute('data-keep'); go(href, {replace: keep, keep});
    }
    return;
  }
  const b = t.closest('button'); if (!b){ if (t.id === 'sheet') closeSheet(); return; }
  if (b.dataset.card){ openSheet(b.dataset.card, b, b.dataset.alts ? b.dataset.alts.split('|').map(x => x.split('=')) : null); return; }
  if (b.id === 'sheetClose'){ closeSheet(); return; }
  if (b.dataset.sheet){ sheetClick(b); return; }
  if (b.dataset.about != null){ const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('about-open', open); return; }
  if (b.classList.contains('ibtn') && b.hasAttribute('aria-controls')){ const open = b.getAttribute('aria-expanded') !== 'true', p = $(b.getAttribute('aria-controls')); b.setAttribute('aria-expanded', String(open)); if (p) p.hidden = !open; return; }
  if (b.id === 'filterBtn'){ const open = !document.body.classList.contains('filters-open'); document.body.classList.toggle('filters-open', open); b.setAttribute('aria-expanded', String(open)); return; }
  if (b.id === 'menuBtn' || b.id === 'searchBtn'){      // More opens the menu with nothing focused, so a phone keyboard stays down. The search button means to type.
    menuOpener = b; document.body.classList.add('menu-open'); b.setAttribute('aria-expanded', 'true');
    if (b.id === 'searchBtn'){ const i = document.querySelector('#menu .gs'); if (i) i.focus({preventScroll:true}); } else $('menuClose').focus({preventScroll:true});
  }
  else if (b.id === 'menuClose'){ closeMenus(); if (menuOpener && document.contains(menuOpener)) menuOpener.focus(); else if ($('menuBtn')) $('menuBtn').focus(); }
  else if (b.dataset.zoom){ if (b.dataset.zoom === 'reset') plotReset(); else plotZoom(b.dataset.zoom === 'in' ? 1.6 : 1/1.6); }
  else if (b.dataset.logos){ store.set('ltf.logos', b.dataset.logos === 'on'); render(); }
  else if (b.dataset.follow){ const cur = favs().map(x => x.slug), sl = b.dataset.follow; store.set('ltf.favs', cur.includes(sl) ? cur.filter(x => x !== sl) : [...cur, sl]); store.set('ltf.fav', null); render(); }
  else if (b.dataset.dismiss){ store.set('ltf.started', true); render(); }
  else if (b.id === 'reset' || b.dataset.resetw){ W = {...DEFAULTS}; store.set('ltf.weights', W); recompute(); const q = {...R.q}; delete q.w; go(L(R.page, R.id, q), {replace:true, keep:true}); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape'){ hidePop(); closeSheet(); if (document.body.classList.contains('menu-open')){ closeMenus(); const b = menuOpener && document.contains(menuOpener) ? menuOpener : $('menuBtn'); if (b) b.focus(); } } });
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
  let ask = ''; try { ask = location.hash; } catch(e){}
  const wantCards = ask.startsWith('#!cards=') ? ask.slice(8).split(',').filter(Boolean) : null;
  const start = wantCards ? addr('home') : here();
  cur = start; R = parse(start);
  if (PATHS && !wantCards){ let at = ''; try { at = location.pathname + location.search + location.hash; } catch(e){} if (at !== start) setUrl(start, true); }      // an old #/ link lands here, then shows its real address
  const saved = store.get('ltf.weights');
  W = parseWeights(R.q.w) || (saved && COMP.every(c => Number.isFinite(saved[c.k])) && parseWeights(COMP.map(c => saved[c.k]).join('-'))) || {...DEFAULTS};      // weights saved under an older formula no longer fit, so they are dropped
  recompute();
  {   // what changed since the last visit, for followed teams (or the top three)
    const seen = store.get('ltf.seen');
    if (seen && seen.built && seen.built !== M.built && seen.ranks){ const fl = favs(), pool = fl.length ? fl : byRank().slice(0,3); window._since = pool.filter(t => seen.ranks[t.slug] != null).map(t => ({t, from: seen.ranks[t.slug]})); }
    store.set('ltf.seen', {built: M.built, ranks: Object.fromEntries(T.map(t => [t.slug, t.rank]))});
  }
  if (customWeights() && !R.q.w) setUrl(L(R.page, R.id, R.q), true);
  LOGO_OK = LOCAL.size > 0 || store.get('ltf.logoOk') === true;          // logos published with the site always load; otherwise go by last time
  if (wantCards) exportCards(wantCards); else { render(); countView(); }
  if (!LOCAL.size && !LOGOS_OFF){   // find out whether this browser can load team logos at all. Some viewers block outside images.
    const tries = byRank().slice(0, 3).map(t => logoSrc(t, false)).filter(Boolean), im = new Image();
    im.onload = () => { store.set('ltf.logoOk', true); if (!LOGO_OK){ LOGO_OK = true; render(); } };
    im.onerror = () => { if (tries.length){ im.src = tries.shift(); return; } store.set('ltf.logoOk', false); if (LOGO_OK){ LOGO_OK = false; render(); } };
    if (tries.length) im.src = tries.shift();
  }
}
