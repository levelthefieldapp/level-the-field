/* ================= stat leaders ================= */
/* Box-score style numbers for every team, offense and defense: totals, per game and per play, ranked nationally or in
   any group. They come from the play-by-play of every game, lower-division games included, and none of them is part
   of the LTF Index. Where LTF has an opponent-adjusted version of the same number, its rank sits alongside, so a
   schedule that made a raw number look better or worse shows up. The catalog lives in src/statdefs.json. */
const SKI = Object.fromEntries((M.sk || []).map((k, i) => [k, i]));
const PKI = Object.fromEntries((M.pk || []).map((k, i) => [k, i]));
const HAS_STATS = T.some(t => t.s && t.s.g);
const raw = (t, side, k) => (t.s && t.s[side] && SKI[k] != null) ? (+t.s[side][SKI[k]] || 0) : 0;
function sexpr(t, expr, side){      // "a+b", "py+sky" or "d.int+d.fl-o.int-o.fl"
  let v = 0; const re = /([+-]?)\s*(?:([od])\.)?([a-z0-9]+)/g; let m;
  while ((m = re.exec(expr))){ const x = raw(t, m[2] || side, m[3]); v += m[1] === '-' ? -x : x; }
  return v;
}
const STATBY = Object.fromEntries(STATDEFS.map(d => [d.id, d]));
const STAT_GROUPS = [...new Set(STATDEFS.map(d => d.grp))];
const statSide = (d, side) => d.side === 'team' ? 'o' : side === 'o' || side === 'd' ? side : (d.ds || 'o');
const statName = (d, side) => d.side === 'team' ? d.on : side === 'd' ? d.dn : d.on;
const SVIEW = {tot:'Total', pg:'Per game', pp:'Per play'};
const statViews = d => d.k === 'rate' || d.k === 'score' ? [] : d.per ? ['tot', 'pg', 'pp'] : ['tot', 'pg'];
const statView = (d, want) => { const vs = statViews(d); return !vs.length ? 'rate' : vs.includes(want) ? want : 'pg'; };
const viewLabel = (d, view) => view === 'pp' ? d.pn : view === 'pg' ? 'per game' : view === 'tot' ? 'total' : '';
function statVal(t, d, side, view){
  const g = t.s ? t.s.g : 0; if (!g) return null;
  if (d.k === 'score') return stScores().get(t);
  if (d.k === 'rate'){ const den = sexpr(t, d.den, side); return den && den >= (d.min || 0) ? sexpr(t, d.num, side) / den * (d.x || 1) : null; }
  const n = sexpr(t, d.num, side);
  if (view === 'tot') return n;
  if (view === 'pp'){ const den = sexpr(t, d.per, side); return den ? n / den * (d.px || 1) : null; }
  return n / g;
}
/* special teams overall: the average percentile on six measures, 100 the best. Shown for the story, never part of the LTF Index. */
const ST_PARTS = ['fgoe', 'netpunt', 'puntret', 'puntcov', 'kickret', 'kickcov'];
let _st = null;
function stScores(){
  if (_st) return _st;
  const got = new Map(T.map(t => [t, []]));
  for (const id of ST_PARTS){ const d = STATBY[id]; if (!d) continue; const view = statView(d, 'pg'), dir = statDir(d, 'o') || 1;
    const vals = T.map(t => [t, statVal(t, d, 'o', view)]).filter(x => x[1] != null && isFinite(x[1])).sort((a, b) => dir*(a[1] - b[1]));
    vals.forEach(([t], i) => got.get(t).push(100 * i / Math.max(1, vals.length - 1))); }
  return _st = new Map([...got].map(([t, ps]) => [t, ps.length >= 4 ? ps.reduce((a, b) => a + b, 0) / ps.length : null]));
}
function stRank(t){      // rank and the six pieces, for a team page
  const all = T.map(x => [x, stScores().get(x)]).filter(x => x[1] != null).sort((a, b) => b[1] - a[1] || a[0].rank - b[0].rank);
  const i = all.findIndex(x => x[0] === t);
  return i < 0 ? null : {rank: i + 1, of: all.length, score: all[i][1]};
}
function stPane(t){
  if (!HAS_STATS || !STATBY.stoverall) return '';
  const r = stRank(t), pool = T;
  const row = id => { const d = STATBY[id], view = statView(d, ['fgoe', 'rettd', 'blocks'].includes(id) ? 'tot' : 'pg'), rows = statRows(d, 'o', view, pool), me = rows.find(x => x.t === t);
    return `<tr><td><a class="txt" href="${statL(d, 'o', view)}">${esc(d.on)}</a>${view === 'pg' ? ' <small>per game</small>' : view === 'tot' ? ' <small>this season</small>' : ''}</td><td class="num"><b>${me ? sfmt(me.v, statFmtKey(d, view)) : '–'}</b></td><td class="num">${me ? ord(me.r) : '–'}</td></tr>`; };
  const fg = `${raw(t, 'o', 'fgm')} of ${raw(t, 'o', 'fga')} field goals`;
  return `<section class="tsec"><h2 class="th2">Special teams</h2>
    <p class="tpara">${r ? `${ord(r.rank)} of ${r.of} on special teams overall, with ${fg}.` : `Not enough kicks yet for an overall rank. ${fg}.`} Special teams are shown for the story and are not part of the LTF Index.</p>
    <div class="scroll"><table class="log stt"><thead><tr><th>Measure</th><th class="num">Value</th><th class="num">Rank</th></tr></thead><tbody>
    ${['fgoe', 'fgpct', 'netpunt', 'puntret', 'puntcov', 'kickret', 'kickcov', 'rettd', 'blocks'].map(row).join('')}</tbody></table></div>
    <p class="tlinks"><a class="txt" href="${L('leaders', null, {cat: 'Special teams'})}">Special teams leaders</a></p></section>`;
}
const statDir = (d, side) => d.better === 0 ? 0 : (d.side === 'team' || side === 'o') ? d.better : -d.better;     // 1: higher is better, -1: lower is better
const statFmtKey = (d, view) => d.k === 'rate' || view === 'tot' ? d.fmt : view === 'pp' ? (d.pfmt || '3') : d.fmt === 'int' ? '1' : d.fmt === 's0' ? 's1' : d.fmt;
function sfmt(v, f){
  if (v == null || !isFinite(v)) return '–';
  if (f === 'int') return Math.round(v).toLocaleString('en-US');
  if (f === 'pct') return v.toFixed(1) + '%';
  if (f === 's3') return signed(v, 3);
  if (f === 's0') return signed(Math.round(v), 0);
  if (f === 's1') return signed(v, 1);
  return v.toFixed(+f || 0);
}
function statRows(d, side, view, pool){      // ranked rows, ties sharing a rank
  const dir = statDir(d, side) || 1;
  const rows = pool.map(t => ({t, v: statVal(t, d, side, view)})).filter(r => r.v != null && isFinite(r.v));
  rows.sort((a, b) => dir*(b.v - a.v) || a.t.rank - b.t.rank);
  rows.forEach((r, i) => { r.r = i && Math.abs(r.v - rows[i-1].v) < 1e-9 ? rows[i-1].r : i + 1; });
  return rows;
}
function adjRanks(d, side, view, pool){      // LTF's opponent-adjusted rank for the same number, where there is one
  const a = d.adj; if (!a) return null;
  const f = side === 'd' ? a.d : a.o; if (!f || (a.view && a.view !== view)) return null;
  const hi = side === 'o' || (side === 'd' && a.dx);
  const vals = pool.filter(t => t.d[f] != null).sort((x, y) => (hi ? y.d[f] - x.d[f] : x.d[f] - y.d[f]) || x.rank - y.rank);
  return new Map(vals.map((t, i) => [t, i + 1]));
}
const statL = (d, side, view, extra) => L('stat', d.id, {side: d.side === 'team' || side === (d.ds || 'o') ? null : side, view: view === 'pg' || view === 'rate' ? null : view, group: R.q.group || null, ...(extra || {})});
const schedFlag = (rr, ar, n) => { if (ar == null) return ''; const gap = ar - rr, lim = Math.max(12, Math.round(n*0.12));
  return gap >= lim ? `<span class="sflag soft" title="LTF ranks them ${ord(ar)} once their opponents are counted">Softer opponents</span>`
    : -gap >= lim ? `<span class="sflag tough" title="LTF ranks them ${ord(ar)} once their opponents are counted">Tougher opponents</span>` : ''; };

function viewLeaders(){
  const side = R.q.side === 'd' ? 'd' : 'o', want = ['tot', 'pg', 'pp'].includes(R.q.view) ? R.q.view : 'pg', cat = STAT_GROUPS.includes(R.q.cat) ? R.q.cat : '';
  const pool = T.filter(inGroup);
  const title = 'Stat leaders';
  if (!HAS_STATS) return {title, top: pageTop(title, 'Stat leaders show up once the season\'s play-by-play is in.'), body: '<p class="empty">No stats yet.</p>'};
  const seg = (k, opts, cur) => `<div class="seg" role="group" aria-label="${k}">${opts.map(([v, l]) => `<a data-keep href="${Lq({[k]: v})}" aria-current="${cur === v}">${l}</a>`).join('')}</div>`;
  const bar = `<div class="lbar">${seg('side', [[null, 'Offense'], ['d', 'Defense']], side === 'd' ? 'd' : null)}${seg('view', [['tot', 'Total'], [null, 'Per game'], ['pp', 'Per play']], want === 'pg' ? null : want)}</div>
    <div class="seg wrap lcats" role="group" aria-label="Which stats">${[[null, 'All stats'], ...STAT_GROUPS.map(g => [g, g])].map(([v, l]) => `<a data-keep href="${Lq({cat: v})}" aria-current="${(cat || null) === v}">${l}</a>`).join('')}</div>`;
  const card = d => { const sd = d.side === 'team' ? 'o' : side, view = statView(d, want), rows = statRows(d, sd, view, pool).slice(0, 5), f = statFmtKey(d, view), lab = viewLabel(d, view);
    if (!rows.length) return '';
    return `<section class="lcard"><h3><a href="${statL(d, sd, view)}">${statName(d, sd)}</a>${lab && view !== 'pp' ? ` <small>${lab}</small>` : view === 'pp' ? ` <small>${esc(d.pn.toLowerCase())}</small>` : ''}</h3>
      <ol class="lrows">${rows.map(r => `<li><span class="pr">${r.r}</span>${badge(r.t, 'sm')}<span class="nm">${tl(r.t)}</span><b class="lv">${sfmt(r.v, f)}</b></li>`).join('')}</ol>
      <p class="lfoot"><a class="lall" href="${statL(d, sd, view)}">Full ranking</a>${shareBtn(`stat:${d.id}:${sd}:${view}:${groupKey()}`, 'Share', 'more inl sharebtn', [[`stat:${d.id}:${sd}:${view}:${groupKey()}`, 'Top 25'], [`stat10:${d.id}:${sd}:${view}:${groupKey()}`, 'Top 10']])}</p></section>`; };
  const groups = (cat ? [cat] : STAT_GROUPS).map(g => { const cs = STATDEFS.filter(d => d.grp === g).map(card).join('');
    return cs ? `<section class="sec"><h2>${g}</h2><div class="lgrid">${cs}</div></section>` : ''; }).join('');
  const lead = `${side === 'd' ? 'Defense' : 'Offense'}, ${groupKey() === 'all' ? 'every FBS team' : esc(groupLabel())}, ${want === 'tot' ? 'season totals' : want === 'pp' ? 'per play' : 'per game'}. Tap a stat for the full ranking.`;
  return {title, controls:true, nofind:true, lead,
    top: pageTop(title, `Box-score numbers for every team, from the play-by-play of every game this season, lower-division games included. None of them is part of the LTF Index. Totals, per game and per play where it makes sense, and rates where it does not. Sacks count against passing, not rushing. A stat that LTF also measures shows LTF's opponent-adjusted rank on its own page.`),
    body: bar + groups};
}

function viewStat(){
  const d = STATBY[R.id]; if (!d) return viewNotFound();
  const side = statSide(d, R.q.side), view = statView(d, R.q.view), pool = T.filter(inGroup), name = statName(d, side);
  const rows = statRows(d, side, view, pool), adj = adjRanks(d, side, view, pool), f = statFmtKey(d, view), vs = statViews(d);
  const head = view === 'rate' ? name : view === 'pp' ? `${name}, ${d.pn.toLowerCase()}` : view === 'tot' ? `${name}, season total` : `${name} per game`;
  const segS = d.side === 'team' ? '' : `<div class="seg" role="group" aria-label="Offense or defense">${['o', 'd'].map(s => `<a data-keep href="${statL(d, s, view)}" aria-current="${s === side}">${s === 'o' ? `Offense: ${esc(d.on)}` : `Defense: ${esc(d.dn)}`}</a>`).join('')}</div>`;
  const segV = vs.length ? `<div class="seg" role="group" aria-label="Total, per game or per play">${vs.map(v => `<a data-keep href="${statL(d, side, v)}" aria-current="${v === view}">${v === 'pp' ? esc(d.pn) : SVIEW[v]}</a>`).join('')}</div>` : '';
  const others = vs.filter(v => v !== view);
  const q = findText(), shown = q ? rows.filter(r => r.t.n.toLowerCase().includes(q) || r.t.ab.toLowerCase() === q) : rows;
  const body = shown.map(r => { const ar = adj ? adj.get(r.t) : null;
    return `<tr><td class="num rk">${r.r}</td>${teamCell(r.t, false, true)}<td class="num hide480">${r.t.s.g}</td><td class="num sv"><b>${sfmt(r.v, f)}</b></td>
      ${others.map(v => `<td class="num wide">${sfmt(statVal(r.t, d, side, v), statFmtKey(d, v))}</td>`).join('')}
      ${adj ? `<td class="num">${ar ?? '–'}</td><td class="wide">${schedFlag(r.r, ar, pool.length)}</td>` : ''}</tr>`; }).join('');
  const table = `<div class="scroll"><table class="grid stat"><thead><tr>${th('Rank', 'num')}${th('Team')}${th('Games', 'num hide480')}${th(view === 'pp' ? esc(d.pn) : view === 'rate' ? 'Value' : SVIEW[view], 'num')}
      ${others.map(v => th(v === 'pp' ? esc(d.pn) : SVIEW[v], 'num wide')).join('')}${adj ? th('LTF rank', 'num', 'adjrank') + th('', 'wide') : ''}</tr></thead>
      <tbody>${body || emptyRow(5 + others.length + (adj ? 2 : 0), 'team')}</tbody></table></div>`;
  const top1 = rows[0], gk = groupKey();
  const lead = top1 ? `${tl(top1.t)} ${gk === 'all' ? 'leads the country' : `leads the ${esc(groupLabel())}`} at ${sfmt(top1.v, f)}${rows[1] ? `, ahead of ${tl(rows[1].t)} at ${sfmt(rows[1].v, f)}` : ''}.${statDir(d, side) < 0 ? ' Lower is better here.' : statDir(d, side) === 0 ? ' This one shows style, not quality.' : ''}` : '';
  const adjNote = adj ? ` LTF rank is the same number adjusted for opponents, with garbage time left out. "Softer opponents" marks a team whose raw rank is well ahead of it, "Tougher opponents" one whose raw rank is well behind.` : '';
  return {title: head, controls:true, lead, card: `stat:${d.id}:${side}:${view}:${gk}`, alts: [[`stat:${d.id}:${side}:${view}:${gk}`, 'Top 25'], [`stat10:${d.id}:${side}:${view}:${gk}`, 'Top 10']],
    top: pageTop(esc(head), `${esc(d.def)} ${view === 'pg' ? 'Per game divides by games played. ' : ''}Every game this season counts, lower-division games included, through week ${M.through}. Not part of the LTF Index.${adjNote}`, [['Stat leaders', L('leaders', null, {side: side === 'd' ? 'd' : null, group: R.q.group || null})], [esc(name)]]),
    body: `<div class="lbar">${segS}${segV}</div>${table}<p class="next linkrow"><a class="txt" href="${L('leaders', null, {side: side === 'd' ? 'd' : null, cat: d.grp, group: R.q.group || null})}">More ${esc(d.grp.toLowerCase())} stats</a></p>`};
}
function statCardData(id, n){      // "sacks:d:pg:all" -> the rows for a share card
  const [sid, side, view, g] = String(id || '').split(':'), d = STATBY[sid]; if (!d || !HAS_STATS) return null;
  const sd = statSide(d, side), vw = statView(d, view), grp = cardGroup(g || 'all'); if (!grp) return null;
  const rows = statRows(d, sd, vw, T.filter(cardIn(grp))).slice(0, n); if (!rows.length) return null;
  return {d, side: sd, view: vw, g: grp, rows, n, name: statName(d, sd), f: statFmtKey(d, vw)};
}

/* ================= LTF and the market ================= */
/* A yardstick, on the Track record pages only: each team's rank in the betting market, worked out from the closing
   lines of games already played this season, next to their LTF rank. The market's number carries what bettors thought
   of a team before the season. LTF leaves that out on purpose, so the gaps show where this season's games and
   reputation disagree. It is never part of the LTF Index, and no line for a game still to be played is used or shown. */
let _mkt = null;
function marketRanks(){
  if (_mkt) return _mkt;
  const gs = G.filter(g => g.done && g.hs != null && byName[g.h] && byName[g.a]);
  const n = T.length, ix = new Map(T.map((t, i) => [t, i])), A = Array.from({length: n + 1}, () => new Float64Array(n + 1)), b = new Float64Array(n + 1);
  const cnt = new Array(n).fill(0);
  for (const g of gs){      // expected home margin = home rating - away rating + home field
    const h = ix.get(byName[g.h]), a = ix.get(byName[g.a]), y = -g.hs, x = new Map([[h, 1], [a, -1]]); if (!g.n) x.set(n, 1);
    for (const [i, vi] of x){ b[i] += vi*y; for (const [j, vj] of x) A[i][j] += vi*vj; }
    cnt[h]++; cnt[a]++;
  }
  for (let i = 0; i < n; i++) A[i][i] += 0.5;          // a light pull toward average, for teams with few lined games
  A[n][n] += 0.01;
  for (let c = 0; c <= n; c++){      // solve by elimination
    let p = c; for (let r = c + 1; r <= n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r <= n; r++){ if (r === c || !A[r][c]) continue; const k = A[r][c]/A[c][c]; for (let j = c; j <= n; j++) A[r][j] -= k*A[c][j]; b[r] -= k*b[c]; }
  }
  const rate = T.map((t, i) => ({t, v: b[i]/A[i][i], g: cnt[i]})).filter(x => x.g >= 2).sort((x, y) => y.v - x.v);
  const rank = new Map(rate.map((x, i) => [x.t, i + 1]));
  return _mkt = {rank, n: rate.length, games: gs.length, hfa: b[n]/A[n][n]};
}
function viewMarket(){
  const mk = marketRanks(), title = 'LTF and the market';
  if (!mk.n) return {title, top: pageTop(title, 'The market\'s rankings show up once games with closing lines have been played.'), body: '<p class="empty">Nothing to compare yet.</p>'};
  const pool = T.filter(t => inGroup(t) && mk.rank.has(t)), byGap = R.q.sort === 'gap', q = findText();
  const gap = t => mk.rank.get(t) - t.rank;      // above zero: LTF has them higher than the market does
  let rows = [...pool].sort((a, b) => byGap ? Math.abs(gap(b)) - Math.abs(gap(a)) || a.rank - b.rank : a.rank - b.rank);
  if (q) rows = rows.filter(t => t.n.toLowerCase().includes(q) || t.ab.toLowerCase() === q);
  const chip = t => { const v = gap(t); return !v ? '<span class="mv same">even</span>' : `<span class="mv ${v > 0 ? 'up' : 'down'}" title="${v > 0 ? 'LTF has them' : 'The market has them'} ${Math.abs(v)} ${Math.abs(v) === 1 ? 'spot' : 'spots'} higher">${v > 0 ? 'LTF +' : 'Market +'}${Math.abs(v)}</span>`; };
  const body = rows.map(t => `<tr><td class="num rk">${t.rank}</td>${teamCell(t, false, true)}<td class="num">${mk.rank.get(t)}</td><td class="num">${chip(t)}</td><td class="num hide480">${t.w}-${t.l}</td></tr>`).join('');
  const higher = pool.filter(t => gap(t) > 0 && (t.rank <= 50 || mk.rank.get(t) <= 50)).sort((a, b) => gap(b) - gap(a)).slice(0, 6);
  const lower = pool.filter(t => gap(t) < 0 && (t.rank <= 50 || mk.rank.get(t) <= 50)).sort((a, b) => gap(a) - gap(b)).slice(0, 6);
  const li = (t, txt) => rowB(t, t.rank, txt);
  const agree = pool.filter(t => t.rank <= 25 && mk.rank.get(t) <= 25).length, t25 = pool.filter(t => t.rank <= 25).length;
  const lead = higher.length && lower.length ? `Biggest gaps: LTF has ${tl(higher[0])} ${gap(higher[0])} spots higher than the market, and the market has ${tl(lower[0])} ${-gap(lower[0])} spots higher than LTF.${groupKey() === 'all' ? ` They share ${agree} of their top 25 teams.` : ''}` : '';
  return {title, controls:true, lead, card: 'market', alts: null,
    top: pageTop(title, `The market rank comes from the closing betting lines of the ${mk.games} games between FBS teams already played this season: the ratings that best explain those lines, with home field worked out from them. The lines carry what bettors thought of each team before the season. The LTF Index leaves that out on purpose and goes by this season's games only, so the gaps show where reputation and this season's results disagree. A yardstick only. It is never part of the LTF Index, and no line for a game still to be played is used.`),
    body: `<div class="panels">
      <section class="panel"><h2>LTF has them higher</h2><p class="hint">Teams in or near the top 50 that this season's games rate above their market rank.</p><ol class="rows">${higher.map(t => li(t, `market ${mk.rank.get(t)}, ${chip(t)}`)).join('') || '<li class="two">None.</li>'}</ol></section>
      <section class="panel"><h2>The market has them higher</h2><p class="hint">Teams in or near the top 50 the market rates above their LTF rank.</p><ol class="rows">${lower.map(t => li(t, `market ${mk.rank.get(t)}, ${chip(t)}`)).join('') || '<li class="two">None.</li>'}</ol></section></div>
      <section class="sec"><h2>Every team</h2>
      <div class="seg" role="group" aria-label="Order"><a data-keep href="${Lq({sort: null})}" aria-current="${!byGap}">By LTF rank</a><a data-keep href="${Lq({sort: 'gap'})}" aria-current="${byGap}">Biggest gaps first</a></div>
      <div class="scroll"><table class="grid"><thead><tr>${th('LTF', 'num')}${th('Team')}${th('Market', 'num')}${th('Gap', 'num')}${th('Record', 'num hide480')}</tr></thead><tbody>${body || emptyRow(5, 'team')}</tbody></table></div></section>`};
}
function marketCard(){
  const mk = marketRanks(); if (!mk.n) return null;
  const gap = t => mk.rank.get(t) - t.rank, pool = T.filter(t => mk.rank.has(t) && (t.rank <= 50 || mk.rank.get(t) <= 50));
  const hi = pool.filter(t => gap(t) > 0).sort((a, b) => gap(b) - gap(a)).slice(0, 5), lo = pool.filter(t => gap(t) < 0).sort((a, b) => gap(a) - gap(b)).slice(0, 5);
  return hi.length + lo.length ? {hi, lo, mk} : null;
}
