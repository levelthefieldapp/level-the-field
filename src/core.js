
/* ================= settings ================= */
window.addEventListener('error', e => { if (e.message) document.documentElement.setAttribute('data-err', String(e.message).slice(0, 200)); });      // leaves a mark the publish check can read
const BRAND = 'Level the Field';     // the site's name
const SITE = null;
// make_site.py fills in the line above when the site is published at its own address: where it lives and which
// team logos sit in the logos folder next to the page. In a plain preview it stays null.
const CONTACT_EMAIL = '';            // put a public contact address here to switch on the Contact page's email link
const COMP = [
  {k:'res', name:'Résumé',           col:'Résumé',  w:20, what:'Who a team has beaten and lost to: strength of record, quality wins and scoring margin.'},
  {k:'off', name:'Offense',          col:'Offense', w:25, what:'How well the offense moves the ball and scores: EPA per play, success rate, points per drive, scoring opportunities, explosive plays and yards.'},
  {k:'def', name:'Defense',          col:'Defense', w:25, what:'How well the defense prevents the same things, plus stop rate and havoc.'},
  {k:'cmp', name:'Computer ratings', col:'Ratings', w:30, what:'Other rating systems, averaged: ' + D.meta.cmpSrc.join(', ') + '.'},
];
const pct1 = v => v.toFixed(1) + '%';
const STATS = [   // o = offense field, d = defense field; dHigh marks defense stats where higher is better
  {k:'epa',  n:'EPA per play',                   s:'EPA/play',        o:'oepa', d:'depa', f:v => signed(v,3)},
  {k:'sr',   n:'Success rate',                   s:'Success',         o:'osr',  d:'dsr',  f:pct1},
  {k:'ppd',  n:'Points per drive',               s:'Pts/drive',       o:'oppd', d:'dppd', f:v => v.toFixed(2)},
  {k:'ppo',  n:'Points per scoring opportunity', s:'Pts/scoring opp', o:'oppo', d:'dppo', f:v => v.toFixed(2)},
  {k:'exp',  n:'Explosive play rate',            s:'Explosive',       o:'oexp', d:'dexp', f:pct1},
  {k:'yds',  n:'Yards per game',                 s:'Yards/game',      o:'oyds', d:'dyds', f:v => v.toFixed(0)},
  {k:'stop', n:'Stop rate',                      s:'Stop rate',       o:null,   d:'stop', f:pct1, dHigh:true},
  {k:'hav',  n:'Havoc rate',                     s:'Havoc',           o:null,   d:'hav',  f:pct1, dHigh:true},
  // shown for depth, not part of the score
  {k:'ru',   n:'Rushing EPA per play',           s:'Rush EPA',        o:'oru',  d:'dru',  f:v => signed(v,3), x:true},
  {k:'pa',   n:'Passing EPA per play',           s:'Pass EPA',        o:'opa',  d:'dpa',  f:v => signed(v,3), x:true},
  {k:'sdn',  n:'Success rate, standard downs',   s:'Standard downs',  o:'osd',  d:'dsd',  f:pct1, x:true},
  {k:'pdn',  n:'Success rate, passing downs',    s:'Passing downs',   o:'opd',  d:'dpd',  f:pct1, x:true},
];
/* ================= helpers ================= */
const T = D.teams, M = D.meta, G = D.games;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mean = a => a.reduce((s,v)=>s+v,0)/a.length;
const sdev = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v-m)*(v-m)))); };
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const ord = n => { const s=['th','st','nd','rd'], v=n%100; return n + (s[(v-20)%10] || s[v] || s[0]); };
const signed = (v,d=1) => (v>0?'+':v<0?'\u2212':'') + Math.abs(v).toFixed(d).replace(/\.0$/,'');
const line = v => v === 0 ? "Pick 'em" : signed(v);
const half = v => Math.round(Math.abs(v)*2)/2;
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/['\u2019]/g,'').toLowerCase().replace(/&/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const list = xs => xs.length < 2 ? xs.join('') : xs.slice(0,-1).join(', ') + ' and ' + xs[xs.length-1];
function phi(x){ // normal CDF
  const t = 1/(1+0.2316419*Math.abs(x)), d = 0.3989423*Math.exp(-x*x/2);
  const p = d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  return x>0 ? 1-p : p;
}
function ranks(vals){ // 1 = highest
  const order = vals.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]); const r = new Array(vals.length);
  order.forEach(([v,i],pos)=>{ r[i] = pos+1; }); return r;
}
const AVG = {}, SD = {};                               // the average team's number for each stat and how spread out the country is on it
const LOCAL = new Set(SITE && Array.isArray(SITE.logos) ? SITE.logos : []);      // teams with a logo file published next to the page
const LOGOS_OFF = !!SITE && SITE.logos === false;                                  // the site owner has switched logos off for everyone
const logoSrc = (t, dark) => !t.lg ? null : LOCAL.has(t.lg) && !t.noLocal ? `logos/${dark ? 'dark/' : ''}${t.lg}.webp`
  : `https://a.espncdn.com/i/teamlogos/ncaa/${dark ? '500-dark' : '500'}/${t.lg}.png`;
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
const BUILT = new Date(M.builtAt || M.built + 'T12:00:00');                         // when the numbers were last rebuilt
const builtTxt = year => BUILT.toLocaleDateString(undefined, {month:'long', day:'numeric', ...(year ? {year:'numeric'} : {})}) + (M.builtAt ? ', ' + BUILT.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'}) : '');
const STALE = !!SITE && M.next != null && Date.now() - BUILT > 40*3600e3;         // in season, a published site updates at least daily
const fmtDay = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}); };
const fmtTime = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}); };

/* ================= teams, conferences, schedules ================= */
const byName = {}, bySlug = {};
for (const t of T){
  t.slug = slug(t.n); byName[t.n] = t; bySlug[t.slug] = t; t.g = []; t.sched = []; t.rk = {};
  const m = /^#?([0-9a-f]{6})$/i.exec(t.col || ''), n = m ? parseInt(m[1],16) : 0x888888;
  const lin = v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
  t.fg = (.2126*lin(n>>16) + .7152*lin((n>>8)&255) + .0722*lin(n&255)) > .4 ? '#101114' : '#FFFFFF';
}
const CONFS = [...new Set(T.map(t => t.c))].sort().map(c => { const ts = T.filter(t => t.c===c); return {name:c, label:c==='Independent'?'Independents':c, slug:slug(c), tier:c==='Independent'?null:ts[0].tier, teams:ts}; });
const confBySlug = Object.fromEntries(CONFS.map(c => [c.slug, c])), confByName = Object.fromEntries(CONFS.map(c => [c.name, c]));
const gameById = {};
for (const g of G){
  gameById[g.id] = g; g.done = g.hp != null;
  for (const side of ['h','a']){
    const t = byName[g[side]]; if (!t) continue;
    const home = side==='h', opp = home ? g.a : g.h;
    const e = {game:g, id:g.id, wk:g.w, opp, fcs:!byName[opp], site:g.n ? 'N' : home ? 'H' : 'A', conf:g.c, date:g.d,
               pf:g.done ? (home?g.hp:g.ap) : null, pa:g.done ? (home?g.ap:g.hp) : null, spr:g.hs == null ? null : (home ? g.hs : -g.hs), ou:g.ou};
    t.sched.push(e); if (g.done) t.g.push(e);
  }
}
const WEEKS = [...new Set(G.map(g => g.w))].sort((a,b) => a-b);
const weekDone = w => w <= M.through || G.filter(g => g.w === w).every(g => g.done);      // every game played, whether or not the index has turned over yet

/* one-time ranks for every stat */
const rankBy = (key, get, lowBetter) => { const r = ranks(T.map(t => lowBetter ? -get(t) : get(t))); T.forEach((t,i)=>{ t.rk[key] = r[i]; }); };
for (const c of COMP) rankBy(c.k, t => t.z[c.k]);
for (const s of STATS){ if (s.o) rankBy(s.o, t => t.d[s.o]); rankBy(s.d, t => t.d[s.d], !s.dHigh); }
T.forEach(t => { t.netOpp = t.d.oppo - t.d.dppo; });
for (const s of STATS) for (const f of [s.o, s.d]) if (f){ AVG[f] = mean(T.map(t => t.d[f])); SD[f] = sdev(T.map(t => t.d[f])) || 1; }
AVG.netOpp = 0; SD.netOpp = sdev(T.map(t => t.netOpp)) || 1;
rankBy('netOpp', t => t.netOpp); rankBy('st', t => t.d.st);
rankBy('sor', t => t.d.sor); rankBy('mar', t => t.d.mar); rankBy('sos', t => t.d.sos);
const SRC = [['SP+','sp'],['FPI','fpi'],['SRS','srs'],['Elo','elo']].filter(([n,f]) => T.every(t => t.d[f] != null));
SRC.forEach(([n,f]) => rankBy(f, t => t.d[f]));
for (const t of T){   // records against the spread
  const mk = () => ({w:0,l:0,p:0,sum:0,n:0});
  const a = {all:mk(),fav:mk(),dog:mk(),home:mk(),away:mk(),o:0,u:0,op:0};
  for (const g of t.g){
    if (g.spr == null) continue;
    const cm = g.pf - g.pa + g.spr; g.cm = cm;
    const add = o => { o.n++; o.sum += cm; if (cm>0) o.w++; else if (cm<0) o.l++; else o.p++; };
    add(a.all); if (g.spr<0) add(a.fav); else if (g.spr>0) add(a.dog);
    add(g.site==='H' ? a.home : a.away);
    if (g.ou != null){ const tot = g.pf+g.pa; if (tot>g.ou) a.o++; else if (tot<g.ou) a.u++; else a.op++; }
  }
  a.pct = (a.all.w+a.all.l) ? a.all.w/(a.all.w+a.all.l) : null;
  a.avg = a.all.n ? a.all.sum/a.all.n : null;
  t.ats = a;
}
const finalTxt = g => g.hp >= g.ap ? `${esc(g.h)} ${g.hp}, ${esc(g.a)} ${g.ap}` : `${esc(g.a)} ${g.ap}, ${esc(g.h)} ${g.hp}`;      // a final the way it is written up: winner first
const anA = n => /^(8|11(\D|$)|18(\D|$))/.test(String(n)) ? 'an' : 'a';      // "an 8-point favorite", "an 11.5-point underdog", "a 10-point favorite"
const scoreTxt = e => `${Math.max(e.pf, e.pa)}-${Math.min(e.pf, e.pa)}`;      // a final score the way it is always written, winner's points first
const recStr = o => o.n ? `${o.w}-${o.l}${o.p?'-'+o.p:''}` : '\u2013';

/* ================= weights and the index ================= */
const DEFAULTS = Object.fromEntries(COMP.map(c => [c.k, c.w]));
const weightStr = w => COMP.map(c => w[c.k]).join('-');
function parseWeights(s){
  if (typeof s !== 'string') return null;
  const p = s.split('-').map(Number);
  if (p.length !== COMP.length || p.some(v => !Number.isFinite(v) || v < 0 || v > 100) || !p.some(v => v > 0)) return null;
  return Object.fromEntries(COMP.map((c,i) => [c.k, p[i]]));
}
let W = {...DEFAULTS};
const customWeights = () => weightStr(W) !== weightStr(DEFAULTS);
const share = k => Math.round(100*W[k]/(COMP.reduce((s,c)=>s+W[c.k],0)||1));
function compositeZ(w){
  const tot = COMP.reduce((s,c)=>s+w[c.k],0) || 1;
  const raw = T.map(t => COMP.reduce((s,c)=>s+w[c.k]*t.z[c.k],0)/tot);
  const m = mean(raw), sd = sdev(raw) || 1;
  return raw.map(v => (v-m)/sd);
}
{ const r = ranks(compositeZ(DEFAULTS)); T.forEach((t,i)=>{ t.baseRank = r[i]; }); }
const HW = [...new Set(T.flatMap(t => t.h.map(h => h.w)))].sort((a,b) => a-b);     // weeks with a saved snapshot
let WK = {}, _sim = {};
const slopeAt = wk => M.slope[String(clamp(wk, 2, 11))];                             // index points per standard deviation
const SLOPE = slopeAt(M.through);
const FCS = {cz: M.fcs / SLOPE, fcsTeam: true};                                      // stand-in for any FCS opponent
function recompute(){
  const cz = compositeZ(W), r = ranks(cz);
  T.forEach((t,i)=>{ t.cz = cz[i]; t.idx = clamp(50+14*cz[i],0,100); t.rank = r[i]; t.hist = {}; });
  const tot = COMP.reduce((s,c)=>s+W[c.k],0) || 1;
  WK = {};
  for (const wk of HW){   // the same score for every earlier week, so movement, trends and old lines follow the weights
    const cur = wk === M.through;
    const rows = T.map(t => [t, cur ? t : t.h.find(h => h.w===wk)]).filter(x => x[1]);
    const cmpAt = (t,h) => h.c ?? (t.z.cmp + h.e - (t.h.find(x => x.w===M.through) || h).e);
    const parts = rows.map(([t,h]) => cur ? {...t.z} : {res:h.r, off:h.o, def:h.d, cmp:cmpAt(t,h)});
    const raw = parts.map(p => COMP.reduce((s,c)=>s+W[c.k]*p[c.k],0)/tot);
    const m = mean(raw), sd = sdev(raw) || 1, zs = raw.map(v => (v-m)/sd), rk = ranks(zs);
    const prk = Object.fromEntries(COMP.map(c => [c.k, ranks(parts.map(p => p[c.k]))]));
    WK[wk] = {sd};
    rows.forEach(([t,h],i) => { t.hist[wk] = {z:zs[i], idx:clamp(50+14*zs[i],0,100), rank:rk[i], rec: cur ? `${t.w}-${t.l}` : h.rec, parts:parts[i], prk:Object.fromEntries(COMP.map(c => [c.k, prk[c.k][i]]))}; });
  }
  const prevWk = HW.length > 1 ? HW[HW.length-2] : null;
  T.forEach(t => { const p = prevWk != null && t.hist[prevWk]; t.prevRank = p ? p.rank : null; t.move = p ? p.rank - t.rank : null; });
  for (const t of T) t.h2h = t.g.filter(g => g.pf < g.pa && (!byName[g.opp] || byName[g.opp].rank > t.rank)).map(g => ({g, o: byName[g.opp] || null}));
  for (const key of ['tier','c']){
    const groups = {};
    T.forEach(t => (groups[t[key]] = groups[t[key]] || []).push(t));
    Object.values(groups).forEach(g => g.sort((a,b)=>b.cz-a.cz).forEach((t,i)=>{ t[key+'Rank'] = i+1; t[key+'Size'] = g.length; }));
  }
  for (const c of CONFS){ c.avg = mean(c.teams.map(t => t.idx)); c.sorted = [...c.teams].sort((a,b) => a.rank-b.rank); }
  [...CONFS].filter(c => c.tier).sort((a,b) => b.avg-a.avg).forEach((c,i) => { c.rank = i+1; });
  _track = null; _proj = {}; _sim = {}; _mom = null; _sc = null; _brk = null;
  for (const c of CONFS){ const pv = prevWk != null ? c.teams.filter(t => t.hist[prevWk]).map(t => t.hist[prevWk].idx) : []; c.prevAvg = pv.length ? mean(pv) : null; }
  if (prevWk != null) [...CONFS].filter(c => c.tier && c.prevAvg != null).sort((a,b) => b.prevAvg-a.prevAvg).forEach((c,i) => { c.prevRank = i+1; });
}
const byRank = () => [...T].sort((a,b) => a.rank-b.rank);

/* ================= lines ================= */
function lineFor(a, b, homeEdge, slope){   // a's expected margin over b; homeEdge is +1 if a is home, -1 if b is, 0 on a neutral field
  const m = (slope || SLOPE)*(a.cz - b.cz) + homeEdge*M.hfa;
  return {m, fav: m>=0 ? a : b, pts: half(m), pA: phi(m/M.sigma)};
}
function gameLine(g){   // the LTF line for a game from the home side. Finished games use the index as it stood before kickoff.
  const h = byName[g.h], a = byName[g.a];
  if (!h || !a) return null;
  if (!g.done){ const x = lineFor(h, a, g.n ? 0 : 1); return {m:x.m, fav:x.fav, pts:x.pts, pHome:x.pA}; }
  const hh = h.hist[g.w-1], ah = a.hist[g.w-1];
  if (!hh || !ah) return null;
  const m = slopeAt(g.w-1)*(hh.z-ah.z) + (g.n ? 0 : M.hfa);
  return {m, fav: m>=0 ? h : a, pts: half(m), pHome: phi(m/M.sigma)};
}
const FUTURE = () => WEEKS.filter(w => M.next != null && w >= M.next);                 // weeks still to be played
const weekGames = w => G.filter(g => g.w === w).map(g => { const pr = gameLine(g); return {g, pr, gap: pr && g.hs != null ? pr.m + g.hs : null}; });
const openGames = w => weekGames(w).filter(x => !x.g.done);                           // a week's games still to be played
const lineTxt = (x, ab) => !x ? null : x.pts === 0 ? "Pick 'em" : `${esc(ab ? x.fav.ab : x.fav.n)} ${signed(-x.pts)}`;
const marketTxt = (g, ab) => { if (g.hs == null) return null; if (g.hs === 0) return "Pick 'em"; const n = g.hs < 0 ? g.h : g.a, t = byName[n]; return `${esc(ab && t ? t.ab : n)} ${signed(-Math.abs(g.hs))}`; };
function outcome(g){   // what happened against the market
  const mar = g.hp - g.ap, o = {mar, winner: mar>0 ? g.h : g.a, loser: mar>0 ? g.a : g.h};
  if (g.hs != null){ const cm = mar + g.hs; o.cover = cm === 0 ? null : cm > 0 ? g.h : g.a; o.coverBy = Math.abs(cm); }
  if (g.ou != null){ const tot = g.hp + g.ap; o.total = tot; o.ou = tot>g.ou ? 'Over' : tot<g.ou ? 'Under' : 'Push'; }
  return o;
}
const winProb = (t, e) => {   // chance t wins schedule entry e, from the current index
  const o = byName[e.opp] || FCS; return lineFor(t, o, e.site==='H' ? 1 : e.site==='A' ? -1 : 0).pA;
};
let _proj = {};
function projection(t){   // remaining games and the record the index expects
  if (_proj[t.n]) return _proj[t.n];
  const left = t.sched.filter(e => !e.game.done).map(e => ({e, p: winProb(t, e)}));
  const xw = left.reduce((s,x) => s + x.p, 0);
  return _proj[t.n] = {left, xw, w: t.w + xw, l: t.l + left.length - xw};
}
let _track = null;
function trackRecord(){   // every finished game where the index had a line before kickoff and the market did too
  if (_track) return _track;
  const rows = [];
  for (const g of G){
    if (!g.done || g.hs == null) continue;
    const x = gameLine(g); if (!x) continue;
    const mi = x.m, mm = -g.hs, act = g.hp - g.ap, edge = mi - mm, res = act - mm;
    rows.push({g, x, mi, mm, act, side: Math.abs(edge) < 0.25 ? null : edge > 0 ? g.h : g.a,
               right: res === 0 || Math.abs(edge) < 0.25 ? null : (edge > 0) === (res > 0), ei: Math.abs(act-mi), em: Math.abs(act-mm)});
  }
  const sum = rs => ({n: rs.length, w: rs.filter(r => r.right === true).length, l: rs.filter(r => r.right === false).length, p: rs.filter(r => r.right === null).length,
                      ai: rs.length ? mean(rs.map(r => r.ei)) : 0, am: rs.length ? mean(rs.map(r => r.em)) : 0});
  const weeks = [...new Set(rows.map(r => r.g.w))].sort((a,b) => a-b).map(wk => ({...sum(rows.filter(r => r.g.w === wk)), wk}));
  return _track = {rows, weeks, all: sum(rows)};
}

/* ================= routing ================= */
function parse(hash){
  const h = String(hash || '').replace(/^#\/?/, ''), cut = h.indexOf('?');
  const path = cut < 0 ? h : h.slice(0, cut), qs = cut < 0 ? '' : h.slice(cut+1);
  let seg = []; try { seg = path.split('/').filter(Boolean).map(decodeURIComponent); } catch(e){ seg = ['?']; }
  const q = {}; try { new URLSearchParams(qs).forEach((v,k) => { q[k] = v; }); } catch(e){}
  return {page: seg[0] || 'home', id: seg[1] || null, q};
}
function L(page, id, q){   // the address of any page. Custom weights ride along so shared links show the same rankings.
  const p = {...(q || {})}; if (customWeights()) p.w = weightStr(W); else delete p.w;
  const qs = Object.entries(p).filter(([k,v]) => v != null && v !== '').map(([k,v]) => encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
  return '#/' + (page === 'home' ? '' : page) + (id ? '/' + encodeURIComponent(id) : '') + (qs ? '?' + qs : '');
}
let R = parse('');
const Lq = changes => L(R.page, R.id, {...R.q, ...changes});     // same page, different settings
const teamL = t => L('team', t.slug), gameL = g => L('game', String(g.id)), confL = c => L('conference', c.slug);
const GROUPS = {all:'National', p4:'Power 4', g6:'Group of 6'};
const groupKey = () => (R.q.group && (GROUPS[R.q.group] || confBySlug[R.q.group])) ? R.q.group : 'all';
const inGroup = t => { const k = groupKey(); return k==='all' ? true : k==='p4' ? t.tier==='P4' : k==='g6' ? t.tier==='G6' : t.c === confBySlug[k].name; };
const groupLabel = () => { const k = groupKey(); return GROUPS[k] || confBySlug[k].label; };
const findText = () => (R.q.find || '').trim().toLowerCase();
