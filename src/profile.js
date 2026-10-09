/* ================= team profiles ================= */
/* Two radar charts per team, offense and defense, sixteen measures each, as percentiles among the FBS teams: 100 is
   the best in the country on that measure and 50 is the middle, on both sides of the ball. The numbers behind them are
   adjusted for opponent the same way the LTF Index's own are, with garbage time left out, so a team that piled up
   numbers on weak opponents does not get a big shape for free. Raw numbers sit beside them for comparison.
   Profiles are shown, never scored. */
const PAXES = [      // k: key, src: 'd' = a field LTF already keeps, 'p' = a profile number. lo: lower is better for an offense.
  {k:'epa', n:'EPA per play', s:'EPA/play', src:'d', o:'oepa', d:'depa', raw:'epa', f:v => signed(v, 3), g:'all'},
  {k:'ed', n:'Early-down EPA', s:'Early downs', src:'p', raw:'early', f:v => signed(v, 3), g:'all'},
  {k:'ld', n:'Late-down success', s:'Late downs', src:'p', raw:'late', f:v => (v*100).toFixed(1) + '%', g:'all'},
  {k:'d3', n:'Distance on third down', s:'3rd-down distance', src:'p', raw:'dist3', lo:true, f:v => v.toFixed(1) + ' yds', g:'all'},
  {k:'ru', n:'Rushing EPA per play', s:'Rush EPA', src:'d', o:'oru', d:'dru', raw:'repa', f:v => signed(v, 3), g:'run'},
  {k:'stuff', n:'Stuff rate', s:'Stuffed', src:'p', raw:'stuff', lo:true, f:v => (v*100).toFixed(1) + '%', g:'run'},
  {k:'ly', n:'Line yards per carry', s:'Line yards', src:'p', raw:'ly', f:v => v.toFixed(2), g:'run'},
  {k:'opp', n:'Opportunity rate', s:'Opportunity', src:'p', raw:'opp', f:v => (v*100).toFixed(1) + '%', g:'run'},
  {k:'rexp', n:'Explosive run rate', s:'Explosive runs', src:'p', raw:'rexp', f:v => (v*100).toFixed(1) + '%', g:'run'},
  {k:'exp', n:'Explosive play rate', s:'Explosive', src:'d', o:'oexp', d:'dexp', raw:'expl', f:v => v.toFixed(1) + '%', g:'all'},
  {k:'pexp', n:'Explosive pass rate', s:'Explosive passes', src:'p', raw:'pexp', f:v => (v*100).toFixed(1) + '%', g:'pass'},
  {k:'nx', n:'EPA on non-explosive plays', s:'Non-explosive EPA', src:'p', raw:'nx', f:v => signed(v, 3), g:'pass'},
  {k:'pa', n:'Passing EPA per play', s:'Pass EPA', src:'d', o:'opa', d:'dpa', raw:'pepa', f:v => signed(v, 3), g:'pass'},
  {k:'ydb', n:'Yards per dropback', s:'Yards/dropback', src:'p', raw:'ydb', f:v => v.toFixed(2), g:'pass'},
  {k:'psr', n:'Passing success rate', s:'Pass success', src:'p', raw:'psr', f:v => (v*100).toFixed(1) + '%', g:'pass'},
  {k:'hav', n:'Havoc', s:'Havoc', src:'p', raw:'havoc', lo:true, f:v => (v*100).toFixed(1) + '%', g:'all'},
];
const HAS_PROFILE = T.some(t => t.s && t.s.po && t.s.po.length);
const pval = (t, ax, side) => ax.src === 'd' ? t.d[side === 'o' ? ax.o : ax.d] : (t.s && t.s[side === 'o' ? 'po' : 'pd'] ? t.s[side === 'o' ? 'po' : 'pd'][PKI[ax.k]] : null);
let _pct = null;
function profilePct(){      // percentile and rank of every team on every axis, offense and defense
  if (_pct) return _pct;
  const out = new Map(T.map(t => [t, {o: {}, d: {}}])), n = T.length;
  for (const side of ['o', 'd']) for (const ax of PAXES){
    const hi = side === 'o' ? !ax.lo : !!ax.lo;      // for a defense, allowing less is better, except where forcing more is the point
    const vals = T.filter(t => pval(t, ax, side) != null).sort((a, b) => hi ? pval(b, ax, side) - pval(a, ax, side) : pval(a, ax, side) - pval(b, ax, side));
    vals.forEach((t, i) => { out.get(t)[side][ax.k] = {r: i + 1, p: Math.round(100*(vals.length - 1 - i)/Math.max(1, vals.length - 1)), v: pval(t, ax, side)}; });
  }
  return _pct = out;
}
/* the chart: the sixteen spokes, rings at 25, 50, 75 and 100, running measures on one side and passing on the other */
function radar(series, opt = {}){
  const S = 400, c = S/2, R0 = 150, n = PAXES.length, ang = i => -Math.PI/2 + 2*Math.PI*i/n;
  const pt = (i, v) => [c + Math.cos(ang(i))*R0*v/100, c + Math.sin(ang(i))*R0*v/100];
  const wedge = (g, cls) => { const idx = PAXES.map((a, i) => a.g === g ? i : -1).filter(i => i >= 0); if (!idx.length) return '';
    const a0 = ang(idx[0]) - Math.PI/n, a1 = ang(idx[idx.length - 1]) + Math.PI/n, r = R0 + 6;
    return `<path class="${cls}" d="M${c},${c} L${(c + Math.cos(a0)*r).toFixed(1)},${(c + Math.sin(a0)*r).toFixed(1)} A${r},${r} 0 0 1 ${(c + Math.cos(a1)*r).toFixed(1)},${(c + Math.sin(a1)*r).toFixed(1)} Z"/>`; };
  const rings = [25, 50, 75, 100].map(v => `<polygon class="rg${v === 50 ? ' mid' : ''}" points="${PAXES.map((_, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ')}"/>`).join('');
  const spokes = PAXES.map((_, i) => { const [x, y] = pt(i, 100); return `<line class="sp" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const labels = PAXES.map((a, i) => { const [x, y] = pt(i, 111), cs = Math.cos(ang(i)), anchor = Math.abs(cs) < 0.2 ? 'middle' : cs > 0 ? 'start' : 'end';
    return `<text class="al ${a.g}" x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="${anchor}">${esc(a.s)}</text>`; }).join('');
  const polys = series.map((s, si) => { const pts = PAXES.map((a, i) => pt(i, Math.max(3, s.vals[a.k] ? s.vals[a.k].p : 0)));
    return `<polygon class="ps s${si}" points="${pts.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ')}"/>` + pts.map((p, i) => { const a = PAXES[i], v = s.vals[a.k];
      return `<circle class="pd s${si}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${si ? 3.4 : 4.2}"><title>${esc(s.label)}, ${esc(a.n)}: ${v ? `${v.p}th percentile, ${ord(v.r)} of ${T.length}` : 'no number yet'}</title></circle>`; }).join(''); }).join('');
  return `<svg class="radar${opt.cls ? ' ' + opt.cls : ''}" viewBox="-112 -12 ${S + 224} ${S + 24}" role="img" aria-label="${esc(opt.label || 'Profile')}">${wedge('run', 'wr')}${wedge('pass', 'wp')}${rings}${spokes}
    <text class="rn" x="${c + 3}" y="${c - R0*0.5 + 12}">50</text><text class="rn" x="${c + 3}" y="${c - R0 + 12}">100</text>${polys}${labels}</svg>`;
}
const profileOf = (t, side) => profilePct().get(t)[side];
function profileTable(t, side){      // the numbers behind the chart, for a phone where nothing can be pointed at
  const pr = profileOf(t, side);
  return `<details class="keyd ptab"><summary>The numbers behind the ${side === 'o' ? 'offense' : 'defense'} chart</summary><div class="scroll"><table class="log"><thead><tr><th>Measure</th><th class="num">Percentile</th><th class="num">Rank</th><th class="num">LTF, adjusted</th><th class="num">Raw</th></tr></thead><tbody>
    ${PAXES.map(a => { const v = pr[a.k], d = STATBY[a.raw], rv = d ? statVal(t, d, side, 'rate') : null;
      return `<tr><td><a class="txt" href="${statL(d, side, 'rate')}">${esc(a.n)}</a></td><td class="num"><b>${v ? v.p : '–'}</b></td><td class="num">${v ? v.r : '–'}</td><td class="num">${v ? a.f(v.v) : '–'}</td><td class="num">${rv == null ? '–' : sfmt(rv, d.fmt)}</td></tr>`; }).join('')}</tbody></table></div></details>`;
}
function profileBlock(t){
  if (!HAS_PROFILE) return '<p class="empty">Profiles show up once the season\'s play-by-play is in.</p>';
  const one = side => `<div class="pfig"><h3 class="th2">${side === 'o' ? 'Offense' : 'Defense'}</h3>${radar([{label: `${t.n} ${side === 'o' ? 'offense' : 'defense'}`, vals: profileOf(t, side)}], {label: `${t.n} ${side === 'o' ? 'offense' : 'defense'} profile`})}${profileTable(t, side)}</div>`;
  return `<div class="pfigs">${one('o')}${one('d')}</div><p class="pkey"><span class="k run">Running</span><span class="k pass">Passing</span> 100 is the best in the country on that measure, 50 the middle, on both sides of the ball. Adjusted for opponent.</p>`;
}
function profileCompare(a, b, mode){      // two shapes on one chart. mode 'same': offense with offense; 'match': one offense against the other defense
  if (!HAS_PROFILE) return '';
  const fig = (x, sx, y, sy, title) => `<div class="pfig"><h3 class="th2">${title}</h3>${radar([{label: `${x.n} ${sx === 'o' ? 'offense' : 'defense'}`, vals: profileOf(x, sx)}, {label: `${y.n} ${sy === 'o' ? 'offense' : 'defense'}`, vals: profileOf(y, sy)}], {label: title})}
    <p class="plegend"><span class="k s0">${esc(x.n)} ${sx === 'o' ? 'offense' : 'defense'}</span><span class="k s1">${esc(y.n)} ${sy === 'o' ? 'offense' : 'defense'}</span></p></div>`;
  const body = mode === 'match'
    ? fig(a, 'o', b, 'd', `${esc(a.n)} with the ball`) + fig(b, 'o', a, 'd', `${esc(b.n)} with the ball`)
    : fig(a, 'o', b, 'o', 'Offense') + fig(a, 'd', b, 'd', 'Defense');
  return `<section class="sec"><h2>${mode === 'match' ? 'Matchup profiles' : 'Profiles'}</h2><p class="hint">${mode === 'match' ? 'Each offense on the same chart as the defense it faces. Where the offense reaches past the defense, that is where it has the edge.' : 'Both teams on the same chart.'} 100 is the best in the country on that measure, 50 the middle. Adjusted for opponent.</p><div class="pfigs">${body}</div></section>`;
}

/* ================= how they play ================= */
let _style = null;
function styles(){      // run rate in close games, and how LTF rates the running and passing on each side
  if (_style) return _style;
  const nrr = STATBY.nrr, rr = STATBY.runrate, n = T.length;
  const rk = (f, hi) => { const s = [...T].sort((a, b) => hi ? b.d[f] - a.d[f] : a.d[f] - b.d[f]); return new Map(s.map((t, i) => [t, i + 1])); };
  const oru = rk('oru', true), opa = rk('opa', true), dru = rk('dru', false), dpa = rk('dpa', false);
  const runs = T.map(t => statVal(t, nrr, 'o', 'rate')).filter(v => v != null), oppRuns = T.map(t => statVal(t, rr, 'd', 'rate')).filter(v => v != null);
  const avg = runs.length ? mean(runs) : 50, oppAvg = oppRuns.length ? mean(oppRuns) : 55;
  const runRank = new Map([...T].filter(t => statVal(t, nrr, 'o', 'rate') != null).sort((a, b) => statVal(b, nrr, 'o', 'rate') - statVal(a, nrr, 'o', 'rate')).map((t, i) => [t, i + 1]));
  const of = new Map(T.map(t => [t, {run: statVal(t, nrr, 'o', 'rate'), runRank: runRank.get(t), oppRun: statVal(t, rr, 'd', 'rate'),
    oru: oru.get(t), opa: opa.get(t), dru: dru.get(t), dpa: dpa.get(t), lean: t.d.opa - t.d.oru}]));
  return _style = {of, avg, oppAvg, n};
}
function styleNotes(t){
  const S = styles(), s = S.of.get(t); if (!s || s.run == null) return '';
  const n = S.n, more = s.run - S.avg, gap = s.oru - s.opa;      // gap above zero: the passing ranks better
  const tend = Math.abs(more) < 2.5 ? `They run ${s.run.toFixed(0)}% of the time on early downs in close games, close to the national average of ${S.avg.toFixed(0)}%`
    : `They run ${s.run.toFixed(0)}% of the time on early downs in close games, ${more > 0 ? 'more' : 'less'} than the national average of ${S.avg.toFixed(0)}% (${ord(s.runRank)} most of ${n})`;
  const eff = Math.abs(gap) < 20 ? `LTF rates their running and passing about the same: ${ord(s.oru)} and ${ord(s.opa)} in EPA per play, adjusted for opponent`
    : `LTF rates their ${gap > 0 ? 'passing' : 'running'} well ahead of their ${gap > 0 ? 'running' : 'passing'}: ${ord(gap > 0 ? s.opa : s.oru)} against ${ord(gap > 0 ? s.oru : s.opa)} in EPA per play, adjusted for opponent`;
  const odd = more >= 4 && gap >= 25 ? 'They run more than most teams, but their passing is the stronger half.' : more <= -4 && gap <= -25 ? 'They throw more than most teams, but their running is the stronger half.' : '';
  const dgap = s.dru - s.dpa;      // above zero: better against the pass
  const dline = Math.abs(dgap) < 20 ? `On defense they are about as good against the run (${ord(s.dru)}) as against the pass (${ord(s.dpa)})`
    : `On defense they are much better against the ${dgap > 0 ? 'pass' : 'run'} (${ord(dgap > 0 ? s.dpa : s.dru)}) than the ${dgap > 0 ? 'run' : 'pass'} (${ord(dgap > 0 ? s.dru : s.dpa)})`;
  const opp = s.oppRun == null ? '' : Math.abs(s.oppRun - S.oppAvg) < 2.5 ? '' : ` Opponents run ${s.oppRun.toFixed(0)}% of the time against them, ${s.oppRun > S.oppAvg ? 'more' : 'less'} than the ${S.oppAvg.toFixed(0)}% average.`;
  return `<div class="style"><p><b>With the ball.</b> ${tend}. ${eff}.${odd ? ` <b class="flag">${odd}</b>` : ''}</p><p><b>Without it.</b> ${dline}.${opp}</p></div>`;
}
function viewStyles(){
  const title = 'How teams play';
  if (!HAS_STATS) return {title, top: pageTop(title, 'Styles show up once the season\'s play-by-play is in.'), body: '<p class="empty">Nothing yet.</p>'};
  const S = styles(), pts = T.map(t => ({t, s: S.of.get(t)})).filter(x => x.s.run != null), inG = T.filter(inGroup), inSet = new Set(inG);
  const xs = pts.map(x => x.s.run), ys = pts.map(x => x.s.lean);
  const x0 = Math.floor(Math.min(...xs)/5)*5, x1 = Math.ceil(Math.max(...xs)/5)*5, ym = Math.max(0.05, Math.ceil(Math.max(...ys.map(Math.abs))*20)/20);
  const draw = (W, H, pl, pr, pt, pb, sm) => {
    const X = v => pl + (v - x0)/(x1 - x0)*(W - pl - pr), Y = v => pt + (ym - v)/(2*ym)*(H - pt - pb);
    const ticksX = []; for (let v = x0; v <= x1; v += 10) ticksX.push(v);
    const grid = ticksX.map(v => `<line class="gl" x1="${X(v)}" y1="${pt}" x2="${X(v)}" y2="${H - pb}"/><text x="${X(v)}" y="${H - pb + 18}" text-anchor="middle">${v}%</text>`).join('')
      + `<line class="ax" x1="${pl}" y1="${Y(0)}" x2="${W - pr}" y2="${Y(0)}"/><line class="ax" x1="${X(S.avg)}" y1="${pt}" x2="${X(S.avg)}" y2="${H - pb}"/>`;
    const q = (x, y, a, txt) => `<text class="ql" x="${x}" y="${y}" text-anchor="${a}">${txt}</text>`;
    const quads = sm ? q(pl + 6, pt + 14, 'start', 'Throw, pass better') + q(W - pr - 6, pt + 14, 'end', 'Run, pass better') + q(pl + 6, H - pb - 8, 'start', 'Throw, run better') + q(W - pr - 6, H - pb - 8, 'end', 'Run, run better')
      : q(pl + 8, pt + 16, 'start', 'Throw a lot, pass better') + q(W - pr - 8, pt + 16, 'end', 'Run a lot, pass better') + q(pl + 8, H - pb - 10, 'start', 'Throw a lot, run better') + q(W - pr - 8, H - pb - 10, 'end', 'Run a lot, run better');
    const big = sm ? 5 : 6, small = sm ? 3.5 : 4, labs = !sm && inG.length <= 40;
    const dots = [...pts].sort((a, b) => inSet.has(a.t) - inSet.has(b.t)).map(({t, s}) => `<a href="${teamL(t)}"><circle class="dot${inSet.has(t) ? '' : ' faint'}" cx="${X(s.run).toFixed(1)}" cy="${Y(s.lean).toFixed(1)}" r="${inSet.has(t) ? big : small}" style="fill:${esc(t.col)}"><title>${esc(t.n)}: runs ${s.run.toFixed(0)}% in close games on early downs. Running ${ord(s.oru)}, passing ${ord(s.opa)} in adjusted EPA.</title></circle>${inSet.has(t) && labs ? `<text class="lab" x="${(X(s.run) + 8).toFixed(1)}" y="${(Y(s.lean) + 4).toFixed(1)}">${esc(t.ab)}</text>` : ''}</a>`).join('');
    return `<svg class="${sm ? 'sm' : 'lg'}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Run rate against which they do better, every team">${grid}${quads}${dots}
      <text class="at" x="${(pl + W - pr)/2}" y="${H - 10}" text-anchor="middle">${sm ? 'Run rate, early downs, close games' : 'Run rate, early downs in close games. The middle line is the national average.'}</text>
      <text class="at" transform="translate(${sm ? 12 : 16} ${(pt + H - pb)/2}) rotate(-90)" text-anchor="middle">${sm ? 'Pass better (up), run better (down)' : 'Passing better (up) or running better (down)'}</text></svg>`;
  };
  const chart = `<div class="plot static styleplot">${draw(860, 520, 60, 20, 30, 54, false)}${draw(370, 430, 30, 10, 12, 46, true)}</div>`;
  const pool = inG.map(t => ({t, s: S.of.get(t)})).filter(x => x.s.run != null);
  const li = (x, txt) => rowB(x.t, x.t.rank, txt);
  const runPass = pool.filter(x => x.s.run > S.avg + 3 && x.s.oru - x.s.opa >= 20).sort((a, b) => (b.s.oru - b.s.opa) - (a.s.oru - a.s.opa)).slice(0, 6);
  const passRun = pool.filter(x => x.s.run < S.avg - 3 && x.s.opa - x.s.oru >= 20).sort((a, b) => (b.s.opa - b.s.oru) - (a.s.opa - a.s.oru)).slice(0, 6);
  const vsRun = pool.filter(x => x.s.dpa - x.s.dru >= 30).sort((a, b) => (b.s.dpa - b.s.dru) - (a.s.dpa - a.s.dru)).slice(0, 6);
  const vsPass = pool.filter(x => x.s.dru - x.s.dpa >= 30).sort((a, b) => (b.s.dru - b.s.dpa) - (a.s.dru - a.s.dpa)).slice(0, 6);
  const runH = [...pool].sort((a, b) => b.s.run - a.s.run).slice(0, 6), passH = [...pool].sort((a, b) => a.s.run - b.s.run).slice(0, 6);
  const panel = (h, hint, xs2, f) => `<section class="panel"><h2>${h}</h2><p class="hint">${hint}</p><ol class="rows">${xs2.map(x => li(x, f(x))).join('') || '<li class="two">None right now.</li>'}</ol></section>`;
  const top1 = runPass[0] || passRun[0];
  const lead = top1 ? `${tl(top1.t)} ${top1 === runPass[0] ? `runs ${top1.s.run.toFixed(0)}% of the time in close games, yet LTF rates their passing ${ord(top1.s.opa)} and their running ${ord(top1.s.oru)}` : `throws more than most, yet LTF rates their running ${ord(top1.s.oru)} and their passing ${ord(top1.s.opa)}`}. The national run rate in those spots is ${S.avg.toFixed(0)}%.` : '';
  return {title, controls:true, nofind:true, lead,
    top: pageTop(title, `What a team likes to do, set against what it does well. Run rate counts early downs in the first three quarters with the score within 14, before the scoreboard decides for them. Which they do better compares LTF's opponent-adjusted EPA per play on runs and on passes. A team far from the middle line leans hard one way. The lists pick out where the habit and the strength disagree. Shown for the story, never part of the LTF Index.`),
    body: chart + `<div class="panels">
      ${panel('Run a lot, pass better', 'Above-average run rate, with their passing rated well ahead of their running.', runPass, x => `run ${x.s.run.toFixed(0)}%, pass ${ord(x.s.opa)}, run ${ord(x.s.oru)}`)}
      ${panel('Throw a lot, run better', 'Below-average run rate, with their running rated well ahead of their passing.', passRun, x => `run ${x.s.run.toFixed(0)}%, run ${ord(x.s.oru)}, pass ${ord(x.s.opa)}`)}
      ${panel('Defense: far better against the run', 'Rushing EPA allowed ranks at least 30 spots ahead of passing EPA allowed.', vsRun, x => `run ${ord(x.s.dru)}, pass ${ord(x.s.dpa)}`)}
      ${panel('Defense: far better against the pass', 'Passing EPA allowed ranks at least 30 spots ahead of rushing EPA allowed.', vsPass, x => `pass ${ord(x.s.dpa)}, run ${ord(x.s.dru)}`)}
      ${panel('Most run-heavy', 'Highest run rate on early downs in close games.', runH, x => `${x.s.run.toFixed(0)}%`)}
      ${panel('Most pass-heavy', 'Lowest run rate on early downs in close games.', passH, x => `${x.s.run.toFixed(0)}%`)}
    </div>`};
}
