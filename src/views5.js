/* ================= model tracker: a live test against the market ================= */
const PICKS = D.picks || [], RSR = M.research || null;
const POWER = ['ACC','Big 12','Big Ten','SEC'];
function pickInfo(p){
  const g = gameById[p.id]; if (!g) return null;
  const h = byName[g.h], a = byName[g.a]; if (!h || !a) return null;
  const gap = p.mm + p.hs, side = gap > 0 ? h : a;
  const lg = p.lm == null ? null : p.lm + p.hs;      // how far the LTF line on file is from the logged market line, toward the home team
  const o = {p, g, h, a, gap, side, lg, ag: lg != null && Math.sign(lg) === Math.sign(gap) && Math.abs(lg) >= 2 && Math.abs(gap) >= 2, q: Math.abs(gap) >= 4, p4: POWER.includes(h.c) && POWER.includes(a.c), late: g.w >= 10, sideLine: side === h ? p.hs : -p.hs};
  if (g.done){ const r = (g.hp - g.ap) + p.hs; o.res = r === 0 ? 0 : ((gap > 0) === (r > 0)) ? 1 : -1; if (g.hs != null) o.clv = side === h ? p.hs - g.hs : g.hs - p.hs; }
  if (p.ou != null && p.mt != null){
    const tg = p.mt - (p.tb || 0) - p.ou; o.tgap = tg; o.tq = Math.abs(tg) >= 4; o.tside = tg > 0 ? 'Over' : 'Under';
    if (g.done){ const tot = g.hp + g.ap; o.tres = tot === p.ou ? 0 : ((tg > 0) === (tot > p.ou)) ? 1 : -1; }
  }
  return o;
}
const tally = xs => { const w = xs.filter(x => x === 1).length, l = xs.filter(x => x === -1).length, p = xs.filter(x => x === 0).length; return {w, l, p, n:w+l, pct: w+l ? w/(w+l) : null, units: w*0.909 - l}; };
const recTxt = r => r.n + r.p ? `${r.w}-${r.l}${r.p ? '-'+r.p : ''}` : 'None yet';
const sprd = v => v === 0 ? "pick 'em" : signed(v);
function viewModel(){
  const all = PICKS.map(pickInfo).filter(Boolean), AGR = M.agree || null;
  if (!all.length) return {title:'Model tracker', top: pageTop('Model tracker', 'A live test of a prediction model against the betting market.'), body:'<p class="empty">The tracker starts with the next data update that has both model lines and market lines.</p>'};
  const graded = all.filter(x => x.res !== undefined), open = all.filter(x => x.res === undefined);
  const cats = [
    ['Spread, model differs by 4 or more', graded.filter(x => x.q).map(x => x.res), 'The main test'],
    ['Spread, power-conference matchups only', graded.filter(x => x.q && x.p4).map(x => x.res), 'Looked best in past seasons'],
    ['Spread, week 10 and later only', graded.filter(x => x.q && x.late).map(x => x.res), 'Looked best in past seasons'],
    ['Spread, LTF and the model on the same side by 2 or more', graded.filter(x => x.ag).map(x => x.res), AGR ? `New test. Covered ${AGR.open2.pct}% against opening lines in past seasons` : 'New test'],
    ['Spread, model differs by less than 4', graded.filter(x => !x.q).map(x => x.res), 'Tracked for comparison, not a pick'],
    ['Totals, model differs by 4 or more', graded.filter(x => x.tq && x.tres !== undefined).map(x => x.tres), 'Second test'],
  ].map(([n, xs, note]) => ({n, r: tally(xs), note}));
  const main = cats[0].r, clv = graded.filter(x => x.q && x.clv != null).map(x => x.clv);
  const tag = x => `${x.p4 ? '<span class="tag o">Power matchup</span> ' : ''}${x.late ? '<span class="tag o">Week 10+</span> ' : ''}${x.ag ? '<span class="tag o">LTF agrees</span>' : ''}`;
  const game = x => `<a class="tlink" href="${gameL(x.g)}">${esc(x.g.a)} ${x.g.n?'vs':'at'} ${esc(x.g.h)}</a>`;
  const mline = x => x.p.mm === 0 ? "Pick 'em" : `${esc((x.p.mm > 0 ? x.h : x.a).ab)} ${signed(-Math.abs(x.p.mm))}`;
  const wk = M.next, cur = open.filter(x => x.g.w === wk);
  const sp = cur.filter(x => x.q).sort((a,b) => Math.abs(b.gap)-Math.abs(a.gap)).map(x => `<tr><td class="wrap2">${game(x)}</td><td class="cn">${esc(x.side.n)} ${sprd(x.sideLine)}</td><td class="wide">${mline(x)}</td><td class="num">${Math.abs(x.gap).toFixed(1)}</td><td class="wide">${tag(x)}</td></tr>`).join('');
  const tp = cur.filter(x => x.tq).sort((a,b) => Math.abs(b.tgap)-Math.abs(a.tgap)).map(x => `<tr><td class="wrap2">${game(x)}</td><td class="cn">${x.tside} ${x.p.ou}</td><td class="wide">${(x.p.mt - (x.p.tb||0)).toFixed(1)}</td><td class="num">${Math.abs(x.tgap).toFixed(1)}</td></tr>`).join('');
  const agr = cur.filter(x => x.ag).sort((a,b) => (Math.abs(b.gap) + Math.abs(b.lg)) - (Math.abs(a.gap) + Math.abs(a.lg))).map(x => `<tr><td class="wrap2">${game(x)}</td><td class="cn">${esc(x.side.n)} ${sprd(x.sideLine)}</td><td class="num">${Math.abs(x.lg).toFixed(1)}</td><td class="num">${Math.abs(x.gap).toFixed(1)}</td></tr>`).join('');
  const res = v => v === 1 ? '<span class="res up">Won</span>' : v === -1 ? '<span class="res down">Lost</span>' : 'Push';
  const done = graded.filter(x => x.q || x.tq).sort((a,b) => b.g.w - a.g.w || Math.abs(b.gap) - Math.abs(a.gap)).map(x => `<tr><td class="num">${x.g.w}</td><td class="wrap2"><a class="tlink" href="${gameL(x.g)}">${finalTxt(x.g)}</a></td>
      <td>${x.q ? `${esc(x.side.ab)} ${sprd(x.sideLine)}` : '<span class="cf">no pick</span>'}</td><td>${x.q ? res(x.res) : ''}</td><td class="num wide">${x.q && x.clv != null ? signed(x.clv) : ''}</td>
      <td class="wide">${x.tq ? `${x.tside} ${x.p.ou}` : '<span class="cf">no pick</span>'}</td><td class="wide">${x.tq && x.tres !== undefined ? res(x.tres) : ''}</td></tr>`).join('');
  const crow = c => `<tr><td class="cn wrap2">${c.n}<span class="cf blk">${c.note}</span></td><td class="num">${recTxt(c.r)}</td><td class="num">${c.r.pct == null ? '\u2013' : (100*c.r.pct).toFixed(1)+'%'}</td><td class="num">${c.r.n ? signed(c.r.units, 1) : '\u2013'}</td></tr>`;
  const R = RSR, pc = ([w,l]) => `${(100*w/(w+l)).toFixed(1)}%`, wlr = ([w,l]) => `${w.toLocaleString()}-${l.toLocaleString()}`;
  const hist = R ? `<section class="sec"><h2>What past seasons say</h2><p class="hint">The same model, trained only on earlier seasons each time, on ${R.games.toLocaleString()} games from ${R.seasons}. A bettor needs about 52.4% to break even.</p>
    <div class="scroll"><table class="grid"><thead><tr><th>Test</th><th class="num">Record</th><th class="num">Hit rate</th></tr></thead><tbody>
    <tr><td>Against the closing spread, every game</td><td class="num">${wlr(R.atsClose)}</td><td class="num">${pc(R.atsClose)}</td></tr>
    <tr><td>Against the closing spread, differs by 4 or more</td><td class="num">${wlr(R.gap4Close)}</td><td class="num">${pc(R.gap4Close)}</td></tr>
    <tr><td>Against the opening spread, differs by 4 or more</td><td class="num">${wlr(R.gap4Open)}</td><td class="num">${pc(R.gap4Open)}</td></tr>
    <tr><td class="wrap2">Opening spread, power-conference matchups, differs by 4 or more</td><td class="num">${wlr(R.p4Open)}</td><td class="num">${pc(R.p4Open)}</td></tr>
    <tr><td class="wrap2">Opening spread, week 10 and later, differs by 4 or more</td><td class="num">${wlr(R.lateOpen)}</td><td class="num">${pc(R.lateOpen)}</td></tr>
    ${AGR ? `<tr><td class="wrap2">LTF and the model on the same side, opening spread, ${AGR.seasons}</td><td class="num">${AGR.open.n.toLocaleString()} games</td><td class="num">${AGR.open.pct}%</td></tr>
    <tr><td class="wrap2">The same, closing spread</td><td class="num">${AGR.close.n.toLocaleString()} games</td><td class="num">${AGR.close.pct}%</td></tr>` : ''}
    <tr><td>Opening totals, lean removed, differs by 4 or more</td><td class="num">1,004-866</td><td class="num">53.7%</td></tr>
    <tr><td>Closing totals, every game</td><td class="num"></td><td class="num">${R.totClose}%</td></tr>
    <tr><td>Moneylines</td><td class="num"></td><td class="num">Lost ${Math.abs(R.ml)}% per bet</td></tr></tbody></table></div>
    <p class="hint after">Nothing beat the closing line. The better rows are all against opening lines, and they were picked out after looking at many slices, which is how lucky ones turn up. When the model and the opening line differed by 4 or more, the line later moved toward the model ${R.moveToward}% of the time, by ${R.movePts} points on average. That is the reason to test it live.</p></section>` : '';
  return {title:'Model tracker', top: pageTop('Model tracker', 'A live test of a prediction model against the betting market, graded in public. The rules were fixed before the first pick. This is an experiment, not betting advice.'),
    body: `<div class="facts">${fact('Spread picks graded', recTxt(main), main.pct == null ? `${open.filter(x => x.q).length} picks waiting on results` : `${(100*main.pct).toFixed(1)}%. Needs 52.4% to break even`)}
      ${fact('Units at standard pricing', main.n ? signed(main.units, 1) : '0', 'risking 1.1 to win 1 on each pick')}
      ${fact('Line value', clv.length ? signed(mean(clv), 2) + ' pts' : '\u2013', 'how far the closing line moved toward the picks')}
      ${fact('Games logged', all.length, `since week ${Math.min(...all.map(x => x.g.w))}. Model version ${M.model ? M.model.version : 1}`)}</div>
    <section class="sec"><h2>Week ${wk} spread picks</h2><p class="hint">Games where the model's line differs from the market line by 4 or more points. The pick is the side the model rates higher, at the line shown, which was the ${esc(M.book)} line on the day it was logged.</p>
      <div class="scroll"><table class="grid"><thead><tr><th>Game</th><th>Pick</th><th class="wide">Model line</th><th class="num">Differs by</th><th class="wide">Watch list</th></tr></thead><tbody>${sp || '<tr><td class="empty" colspan="5">No game differs by 4 or more this week.</td></tr>'}</tbody></table></div></section>
    <section class="sec"><h2>Week ${wk} totals picks</h2><p class="hint">Same rule for the over-under. The model's season-long lean against the market total is removed first.</p>
      <div class="scroll"><table class="grid"><thead><tr><th>Game</th><th>Pick</th><th class="wide">Model total</th><th class="num">Differs by</th></tr></thead><tbody>${tp || '<tr><td class="empty" colspan="4">No total differs by 4 or more this week.</td></tr>'}</tbody></table></div></section>
    ${agr ? `<section class="sec"><h2>Week ${wk}: LTF and the model on the same side</h2><p class="hint">A second test, started in week 6. Both the LTF line and the model's line are 2 or more points off the market line, in the same direction.${AGR ? ` In past seasons that side covered ${AGR.open2.pct}% against opening lines across ${AGR.open2.n} games, and the line then moved its way ${AGR.open2.toward}% of the time. Against closing lines it was a coin flip, so the early number is the whole point.` : ''}</p>
      <div class="scroll"><table class="grid"><thead><tr><th>Game</th><th>Side</th><th class="num">LTF differs by</th><th class="num">Model differs by</th></tr></thead><tbody>${agr}</tbody></table></div></section>` : ''}
    <section class="sec"><h2>Record by test</h2><div class="scroll"><table class="grid"><thead><tr><th>Test</th><th class="num">Record</th><th class="num">Hit rate</th><th class="num">Units</th></tr></thead><tbody>${cats.map(crow).join('')}</tbody></table></div></section>
    <section class="sec"><h2>Graded picks</h2><div class="scroll"><table class="grid"><thead><tr><th class="num">Wk</th><th>Final</th><th>Spread pick</th><th>Result</th><th class="num wide">Line value</th><th class="wide">Totals pick</th><th class="wide">Result</th></tr></thead><tbody>${done || '<tr><td class="empty" colspan="7">Nothing graded yet. Results appear after the first week of picks is played.</td></tr>'}</tbody></table></div></section>
    <section class="sec prose"><h2>The rules</h2>
      <p>The model is separate from the LTF Index. The LTF Index ranks teams and sets the LTF line. The model exists only to predict margins and totals, and it was fitted on ${M.model ? M.model.games.toLocaleString() : ''} games from ${M.model ? M.model.trained : ''}. It uses this season's play-by-play stats, last season's ratings, Elo and rest days.</p>
      <p>Each week, the first time a game has both a model line and a market line, both are logged and never changed. A game becomes a pick when they differ by 4 or more points. Every pick is graded against the logged line, win or lose, and nothing is removed.</p>
      <p>The model can change between weeks, but only after the change has been tested on past seasons, and never for picks already logged. Each version is numbered here.</p>
      <p>In week 6 a second test was added: games where the LTF line and the model's line are both 2 or more points off the market line on the same side. It is graded the same way, against the line on the day it was logged.</p>
      <p>Version 1 is the current model. In October 2026 seven additions were tested on 2017 to 2025 and none made it more accurate, so none were adopted: run and pass splits, style matchups, down situations, luck, quarterback tracking, travel, and how steady each team is.</p>
      <p>A season of picks is too few to prove an edge either way. A few hundred are needed before the hit rate means much, so line value is the early signal to watch: if the closing line keeps moving toward the picks, the model is seeing something real.</p></section>
    ${hist}${fine}`};
}

/* ================= reputation gap ================= */
function viewReputation(){
  const q = findText(), s = sortState('gap');
  const all = T.filter(t => t.d.mkt != null).map(t => ({t, pts: t.d.mkt - idxPts(t), spots: t.rank - t.mktRank}));
  if (!all.length) return {title:'Reputation gap', top: pageTop('Reputation gap', 'How the betting market rates each team, next to LTF.'), body:'<p class="empty">Market ratings appear once there are enough betting lines this season.</p>'};
  let rows = all.filter(x => inGroup(x.t));
  const val = x => s.key==='gap' ? x.pts : s.key==='idx' ? -x.t.rank : s.key==='mkt' ? -x.t.mktRank : s.key==='spots' ? x.spots : s.key==='ap' ? -(x.t.d.apr || 99) : 0;
  if (s.key==='team') rows.sort((a,b) => s.dir*-1*a.t.n.localeCompare(b.t.n)); else rows.sort((a,b) => s.dir*(val(a)-val(b)));
  if (q) rows = rows.filter(x => x.t.n.toLowerCase().includes(q));
  const scoped = all.filter(x => inGroup(x.t));
  const li = x => rowB(x.t, x.t.rank, `market ${ord(x.t.mktRank)}, <b class="mnum">${Math.abs(x.pts).toFixed(1)} pts</b>`);
  const hi = [...scoped].sort((a,b) => b.pts-a.pts).slice(0,6).map(li).join(''), lo = [...scoped].sort((a,b) => a.pts-b.pts).slice(0,6).map(li).join('');
  const body = rows.map(x => `<tr>${teamCell(x.t)}<td class="num">${x.t.rank}</td><td class="num">${x.t.mktRank}</td>
      <td class="num wide">${x.spots === 0 ? '<span class="mv same">same</span>' : `<span class="mv ${x.spots>0?'down':'up'}">${Math.abs(x.spots)} ${x.spots>0?'higher in the market':'higher in LTF'}</span>`}</td>
      <td class="num c ${x.pts>=0?'neg':'pos'}" style="--t:${Math.min(1, Math.abs(x.pts)/12).toFixed(2)}">${Math.abs(x.pts) < 0.05 ? 'Even' : `${x.pts>0?'Market':'LTF'} +${Math.abs(x.pts).toFixed(1)}`}</td>
      <td class="num wide">${M.apWeek == null ? '' : x.t.d.apr ? x.t.d.apr : '<span class="cf">NR</span>'}</td></tr>`).join('');
  return {title:'Reputation gap', controls:true, top: pageTop('Reputation gap', `<b>${groupLabel()}.</b> The betting market has its own opinion of every team, and it can be read back out of the point spreads. This page puts that opinion next to LTF, which ignores names, polls and preseason hype.`),
    body: `<div class="panels">
      <section class="panel"><h2>The market rates them higher</h2><p class="hint">Bigger name than their numbers, or the market knows something LTF cannot see.</p><ol class="rows">${hi}</ol></section>
      <section class="panel"><h2>LTF rates them higher</h2><p class="hint">Better numbers than their name, or LTF is being fooled by a small sample.</p><ol class="rows">${lo}</ol></section></div>
    <p class="next"><a class="btn" href="${L('stats', null, {chart:'mk'})}">See it as a chart</a></p>
    <section class="sec"><h2>Every team</h2>${colKey([['LTF rank', 'Where the LTF Index has the team.'], ['Market rank', 'Where the betting market has them, worked out from recent point spreads.'], ['Points apart', 'How many points better one side rates the team than the other does.'], ['AP poll', 'For comparison only.', true]])}
      <div class="scroll"><table class="grid"><thead><tr>${sortTh('team','Team','','gap')}${sortTh('idx','LTF rank','num','gap','ltfrank')}${sortTh('mkt','Market rank','num','gap','mkt')}${sortTh('spots','Difference','num wide','gap')}${sortTh('gap','Points apart','num','gap')}${sortTh('ap','AP poll','num wide','gap','apr')}</tr></thead><tbody>${body || emptyRow(6,'team')}</tbody></table></div></section>
    <div class="note"><p>Read this as a list of questions, not verdicts. Over five past seasons the market predicted games a little better than LTF, so when they disagree the market is right more often than not. A gap can mean the market is paying for a famous name. It can also mean an injury, a quarterback change or a schedule quirk that LTF has no way to see. The market rating uses closing spreads from the last three weeks plus this week's lines, with newer lines counting for more.</p></div>
    <p class="next"><a class="txt" href="${L('radar')}">Where the polls and LTF disagree</a> &nbsp; <a class="txt" href="${L('blind')}">Try the blind résumé test</a></p>`};
}

/* ================= blind résumé ================= */
function blindPairs(){   // teams LTF has close together, where one has the bigger name
  const top = byRank().filter(t => t.rank <= 60 && t.g.length >= 3), out = [];
  for (let i = 0; i < top.length; i++) for (let j = i+1; j < top.length; j++){
    const a = top[i], b = top[j]; if (b.rank - a.rank > 8) break;
    const brand = (a.tier !== b.tier) || (!!a.d.apr !== !!b.d.apr);
    if (brand) out.push([a, b]);
  }
  let seed = 20261 + M.through*977;                     // same order for everyone, new each week
  const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (let i = out.length - 1; i > 0; i--){ const j = Math.floor(rnd()*(i+1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.map(p => rnd() < .5 ? p : [p[1], p[0]]);
}
function viewBlind(){
  const pairs = blindPairs();
  if (!pairs.length) return {title:'Blind résumé', top: pageTop('Blind résumé', 'Two teams, no names. Pick the better one.'), body:'<p class="empty">The blind résumé test starts once teams have played three games.</p>'};
  const n = ((parseInt(R.q.n, 10) || 1) - 1 + pairs.length*1000) % pairs.length, [A, B] = pairs[n], pick = R.q.pick === 'a' || R.q.pick === 'b' ? R.q.pick : null;
  const wins = t => t.g.filter(e => e.pf > e.pa).map(e => ({e, o: byName[e.opp]})).sort((x,y) => (x.o ? x.o.rank : 999) - (y.o ? y.o.rank : 999));
  const losses = t => t.g.filter(e => e.pf < e.pa).map(e => ({e, o: byName[e.opp]}));
  const opp = x => x.o ? `No. ${x.o.rank}` : 'an FCS team';
  const where = e => e.site === 'A' ? ' on the road' : e.site === 'N' ? ' at a neutral site' : ' at home';
  const card = (t, lab) => { const w = wins(t), l = losses(t);
    const rows = [['Record', `${t.w}-${t.l}`], ['Strength of record', `${ord(t.rk.sor)} of ${T.length}`], ['Schedule so far', `${ord(t.rk.sos)} hardest`], ['Scoring margin', `${signed(t.d.mar)} a game against an average team`],
      ['Offense', `${ord(t.rk.off)}`], ['Defense', `${ord(t.rk.def)}`], ['Points per drive', `${t.d.oppd.toFixed(2)} scored, ${t.d.dppd.toFixed(2)} allowed`], ['Luck', t.luck == null ? '\u2013' : `${signed(t.luck)} points a game`]];
    return `<section class="panel blindc"><h2>${lab}</h2><table class="log"><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="cn">${r[1]}</td></tr>`).join('')}</tbody></table>
      <h3>Best wins</h3><ul class="plain">${w.slice(0,3).map(x => `<li>Beat ${opp(x)} by ${x.e.pf - x.e.pa}${where(x.e)}</li>`).join('') || '<li>None yet</li>'}</ul>
      <h3>Losses</h3><ul class="plain">${l.map(x => `<li>Lost to ${opp(x)} by ${x.e.pa - x.e.pf}${where(x.e)}</li>`).join('') || '<li>None</li>'}</ul>
      ${pick ? '' : `<a class="btn" data-keep href="${Lq({pick: lab === 'Team A' ? 'a' : 'b'})}">${lab} is better</a>`}</section>`; };
  const reveal = t => `<div class="rev">${badge(t)}<span>${tl(t)}<small>${esc(t.c)}. LTF No. ${t.rank}${M.apWeek == null ? '' : `, AP ${t.d.apr ? 'No. ' + t.d.apr : 'unranked'}`}${t.mktRank ? `, market ${ord(t.mktRank)}` : ''}</small></span></div>`;
  let result = '';
  if (pick){
    const chosen = pick === 'a' ? A : B, other = pick === 'a' ? B : A, idxPick = A.rank < B.rank ? A : B;
    const apPick = M.apWeek == null ? null : (A.d.apr || 99) === (B.d.apr || 99) ? null : (A.d.apr || 99) < (B.d.apr || 99) ? A : B;
    const mkPick = A.mktRank && B.mktRank ? (A.mktRank < B.mktRank ? A : B) : null;
    result = `<section class="sec"><h2>You picked ${esc(chosen.n)}</h2><div class="dgrid"><div><p class="hint">Team A</p>${reveal(A)}<p class="hint">Team B</p>${reveal(B)}</div>
      <div class="prose"><p>LTF ${idxPick === chosen ? 'agrees with you' : 'went the other way'}: it has ${esc(idxPick.n)} ${Math.abs(A.rank - B.rank)} ${Math.abs(A.rank - B.rank) === 1 ? 'spot' : 'spots'} higher.</p>
        ${apPick ? `<p>The AP poll has ${esc(apPick.n)} higher${apPick === chosen ? ', the same as you' : ''}.</p>` : M.apWeek == null ? '' : '<p>The AP poll ranks neither team.</p>'}
        ${mkPick ? `<p>The betting market rates ${esc(mkPick.n)} higher${mkPick === chosen ? ', the same as you' : ''}.</p>` : ''}
        <p><a class="btn" href="${L('compare', null, {a:A.slug, b:B.slug})}">Compare them in full</a></p></div></div></section>`;
  }
  return {title:'Blind résumé', top: pageTop('Blind résumé', 'Two real teams with the names taken off. Read what each has done this season and pick the better one. Then see who they are, and whether the polls and the market agree with you.'),
    body: `<p class="status">Matchup ${n+1} of ${pairs.length} this week.</p><div class="panels">${card(A, 'Team A')}${card(B, 'Team B')}</div>${result}
      <p class="next"><a class="btn go" href="${L('blind', null, {n: n+2 > pairs.length ? 1 : n+2})}">Next matchup</a> &nbsp; <a class="txt" href="${L('reputation')}">Reputation gap</a></p>`};
}

/* ================= luck and steadiness ================= */
function viewLuck(){
  const q = findText(), s = sortState('luck');
  let rows = T.filter(t => t.luck != null && inGroup(t));
  if (!rows.length) return {title:'Luck and steadiness', controls:true, top: pageTop('Luck and steadiness', 'Who has had the breaks, and who plays the same every week.'), body:'<p class="empty">No teams match.</p>'};
  const val = t => s.key==='luck' ? t.luck : s.key==='fum' ? t.d.lk.fum : s.key==='int' ? t.d.lk.int : s.key==='fg' ? t.d.lk.fg : s.key==='close' ? (t.d.lk.cl[1] ? t.d.lk.cl[0]/t.d.lk.cl[1] : 0.5) + t.d.lk.cl[0]/100 : s.key==='steady' ? -(t.swing ?? 99) : s.key==='idx' ? -t.rank : 0;
  if (s.key==='team') rows.sort((a,b) => s.dir*-1*a.n.localeCompare(b.n)); else rows.sort((a,b) => s.dir*(val(a)-val(b)));
  const scoped = [...rows]; if (q) rows = rows.filter(t => t.n.toLowerCase().includes(q));
  const li = t => rowB(t, t.rank, `<b class="mnum">${signed(t.luck)} pts a game</b>`);
  const top = [...scoped].sort((a,b) => b.luck-a.luck), steady = scoped.filter(t => t.swing != null).sort((a,b) => a.swing-b.swing);
  const cell = (v, d=2) => `<td class="num wide c ${v>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(v)/1.2).toFixed(2)}">${signed(v, d)}</td>`;
  const body = rows.map(t => { const k = t.d.lk;
    return `<tr>${teamCell(t)}<td class="num wide">${t.rank}</td><td class="num">${t.w}-${t.l}</td><td class="num c ${t.luck>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(t.luck)/7).toFixed(2)}"><b>${signed(t.luck)}</b></td>
      <td class="num wide">${k.fg_[0]} of ${k.fg_[1]}</td>${cell(k.int)}<td class="num wide">${k.ofg[0]} of ${k.ofg[1]}</td><td class="num">${k.cl[1] ? `${k.cl[0]}-${k.cl[1]-k.cl[0]}` : '\u2013'}</td>
      <td class="num">${t.swing == null ? '\u2013' : `${steadyWord(t)} <span class="cf">\u00B1${t.swing.toFixed(0)}</span>`}</td></tr>`; }).join('');
  return {title:'Luck and steadiness', controls:true, top: pageTop('Luck and steadiness', `<b>${groupLabel()}.</b> Some things swing games but mostly do not repeat: which way a fumble bounces, whether a tipped pass gets picked off, whether the other kicker has a bad day. This page adds those up, and shows which teams play to the same level every week.`),
    body: `<div class="panels">
      <section class="panel"><h2>Luckiest</h2><p class="hint">Results have flattered them a little.</p><ol class="rows">${top.slice(0,5).map(li).join('')}</ol></section>
      <section class="panel"><h2>Unluckiest</h2><p class="hint">Better than their results so far.</p><ol class="rows">${top.slice(-5).reverse().map(li).join('')}</ol></section>
      <section class="panel"><h2>Steadiest</h2><p class="hint">Smallest swing in game score from week to week.</p><ol class="rows">${steady.slice(0,5).map(t => rowB(t, t.rank, `\u00B1${t.swing.toFixed(0)}`)).join('')}</ol></section>
      <section class="panel"><h2>Most up and down</h2><p class="hint">You never know which version shows up.</p><ol class="rows">${steady.slice(-5).reverse().map(t => rowB(t, t.rank, `\u00B1${t.swing.toFixed(0)}`)).join('')}</ol></section></div>
    <section class="sec"><h2>Every team</h2>${colKey([['Luck, points a game', 'Points a game gained or lost to things that mostly do not repeat. Above zero is good luck.'], ['Fumbles recovered', 'Loose balls the team got, out of all fumbles in their games. Half is normal.', true], ['Interception luck', 'Interceptions gained or lost per game compared with passes defended.', true], ['Opponent field goals', 'Kicks made against the team, out of kicks attempted.', true], ['One-score games', 'Record in games decided by 8 points or fewer.'], ['Steadiness', 'How much the team\'s game scores swing from week to week.']])}
      <div class="scroll"><table class="grid"><thead><tr>${sortTh('team','Team','','luck')}${sortTh('idx','LTF rank','num wide','luck','ltfrank')}${th('Record','num','rec')}${sortTh('luck','Luck, points a game','num','luck','luck')}${sortTh('fum','Fumbles recovered','num wide','luck')}${sortTh('int','Interception luck','num wide','luck')}${sortTh('fg','Opponent field goals','num wide','luck')}${sortTh('close','One-score games','num','luck')}${sortTh('steady','Steadiness','num','luck','steady')}</tr></thead><tbody>${body || emptyRow(9,'team')}</tbody></table></div></section>
    <div class="note"><p><b>How luck is counted.</b> Teams recover about half of all fumbles over time, so every recovery above or below half counts as luck. About one in five passes a defense gets a hand on is intercepted, so more or fewer than that counts too. Each turnover is valued at 4.5 points. Opponents' field goal kicking is compared with the national average. One-score games are shown but not added in.</p>
      <p><b>Does it predict anything?</b> Lucky teams do tend to come back to earth, but the betting market already knows that. In a test on 2017 to 2025, backing the unluckier team covered the spread 51% of the time, which is not enough to matter. Luck is here to explain results, not to bet on.</p>
      <p><b>What about steadiness?</b> Steady favorites won ${CFD.steady.act}% of the time when LTF expected ${CFD.steady.pred}%, across ${CFD.steady.n} past games. That small boost shows up in the reasons under a pick. Against the spread it did nothing: backing the steadier team covered 50.1% of the time.</p></div>`};
}
