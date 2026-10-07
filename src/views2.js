/* ================= games ================= */
function gameList(games){
  const side = (n, win) => { const t = byName[n]; return `<span class="gt${win?' w':''}">${t ? badge(t,'sm') : '<span class="bdg sm fcs" aria-hidden="true"><b>FCS</b></span>'}<span>${esc(n)} <small>${t ? t.rank : 'FCS'}</small></span></span>`; };
  const anyUp = games.some(g => !g.done), anyDone = games.some(g => g.done);
  const rows = games.map(g => {
    const x = gameLine(g), o = g.done ? outcome(g) : null, mk = marketTxt(g, true);
    let res = '', last = '';
    if (g.done){
      if (o.cover !== undefined) res = o.cover === null ? 'Push' : `${esc((byName[o.cover] || {ab:o.cover}).ab)} covered by ${o.coverBy}`;
      if (x && x.pts !== 0) last = (x.m > 0) === (g.hp > g.ap) ? 'LTF had the winner' : '<span class="cf">LTF missed the winner</span>';
    } else {
      const e = edgeOf(g), c = confidence(g);
      if (e) res = e.none ? '<span class="cf">No edge</span>' : `${esc(e.t.ab)} +${e.pts}`;
      if (c) last = `<b class="cnum">${c.score}</b> <span class="cf">${c.label}</span>`;
    }
    return `<a class="gline" href="${gameL(g)}"><span class="gd">${fmtDay(g.d)}${g.n ? ', neutral' : ''}</span>
      <span class="tms">${side(g.a, g.done && g.ap>g.hp)}${side(g.h, g.done && g.hp>g.ap)}</span>
      <span class="sc">${g.done ? `${g.ap}<br>${g.hp}` : `<small>${g.tbd ? 'Time TBA' : fmtTime(g.d)}</small>`}</span>
      <span class="v">${x ? `<span class="lbl">LTF line: </span>${lineTxt(x, true)}` : ''}</span>
      <span class="v">${mk ? `<span class="lbl">Market: </span>${mk}` : ''}</span>
      <span class="v">${res ? `<span class="lbl">${g.done ? 'Spread: ' : 'LTF Edge: '}</span>${res}` : ''}</span>
      <span class="v">${last ? `<span class="lbl">${g.done ? '' : 'Confidence: '}</span>${last}` : ''}</span></a>`;
  }).join('');
  return `<div class="glist"><div class="gline head"><span>Date</span><span>Game</span><span>${anyDone ? 'Score' : 'Kickoff'}</span><span data-tip="line">LTF line</span><span data-tip="market">Market line</span><span data-tip="${anyUp ? 'lean' : 'cover'}">${anyUp && anyDone ? 'Spread result or LTF Edge' : anyUp ? 'LTF Edge' : 'Against the spread'}</span><span${anyUp ? ' data-tip="conf"' : ''}>${anyUp && anyDone ? 'Winner call or confidence' : anyUp ? 'Confidence' : 'Winner call'}</span></div>${rows}</div>`;
}
function viewGames(){
  const wk = WEEKS.includes(+R.q.week) ? +R.q.week : (M.next ?? M.through), q = findText();
  const weeks = weekTabs(WEEKS, wk, M.next ?? M.through, w => weekDone(w) ? 'Final' : w === M.next ? 'Next' : 'Ahead');
  let games = G.filter(g => g.w === wk && [g.h, g.a].some(n => byName[n] && inGroup(byName[n])));
  if (q) games = games.filter(g => g.h.toLowerCase().includes(q) || g.a.toLowerCase().includes(q));
  const done = weekDone(wk);
  const dek = `<b>Week ${wk}, ${groupKey()==='all' ? 'every game' : esc(groupLabel())}.</b> ${done ? 'Final scores, with the LTF line as it stood before kickoff and how each game went against the market.' : `The LTF line and a confidence score for every game, next to the market line${wk === M.next ? '' : ' where an early one is posted'}. Select a game for the reasons behind the pick.`}`;
  return {title:`Week ${wk} games`, controls:true, top: pageTop('Games', dek),
    body: weeks + (games.length ? gameList(games) : `<p class="empty">No games match. Clear the search box or pick a different week or group.</p>`) +
      (done ? `<p class="hint after">Weeks 1 and 2 have no LTF line, since there were no results yet to build one from. <a class="txt" href="${L('track')}">See the full track record</a></p>`
            : `<p class="hint after"><a class="txt" href="${L('picks', null, {week: wk === M.next ? null : wk})}">Week ${wk} picks, with the reasons for each</a></p>`)};
}

/* ================= one game ================= */
/* Who has the advantage in a row, and by how much. The gap is measured against the spread across all FBS teams, in
   standard deviations, then shown as one of four strengths of green. Under half of one is slight, 2 or more is a mismatch. */
const ADV = ['', 'Slight edge', 'Clear edge', 'Big edge', 'Mismatch'];
const advLevel = gap => !(gap > 0) ? 0 : gap < .5 ? 1 : gap < 1 ? 2 : gap < 2 ? 3 : 4;
const goodZ = (t, s, side) => { const f = side === 'o' ? s.o : s.d, z = (t.d[f] - AVG[f]) / SD[f]; return side === 'o' || s.dHigh ? z : -z; };   // how good a unit is, higher is better
const advCell = (txt, rk, lv) => `<td${lv ? ` class="win adv a${lv}"` : ''}>${txt}${rk != null ? `<span class="rkc">${ord(rk)}</span>` : ''}${lv ? `<span class="sr"> ${ADV[lv].toLowerCase()}</span>` : ''}</td>`;
const advPair = (ra, rb, gap) => { const lv = advLevel(Math.max(.01, Math.abs(gap))); return ra === rb ? [0, 0] : ra < rb ? [gap >= 0 ? lv : 1, 0] : [0, gap <= 0 ? lv : 1]; };   // gap is the first side minus the second
const advKey = () => `<div class="advkey" role="img" aria-label="Shading key: the greener the cell, the bigger the advantage"><span>Advantage</span>${[1,2,3,4].map(l => `<i class="adv a${l}">${ADV[l]}</i>`).join('')}</div>`;
function tape(A, B){   // A is the road team, B the home team
  const row = (label, a, b, ra, rb, gap, bare) => { const [la, lb] = advPair(ra, rb, gap); return `<tr>${advCell(a, bare ? null : ra, la)}<th scope="row">${label}</th>${advCell(b, bare ? null : rb, lb)}</tr>`; };
  const grp = label => `<tr class="grp"><th colspan="3">${label}</th></tr>`;
  const ks = STATS.filter(s => ['epa','sr','ppd','ppo','exp'].includes(s.k));
  return `${advKey()}<div class="scroll"><table class="tape"><tbody>
    ${grp('Overall')}${row(term('index'), A.idx.toFixed(1), B.idx.toFixed(1), A.rank, B.rank, (A.idx - B.idx)/14)}
    ${COMP.map(c => row(term(c.k, c.name), ord(A.rk[c.k]), ord(B.rk[c.k]), A.rk[c.k], B.rk[c.k], A.z[c.k] - B.z[c.k], true)).join('')}
    <tr><td>${recStr(A.ats.all)}</td><th scope="row">${term('ats')}</th><td>${recStr(B.ats.all)}</td></tr>
    ${grp(`When ${esc(A.n)} has the ball: ${esc(A.n)}'s offense against ${esc(B.n)}'s defense`)}${ks.map(s => row(term(s.k, s.n), s.f(A.d[s.o]), s.f(B.d[s.d]), A.rk[s.o], B.rk[s.d], goodZ(A, s, 'o') - goodZ(B, s, 'd'))).join('')}
    ${grp(`When ${esc(B.n)} has the ball: ${esc(A.n)}'s defense against ${esc(B.n)}'s offense`)}${ks.map(s => row(term(s.k, s.n), s.f(A.d[s.d]), s.f(B.d[s.o]), A.rk[s.d], B.rk[s.o], goodZ(A, s, 'd') - goodZ(B, s, 'o'))).join('')}
  </tbody></table></div><p class="hint after">Green marks the side with the advantage in each row, and the deeper the green, the bigger the gap. The small number is the national rank. Shading goes by how far apart the two numbers are next to the rest of the country, so two top-10 units can still be a slight edge. Numbers are season to date and adjusted for opponent. Tap a stat name for what it means.</p>`;
}
const spreadTxt = (g, hs) => hs == null ? null : hs === 0 ? "Pick 'em" : `${esc(hs < 0 ? g.h : g.a)} ${signed(-Math.abs(hs))}`;
function viewGame(){
  const g = gameById[R.id]; if (!g) return viewNotFound();
  const A = byName[g.a], B = byName[g.h], x = gameLine(g), o = g.done ? outcome(g) : null;
  const side = (t, name, cls, pts) => `<div class="side ${cls}" style="--tc:${t ? esc(t.col) : '#3A3D44'};--tf:${t ? t.fg : '#fff'}" data-ab="${t ? esc(t.ab) : 'FCS'}">
      ${t && logosOn() ? `<span class="gmark">${badge(t,'lgm')}</span>` : ''}${t ? `<a class="nm" href="${teamL(t)}">${esc(name)}</a>` : `<span class="nm">${esc(name)}</span>`}<span class="rc">${t ? `No. ${t.rank}, ${t.w}-${t.l}` : 'FCS team'}</span>${pts != null ? `<span class="pts">${pts}</span>` : ''}</div>`;
  const head = `<div class="gamehead">${side(A, g.a, 'l', g.done ? g.ap : null)}<div class="mid"><span>${g.done ? 'Final' : g.n ? 'vs' : 'at'}<small>${fmtDay(g.d)}</small>${g.done || g.tbd ? '' : `<small>${fmtTime(g.d)}</small>`}</span></div>${side(B, g.h, 'r', g.done ? g.hp : null)}</div>`;
  const where = `${g.n ? 'Neutral site' : `At ${esc(g.h)}`}${g.c ? ', conference game' : ''}.`;
  const pFav = x ? Math.max(x.pHome, 1-x.pHome) : null;
  const moved = g.ho != null && g.hs != null && g.ho !== g.hs;
  const fIdx = fact(term('line') + (g.done ? ', before kickoff' : ''), x ? lineTxt(x) : 'None', x ? `${esc(x.pHome>=.5?g.h:g.a)} to win ${clamp(Math.round(pFav*100),50,99)}% of the time` : (!A || !B) ? 'No line against FCS teams' : 'Too early in the season for one');
  const fMkt = fact(term('market'), marketTxt(g) || 'None posted', `${moved ? `${term('open', 'Opened')} ${spreadTxt(g, g.ho)}. ` : ''}${g.ou != null ? `Total ${g.ou}` : (g.hs != null ? '' : 'Lines usually post the week of the game')}`);
  let facts = '', story = '', sections = '';
  if (g.done){
    const fRes = o.cover === undefined ? '' : fact('Against the spread', o.cover === null ? 'Push' : `${esc(o.cover)} covered`, `${o.cover === null ? 'Landed exactly on the number' : `by ${o.coverBy} points`}${o.ou ? `. Total: ${o.ou.toLowerCase()} ${g.ou}` : ''}`);
    let fTrk = '', told = '';
    if (x){
      const act = g.hp - g.ap, ei = Math.abs(act - x.m), right = x.pts === 0 ? null : (x.m > 0) === (act > 0);
      told = `Before kickoff the LTF line was ${x.pts === 0 ? "a pick 'em" : `${esc(x.fav.n)} by ${x.pts}`}. ${right === null ? '' : right ? 'LTF had the winner right' : 'LTF had the wrong winner'}${right === null ? 'It' : ', and it'} missed the margin by ${ei.toFixed(1)} points.`;
      if (g.hs != null){ const em = Math.abs(act + g.hs);
        fTrk = fact('Which line was closer', Math.abs(ei-em) < 0.25 ? 'Even' : ei < em ? 'LTF' : 'The market', `LTF missed by ${ei.toFixed(1)}, market by ${em.toFixed(1)}`); }
    }
    facts = fIdx + fMkt + fRes + fTrk;
    story = `${esc(o.winner)} won by ${Math.abs(o.mar)}. ${where}`;
    const ea = A && A.g.find(e => e.id === g.id), eb = B && B.g.find(e => e.id === g.id);
    const scores = [ea && `${esc(A.n)} ${Math.round(gameScore(A, ea))}`, eb && `${esc(B.n)} ${Math.round(gameScore(B, eb))}`].filter(Boolean);
    sections = `<section class="sec"><h2>What happened</h2><div class="prose"><p>${told || 'There was no LTF line for this game. LTF needs at least two weeks of results before it sets one.'}</p>
        ${scores.length ? `<p>${term('gs', 'Game scores')}: ${scores.join(', ')}. An average performance is 50.</p>` : ''}</div></section>
      ${x ? `<section class="sec"><h2>Where the LTF line came from</h2><p class="hint">The line before kickoff, split into its parts. Each bar points toward the team that part favored.</p>${breakdown(g)}</section>` : ''}`;
  } else {
    const ps = projScore(g), e = edgeOf(g), c = confidence(g);
    const fConf = c ? fact(term('conf'), `${c.score} <span class="of">of 100</span>`, `${confMeter(c)} ${c.label}. Pick: ${esc(c.pick.n)}`) : '';
    const fPs = ps ? fact(term('ps'), `${esc(A.ab)} ${ps.ap}, ${esc(B.ab)} ${ps.hp}`, `Total ${Math.round(ps.tot)}${g.ou != null ? `, market total ${g.ou}` : ''}`) : '';
    const fEdge = !e ? '' : fact(term('lean'), e.none ? 'None' : `${esc(e.t.n)} +${e.pts}`, e.none ? 'LTF and the market are within a point' : `LTF rates ${esc(e.t.ab)} ${e.pts} points better than the market does`);
    const pk = PICKS.find(q => q.id === g.id);
    const fMod = g.mm == null ? '' : fact('Prediction model', g.mm === 0 ? "Pick 'em" : `${esc(g.mm > 0 ? g.h : g.a)} ${signed(-half(g.mm))}`, `${pk && Math.abs(pk.mm + pk.hs) >= 4 ? `Tracked pick: ${esc((pk.mm + pk.hs) > 0 ? g.h : g.a)}. ` : ''}<a class="txt" href="${L('model')}">Model tracker</a>`);
    facts = fIdx + fMkt + fConf + fEdge + fPs + fMod;
    story = `Week ${g.w}. ${where}`;
    const ph = x ? clamp(Math.round(x.pHome*100),1,99) : 0;
    sections = x ? `<section class="sec"><h2>Why LTF has it this way</h2><div class="dgrid"><div class="prose">${preview(g)}</div><div><p class="hint">The line, split into its parts. Each bar points toward the team that part favors.</p>${breakdown(g)}</div></div></section>
      ${c ? `<section class="sec"><h2>Confidence: ${c.score}, ${c.label.toLowerCase()}</h2><p class="hint">The chance the pick, ${esc(c.pick.n)}, wins the game. A 50 is a coin flip. A green mark supports the pick and a red mark counts against it.</p>${whyList(c)}</section>` : ''}
      <section class="sec"><h2>Win chance by the LTF line</h2><div class="wp" role="img" aria-label="${esc(g.a)} ${100-ph}%, ${esc(g.h)} ${ph}%"><span style="width:${100-ph}%;background:${esc(A.col)};color:${A.fg}">${esc(A.ab)} ${100-ph}%</span><span style="width:${ph}%;background:${esc(B.col)};color:${B.fg}">${ph}% ${esc(B.ab)}</span></div>
        <p class="hint after">This is LTF on its own, before the market is taken into account. When LTF says 70%, that team has won about 70% of the time. <a class="txt" href="${L('track')}">See the proof</a></p></section>
      ${disagreement(g)}${momGame(g)}` : momGame(g);
  }
  const tp = A && B ? `<section class="sec"><h2>${g.done ? 'How they compare now' : 'The matchup, stat by stat'}</h2>${tape(A, B)}
      <p class="next"><a class="txt" href="${L('compare', null, {a:A.slug, b:B.slug, site:g.n?'n':'b'})}">Open this matchup in the compare tool</a></p></section>` : '';
  return {title:`${g.a} ${g.n?'vs':'at'} ${g.h}`, top: crumbs([['Games', L('games')], [`Week ${g.w}`, L('games', null, {week:g.w})], [`${esc(g.a)} ${g.n?'vs':'at'} ${esc(g.h)}`]]),
    body: `${head}<p class="pdek gstory">${story} <button class="more inl" type="button" data-share="${esc(g.a)} ${g.n?'vs':'at'} ${esc(g.h)}">Share this page</button></p><div class="facts">${facts}</div>${sections}${tp}
      ${x || g.hs != null ? fine : ''}`};
}

/* ================= charts: any two numbers for every team, with zoom ================= */
const rating = z => 50 + 14*z;          // a part of the score on the same 0 to 100 scale as the LTF Index
const AXES = [
  {k:'idx', n:'LTF Index', grp:'LTF', get:t => t.idx, d:1},
  {k:'off', n:'Offense rating', grp:'LTF', get:t => rating(t.z.off), d:0},
  {k:'def', n:'Defense rating', grp:'LTF', get:t => rating(t.z.def), d:0},
  {k:'res', n:'Résumé rating', grp:'LTF', get:t => rating(t.z.res), d:0},
  {k:'cmp', n:'Computer ratings', grp:'LTF', get:t => rating(t.z.cmp), d:0},
  ...STATS.filter(s => s.o).map(s => ({k:s.o, n:s.n, grp:'Offense', get:t => t.d[s.o], fs:s.f})),
  {k:'netOpp', n:'Net points per scoring opportunity', grp:'Offense', get:t => t.netOpp, d:2, sign:true},
  ...STATS.map(s => ({k:s.d, n:s.n + (s.dHigh ? '' : ' allowed'), grp:'Defense', get:t => t.d[s.d], fs:s.f, low:!s.dHigh})),
  {k:'ltfp', n:'LTF rating, in points', grp:'Market and luck', get:t => idxPts(t), d:1, sign:true},
  {k:'mkt', n:'Market rating, in points', grp:'Market and luck', get:t => t.d.mkt, d:1, sign:true},
  {k:'luck', n:'Luck, points a game', grp:'Market and luck', get:t => t.luck, d:1, sign:true},
  {k:'swing', n:'Week-to-week swing', grp:'Market and luck', get:t => t.swing, d:0, low:true},
  {k:'wins', n:'Wins', grp:'Market and luck', get:t => t.w, d:0},
];
const CHARTS = [
  {k:'od', n:'Offense and defense', x:'off', y:'def', q:['Strong on both sides','Defense carries the team','Offense carries the team','Struggles on both sides'], note:'Each rating is on the LTF scale, where 50 is an average team.'},
  {k:'rp', n:'Run and pass', x:'oru', y:'opa', q:['Runs and throws well','Lives on the pass','Lives on the run','Struggles both ways'], note:'How much each run and each pass helps the offense score.'},
  {k:'eb', n:'Steady gains and big plays', x:'osr', y:'oexp', q:['Steady and explosive','Boom or bust','Grinds it out','Neither'], note:'Success rate against explosive play rate, both on offense.'},
  {k:'mk', n:'LTF and the market', x:'ltfp', y:'mkt', diag:true, q:['','The market rates them higher','','LTF rates them higher'], note:'Teams above the dashed line get more respect from the betting market than from LTF. Teams below it get less.'},
  {k:'lk', n:'Luck and quality', x:'luck', y:'idx', q:['Good and lucky','Good despite bad luck','Flattered by luck','Unlucky and struggling'], note:'Lucky teams tend to come back to earth.'},
];
const axisBy = k => AXES.find(a => a.k === k);
let PLOT = null;
function plotSpec(){
  const preset = CHARTS.find(c => c.k === R.q.chart) || CHARTS[0];
  const x = axisBy(R.q.x) || axisBy(preset.x), y = axisBy(R.q.y) || axisBy(preset.y);
  return {preset, x, y, custom: x.k !== preset.x || y.k !== preset.y};
}
function plotHtml(){
  const sp = plotSpec(), narrow = (window.innerWidth || 1000) < 640, key = [sp.x.k, sp.y.k, narrow].join('|');
  const pts = T.filter(t => sp.x.get(t) != null && sp.y.get(t) != null).map(t => ({t, x:(sp.x.low ? -1 : 1)*sp.x.get(t), y:(sp.y.low ? -1 : 1)*sp.y.get(t)}));
  const ext = vals => { const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi-lo)*0.07 || 1; return [lo-pad, hi+pad]; };
  const [x0, x1] = ext(pts.map(p => p.x)), [y0, y1] = ext(pts.map(p => p.y));
  if (!PLOT || PLOT.key !== key) PLOT = {key, d:{x0, x1, y0, y1}};
  Object.assign(PLOT, {sp, pts, full:{x0, x1, y0, y1}, W: narrow ? 400 : 760, H: narrow ? 440 : 500, narrow});
  const groups = [...new Set(AXES.map(a => a.grp))];
  const opts = sel => groups.map(gp => `<optgroup label="${gp}">${AXES.filter(a => a.grp === gp).map(a => `<option value="${a.k}"${a === sel ? ' selected' : ''}>${esc(a.n)}</option>`).join('')}</optgroup>`).join('');
  return `<div class="seg" role="group" aria-label="Which chart">${CHARTS.map(c => `<a data-keep href="${Lq({chart: c === CHARTS[0] ? null : c.k, x:null, y:null})}" aria-current="${!sp.custom && c === sp.preset}">${c.n}</a>`).join('')}</div>
    <div class="plot" id="plot">
      <div class="ptools"><label>Across <select id="plot-x" data-pick="x">${opts(sp.x)}</select></label><label>Up <select id="plot-y" data-pick="y">${opts(sp.y)}</select></label>
        <span class="zb" role="group" aria-label="Zoom"><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="reset">Reset</button></span></div>
      <div class="pstage"><svg id="psvg" viewBox="0 0 ${PLOT.W} ${PLOT.H}" role="group" aria-label="Every team plotted by ${esc(sp.x.n.toLowerCase())} and ${esc(sp.y.n.toLowerCase())}"></svg><div class="ptip" id="ptip" hidden></div></div>
      <p class="hint pnote">${sp.custom ? '' : sp.preset.note + ' '}Better is always to the right and toward the top. Drag to move around. To zoom, use the buttons, pinch, double-click a spot, or hold Ctrl and scroll. Select a team to open their page.</p>
    </div>`;
}
function niceTicks(lo, hi, n){
  const step0 = (hi-lo)/n, mag = Math.pow(10, Math.floor(Math.log10(step0))), r = step0/mag, step = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10)*mag, out = [];
  for (let v = Math.ceil(lo/step - 1e-9)*step; v <= hi + step*1e-6; v += step) out.push(v);
  return {step, vals: out};
}
function axisFmt(ax, raw, step){
  if (ax.fs && step == null) return ax.fs(raw);
  const dec = step == null ? (ax.d ?? 1) : clamp(-Math.floor(Math.log10(step) + 1e-9), 0, 3), pct = ax.fs && /%$/.test(ax.fs(1));
  const sign = ax.sign || (ax.fs && /^[+−]/.test(ax.fs(1)));
  const v = Math.abs(raw) < 1e-9 ? 0 : raw;
  return (v < 0 ? '−' : sign && v > 0 ? '+' : '') + Math.abs(v).toFixed(dec) + (pct ? '%' : '');
}
function plotDraw(){
  const svg = $('psvg'), P = PLOT; if (!svg || !P) return;
  const {W, H, d, sp, narrow} = P, pl = narrow ? 44 : 54, pr = 12, pt = 12, pb = 46;
  const sx = v => pl + (v - d.x0)/(d.x1 - d.x0)*(W-pl-pr), sy = v => H-pb - (v - d.y0)/(d.y1 - d.y0)*(H-pt-pb);
  P.geom = {pl, pr, pt, pb};
  const zoom = (P.full.x1 - P.full.x0)/(d.x1 - d.x0), tx = niceTicks(d.x0, d.x1, narrow ? 5 : 8), ty = niceTicks(d.y0, d.y1, 6);
  const raw = (ax, v) => ax.low ? -v : v;
  const grid = tx.vals.map(v => `<line class="gl" x1="${sx(v).toFixed(1)}" y1="${pt}" x2="${sx(v).toFixed(1)}" y2="${H-pb}"/><text x="${sx(v).toFixed(1)}" y="${H-pb+15}" text-anchor="middle">${axisFmt(sp.x, raw(sp.x, v), tx.step)}</text>`).join('')
    + ty.vals.map(v => `<line class="gl" x1="${pl}" y1="${sy(v).toFixed(1)}" x2="${W-pr}" y2="${sy(v).toFixed(1)}"/><text x="${pl-6}" y="${(sy(v)+4).toFixed(1)}" text-anchor="end">${axisFmt(sp.y, raw(sp.y, v), ty.step)}</text>`).join('');
  const mx = mean(P.pts.map(p => p.x)), my = mean(P.pts.map(p => p.y)), inX = v => v > d.x0 && v < d.x1, inY = v => v > d.y0 && v < d.y1;
  let refs = (inX(mx) ? `<line class="mid" x1="${sx(mx).toFixed(1)}" y1="${pt}" x2="${sx(mx).toFixed(1)}" y2="${H-pb}"/>` : '') + (inY(my) ? `<line class="mid" x1="${pl}" y1="${sy(my).toFixed(1)}" x2="${W-pr}" y2="${sy(my).toFixed(1)}"/>` : '');
  if (sp.preset.diag && !sp.custom){ const lo = Math.max(d.x0, d.y0), hi = Math.min(d.x1, d.y1); if (hi > lo) refs += `<line class="mid" x1="${sx(lo).toFixed(1)}" y1="${sy(lo).toFixed(1)}" x2="${sx(hi).toFixed(1)}" y2="${sy(hi).toFixed(1)}"/>`; }
  const q = !sp.custom && zoom < 1.15 ? sp.preset.q : null;
  const quad = q ? `<text class="ql" x="${W-pr-8}" y="${pt+18}" text-anchor="end">${q[0]}</text><text class="ql" x="${pl+8}" y="${pt+18}">${q[1]}</text><text class="ql" x="${W-pr-8}" y="${H-pb-10}" text-anchor="end">${q[2]}</text><text class="ql" x="${pl+8}" y="${H-pb-10}">${q[3]}</text>` : '';
  const logos = logosOn(), S = (narrow ? 20 : 24)*Math.min(1.7, 1 + 0.22*Math.log2(zoom)), Rr = (narrow ? 5 : 6.5)*Math.min(1.5, 1 + 0.15*Math.log2(zoom));
  const vis = P.pts.filter(p => p.x >= d.x0 && p.x <= d.x1 && p.y >= d.y0 && p.y <= d.y1), on = vis.filter(p => inGroup(p.t)), off = vis.filter(p => !inGroup(p.t));
  const val = (ax, t) => axisFmt(ax, ax.get(t));
  const mark = p => { const cx = sx(p.x), cy = sy(p.y), u = logoOf(p.t);
    return `<a href="${teamL(p.t)}" data-n="${esc(p.t.n)}" data-x="${esc(val(sp.x, p.t))}" data-y="${esc(val(sp.y, p.t))}" aria-label="${esc(p.t.n)}: ${esc(sp.x.n)} ${esc(val(sp.x, p.t))}, ${esc(sp.y.n)} ${esc(val(sp.y, p.t))}">${u
      ? `<circle class="hit" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(S/2).toFixed(1)}"/><image href="${u}" x="${(cx-S/2).toFixed(1)}" y="${(cy-S/2).toFixed(1)}" width="${S.toFixed(1)}" height="${S.toFixed(1)}" data-t="${p.t.slug}"/>`
      : `<circle class="dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${Rr.toFixed(1)}" fill="${esc(p.t.col)}"/>`}</a>`; };
  const ghosts = off.map(p => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${(Rr*.6).toFixed(1)}" fill="${esc(p.t.col)}" opacity=".16"/>`).join('');
  const named = on.length <= (logos ? 16 : 30) ? on : logos ? [] : [...on].sort((a,b) => a.t.rank-b.t.rank).slice(0, narrow ? 6 : 10), placed = [], off0 = logos ? S/2 + 4 : 10;
  const labels = [...named].sort((a,b) => a.t.rank-b.t.rank).map(p => {
    const x = sx(p.x), w = p.t.n.length*6.7 + 6, right = x + off0 + 2 + w > W - pr, xa = right ? x - off0 - w : x + off0;
    let y = sy(p.y) + 4, tries = 0;
    while (placed.some(o => Math.abs(o.y-y) < 13 && xa < o.x + o.w && o.x < xa + w) && tries++ < 10) y += 13;
    placed.push({x:xa, y, w});
    return `<text class="lab" x="${(right ? x-off0 : x+off0).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${right?'end':'start'}">${esc(p.t.n)}</text>`;
  }).join('');
  svg.innerHTML = `<defs><clipPath id="pclip"><rect x="${pl}" y="${pt}" width="${W-pl-pr}" height="${H-pt-pb}"/></clipPath></defs>
    <rect class="frame" x="${pl}" y="${pt}" width="${W-pl-pr}" height="${H-pt-pb}"/>${grid}
    <text class="at" x="${(pl + (W-pl-pr)/2).toFixed(1)}" y="${H-8}" text-anchor="middle">${esc(sp.x.n)}${sp.x.low ? ', fewer is better' : ''}</text>
    <text class="at" transform="translate(13 ${(pt + (H-pt-pb)/2).toFixed(1)}) rotate(-90)" text-anchor="middle">${esc(sp.y.n)}${sp.y.low ? ', fewer is better' : ''}</text>
    <g clip-path="url(#pclip)">${refs}${quad}${ghosts}${on.map(mark).join('')}${labels}</g>`;
  svg.style.touchAction = zoom > 1.02 ? 'none' : 'pan-y';
  svg.classList.toggle('zoomed', zoom > 1.02);
  const zr = document.querySelector('.zb [data-zoom="reset"]'); if (zr) zr.disabled = zoom <= 1.02;
  const zo = document.querySelector('.zb [data-zoom="out"]'); if (zo) zo.disabled = zoom <= 1.02;
  const zi = document.querySelector('.zb [data-zoom="in"]'); if (zi) zi.disabled = zoom >= 15.9;
}
function plotClampDomain(){
  const {d, full} = PLOT, fw = full.x1-full.x0, fh = full.y1-full.y0;
  let w = clamp(d.x1-d.x0, fw/16, fw), h = clamp(d.y1-d.y0, fh/16, fh);
  d.x0 = clamp(d.x0, full.x0, full.x1 - w); d.x1 = d.x0 + w; d.y0 = clamp(d.y0, full.y0, full.y1 - h); d.y1 = d.y0 + h;
}
function plotZoom(f, cx, cy){   // zoom by a factor, keeping the data point (cx, cy) where it is on screen
  const d = PLOT.d; if (cx == null){ cx = (d.x0+d.x1)/2; cy = (d.y0+d.y1)/2; }
  const fw = PLOT.full.x1-PLOT.full.x0, cur = fw/(d.x1-d.x0), nf = clamp(cur*f, 1, 16)/cur;
  d.x0 = cx - (cx-d.x0)/nf; d.x1 = cx + (d.x1-cx)/nf; d.y0 = cy - (cy-d.y0)/nf; d.y1 = cy + (d.y1-cy)/nf;
  plotClampDomain(); plotDraw();
}
function plotReset(){ PLOT.d = {...PLOT.full}; plotDraw(); }
function plotInit(){
  const svg = $('psvg'), tip = $('ptip'); if (!svg) return;
  plotDraw();
  const at = e => {   // pointer position as a data point
    const r = svg.getBoundingClientRect(), P = PLOT, g = P.geom, px = (e.clientX - r.left)/r.width*P.W, py = (e.clientY - r.top)/r.height*P.H;
    return {px, py, x: P.d.x0 + (px-g.pl)/(P.W-g.pl-g.pr)*(P.d.x1-P.d.x0), y: P.d.y0 + (P.H-g.pb-py)/(P.H-g.pt-g.pb)*(P.d.y1-P.d.y0), k: r.width/P.W};
  };
  const ptrs = new Map(); let moved = 0, last = null, pinch = 0;
  const onMove = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    const P = PLOT, g = P.geom, r = svg.getBoundingClientRect();
    if (ptrs.size === 1 && last){
      const dx = e.clientX - last.x, dy = e.clientY - last.y; moved += Math.abs(dx) + Math.abs(dy); last = {x:e.clientX, y:e.clientY};
      const ux = (P.d.x1-P.d.x0)/((P.W-g.pl-g.pr)*r.width/P.W), uy = (P.d.y1-P.d.y0)/((P.H-g.pt-g.pb)*r.height/P.H);
      P.d.x0 -= dx*ux; P.d.x1 -= dx*ux; P.d.y0 += dy*uy; P.d.y1 += dy*uy; plotClampDomain(); plotDraw(); tip.hidden = true;
    } else if (ptrs.size === 2){
      const [a, b] = [...ptrs.values()], dist = Math.hypot(a.x-b.x, a.y-b.y), c = at({clientX:(a.x+b.x)/2, clientY:(a.y+b.y)/2});
      if (pinch){ moved += 10; plotZoom(dist/pinch, c.x, c.y); }
      pinch = dist;
    }
  };
  const onUp = e => { ptrs.delete(e.pointerId); pinch = 0; last = ptrs.size === 1 ? [...ptrs.values()][0] : null;
    if (!ptrs.size){ window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); svg.classList.remove('drag'); } };
  svg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!ptrs.size){ moved = 0; window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp); }
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); last = ptrs.size === 1 ? {x:e.clientX, y:e.clientY} : null; pinch = 0; svg.classList.add('drag');
  });
  svg.addEventListener('dragstart', e => e.preventDefault());
  svg.addEventListener('click', e => { if (moved > 6){ e.preventDefault(); e.stopPropagation(); } }, true);
  svg.addEventListener('dblclick', e => { if (e.target.closest('a')) return; e.preventDefault(); const c = at(e); plotZoom(2, c.x, c.y); });
  svg.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const c = at(e); plotZoom(Math.exp(-e.deltaY*0.01), c.x, c.y); }, {passive:false});
  const showTip = e => {
    const a = e.target.closest && e.target.closest('a[data-n]'); if (!a || ptrs.size){ tip.hidden = true; return; }
    const P = PLOT, stage = svg.parentNode.getBoundingClientRect();
    tip.innerHTML = `<b>${esc(a.dataset.n)}</b>${esc(P.sp.x.n)}: ${esc(a.dataset.x)}<br>${esc(P.sp.y.n)}: ${esc(a.dataset.y)}`; tip.hidden = false;
    const x = e.clientX - stage.left, y = e.clientY - stage.top;
    tip.style.left = clamp(x + 14, 4, stage.width - tip.offsetWidth - 4) + 'px'; tip.style.top = clamp(y - tip.offsetHeight - 10, 4, stage.height - tip.offsetHeight - 4) + 'px';
  };
  svg.addEventListener('mousemove', showTip); svg.addEventListener('mouseleave', () => { tip.hidden = true; });
  svg.addEventListener('focusin', e => { const a = e.target.closest('a[data-n]'); if (a){ const r = a.getBoundingClientRect(); showTip({target:a, clientX:r.left + r.width/2, clientY:r.top}); } });
  svg.addEventListener('focusout', () => { tip.hidden = true; });
}

/* ================= stats ================= */
function viewStats(){
  const side = R.q.side === 'def' ? 'def' : 'off';
  const cols = STATS.filter(s => side==='off' ? s.o : true).map(s => ({n:s.s, f: side==='off' ? s.o : s.d, fmt:s.f, k:s.k}));
  if (side==='off') cols.push({n:'Net pts/scoring opp', f:'netOpp', fmt:v => signed(v,2), k:'net'});
  let s = sortState('idx'); if (!(s.key==='idx' || s.key==='team' || cols.some(c => c.f===s.key))) s = {key:'idx', dir:-1};
  const get = (t,f) => f==='netOpp' ? t.netOpp : t.d[f];
  const rows = T.filter(inGroup);
  if (s.key==='team') rows.sort((a,b) => s.dir*-1*a.n.localeCompare(b.n));
  else if (s.key==='idx') rows.sort((a,b) => -s.dir*(a.rank-b.rank));
  else rows.sort((a,b) => -s.dir*(a.rk[s.key]-b.rk[s.key]));
  const q = findText(), shown = q ? rows.filter(t => t.n.toLowerCase().includes(q)) : rows, N = T.length;
  const head = `<tr>${th('#','num')}${sortTh('team','Team','','idx')}${sortTh('idx','LTF rank','num','idx','ltfrank')}${cols.map(c => sortTh(c.f,c.n,'num','idx',`${c.k}:${side==='off'?'o':'d'}`)).join('')}</tr>`;
  const body = shown.map(t => `<tr><td class="num nat">${rows.indexOf(t)+1}</td>${teamCell(t)}<td class="num">${t.rank}</td>${cols.map(c => {
      const pc = 1-(t.rk[c.f]-1)/(N-1);
      return `<td class="num c ${pc>=.5?'pos':'neg'}" style="--t:${(Math.abs(pc-.5)*2).toFixed(2)}" title="Ranked ${ord(t.rk[c.f])}">${c.fmt(get(t,c.f))}</td>`; }).join('')}</tr>`).join('');
  return {title:'Stats', controls:true, after: plotInit, top: pageTop('Stats', `<b>${groupLabel()}.</b> Every team on one chart, then every stat in one table. Pick what goes on each side of the chart, zoom in on a crowd, and select a team to open their page.`),
    body: `${plotHtml()}
    <section class="sec"><h2>Every stat</h2>
    <div class="seg" role="group" aria-label="Which side of the ball"><a data-keep href="${Lq({side:null, sort:null, dir:null})}" aria-current="${side==='off'}">Offense</a><a data-keep href="${Lq({side:'def', sort:null, dir:null})}" aria-current="${side==='def'}">Defense</a></div>
    <p class="hint">${side==='off'?'What each offense produces.':'What each defense allows. For stop rate and havoc, higher is better.'} Every number is adjusted for opponent. Point at a column heading for what the stat means in plain words, and select it to sort, best first. Greener is better.</p>
    <details class="keyd"><summary>What each stat means, in plain words</summary><dl>${cols.map(c => `<dt>${GLOSS[c.k][0]}</dt><dd>${GLOSS[c.k][1]}</dd>`).join('')}</dl></details>
    <div class="scroll"><table class="grid"><thead>${head}</thead><tbody>${body || emptyRow(cols.length+3,'team')}</tbody></table></div></section>`};
}

/* ================= compare ================= */
function viewCompare(){
  const br = byRank();
  const A = bySlug[R.q.a] || br[0], B = (bySlug[R.q.b] && bySlug[R.q.b] !== A) ? bySlug[R.q.b] : br.find(t => t !== A);
  const site = ['a','b'].includes(R.q.site) ? R.q.site : 'n';
  const names = [...T].sort((a,b) => a.n.localeCompare(b.n));
  const opts = sel => names.map(t => `<option value="${t.slug}"${t===sel?' selected':''}>${esc(t.n)}</option>`).join('');
  const x = lineFor(A, B, site==='a' ? 1 : site==='b' ? -1 : 0);
  const pFav = clamp(Math.round(Math.max(x.pA, 1-x.pA)*100), 50, 99);
  const met = A.sched.filter(e => e.opp === B.n).map(e => e.game.done
    ? `They met in week ${e.wk}: <a class="txt" href="${gameL(e.game)}">${esc(e.pf>e.pa?A.n:B.n)} won ${Math.max(e.pf,e.pa)}-${Math.min(e.pf,e.pa)}</a>.`
    : `They play in week ${e.wk}. <a class="txt" href="${gameL(e.game)}">See the game page</a>`).join(' ');
  const row = (label, a, b, ra, rb, gap, bare) => { const [la, lb] = advPair(ra, rb, gap); return `<tr><td>${label}</td>${advCell(a, bare ? null : ra, la)}${advCell(b, bare ? null : rb, lb)}</tr>`; };
  const grp = label => `<tr class="grp"><td colspan="3">${label}</td></tr>`;
  const pa = projection(A), pb = projection(B);
  const body = [
    row(term('index'), A.idx.toFixed(1), B.idx.toFixed(1), A.rank, B.rank, (A.idx - B.idx)/14),
    `<tr><td>Record</td><td>${A.w}-${A.l}</td><td>${B.w}-${B.l}</td></tr>`,
    `<tr><td>On pace for</td><td>${Math.round(pa.w)} wins</td><td>${Math.round(pb.w)} wins</td></tr>`,
    `<tr><td>${term('ats')}</td><td>${recStr(A.ats.all)}</td><td>${recStr(B.ats.all)}</td></tr>`,
    grp('Parts of the score, national rank'),
    ...COMP.map(c => row(term(c.k, c.name), ord(A.rk[c.k]), ord(B.rk[c.k]), A.rk[c.k], B.rk[c.k], A.z[c.k] - B.z[c.k], true)),
    grp('Offense'),
    ...STATS.filter(s => s.o).map(s => row(term(s.k, s.n), s.f(A.d[s.o]), s.f(B.d[s.o]), A.rk[s.o], B.rk[s.o], goodZ(A, s, 'o') - goodZ(B, s, 'o'))),
    grp('Defense'),
    ...STATS.map(s => row(term(s.k, s.n + (s.dHigh?'':' allowed')), s.f(A.d[s.d]), s.f(B.d[s.d]), A.rk[s.d], B.rk[s.d], goodZ(A, s, 'd') - goodZ(B, s, 'd'))),
    grp('Both sides'),
    row(term('net'), signed(A.netOpp,2), signed(B.netOpp,2), A.rk.netOpp, B.rk.netOpp, (A.netOpp - B.netOpp)/SD.netOpp),
  ].join('');
  const thc = t => `<th><a class="tlink" href="${teamL(t)}">${badge(t,'sm')} ${esc(t.n)}</a></th>`;
  const sl = (v, label) => `<a data-keep href="${Lq({a:A.slug, b:B.slug, site: v==='n' ? null : v})}" aria-current="${site===v}">${label}</a>`;
  return {title:`${A.n} vs ${B.n}`, top: pageTop('Compare', 'Pick any two teams to see them side by side, with the LTF line between them.'),
    body: `<div class="controls"><label>First team <select id="cmp-a" data-pick="a">${opts(A)}</select></label><label>Second team <select id="cmp-b" data-pick="b">${opts(B)}</select></label>
      <div class="seg" role="group" aria-label="Where the game is played">${sl('n','Neutral site')}${sl('a',`At ${esc(A.ab)}`)}${sl('b',`At ${esc(B.ab)}`)}</div></div>
    <p class="verdict">${term('line')}: <b>${x.pts===0 ? "Pick 'em" : esc(x.fav.n)+' '+signed(-x.pts)}</b>. ${x.pts===0 ? 'A coin flip.' : `${esc(x.fav.n)} wins about ${pFav}% of the time.`} ${met}</p>
    ${advKey()}<div class="scroll"><table class="cmp"><thead><tr><th></th>${thc(A)}${thc(B)}</tr></thead><tbody>${body}</tbody></table></div>
    <p class="hint after">Green marks the better number in each row, and the deeper the green, the bigger the gap. The small number beside it is the national rank. Shading goes by how far apart the two teams are next to the rest of the country. Tap a stat name for what it means.</p>`};
}
