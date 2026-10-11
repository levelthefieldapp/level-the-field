/* ================= did you beat the bye? ================= */
/* A team on a bye can still move. Everyone else plays, and every team's numbers are weighed again each week as the teams
   they have played take the field. For every week with a snapshot before and after, this page lists the teams that had
   no game and explains the move: the teams they passed or that passed them, what changed in their own numbers, and how
   their next game looks now. Ranks follow the reader's weights, like every other ranking on the site. */
const byeWeeks = () => HW.filter(w => HW.includes(w - 1));
const weekGame = (t, w) => t ? t.sched.find(e => e.wk === w) || null : null;
const offIn = (t, w) => !weekGame(t, w);
const cnt = (n, one, many) => `${NUMW[n] || n} ${n === 1 ? one : many || one + 's'}`;
function weekResult(n, w){   // what a team did in week w, the way it reads after their name: "lost 45-17 at Missouri"
  const e = weekGame(byName[n], w); if (!e) return byName[n] ? 'was also off' : '';
  const at = e.site === 'A' ? 'at' : 'vs';
  if (!e.game.done) return `${at} ${esc(e.opp)}`;
  const s = scoreTxt(e);
  return e.pf > e.pa ? (e.site === 'A' ? `won ${s} at ${esc(e.opp)}` : `beat ${esc(e.opp)} ${s}`) : `lost ${s} ${e.site === 'A' ? 'at' : 'to'} ${esc(e.opp)}`;
}
const pAt = (t, o, e, wk) => { const he = e.site === 'H' ? 1 : e.site === 'A' ? -1 : 0; return phi((slopeAt(wk)*(t.hist[wk].z - o.hist[wk].z) + he*M.hfa)/M.sigma); };
const pctW = p => clamp(Math.round(p*100), 1, 99);
function byeRow(t, w){
  const a = t.hist[w-1], b = t.hist[w]; if (!a || !b || !offIn(t, w)) return null;
  const both = T.filter(o => o !== t && o.hist[w-1] && o.hist[w]);
  const jumped = both.filter(o => o.hist[w-1].rank < a.rank && o.hist[w].rank > b.rank).sort((x,y) => x.hist[w-1].rank - y.hist[w-1].rank);
  const passed = both.filter(o => o.hist[w-1].rank > a.rank && o.hist[w].rank < b.rank).sort((x,y) => x.hist[w].rank - y.hist[w].rank);
  const tot = COMP.reduce((s,c) => s + W[c.k], 0) || 1;
  const parts = COMP.filter(c => W[c.k] > 0).map(c => ({c, d:(b.parts[c.k] - a.parts[c.k])*W[c.k]/tot, from:a.prk[c.k], to:b.prk[c.k]}))
    .filter(x => x.from !== x.to).sort((x,y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 2);
  const opps = [...new Set(t.g.filter(e => e.wk < w && !e.fcs).map(e => e.opp))].map(n => weekGame(byName[n], w)).filter(e => e && e.game.done);
  const ow = opps.filter(e => e.pf > e.pa).length;
  const nx = t.sched.find(e => e.wk > w) || null, o = nx && byName[nx.opp], line = o && o.hist[w-1] && o.hist[w] ? [pAt(t, o, nx, w-1), pAt(t, o, nx, w)] : null;
  return {t, w, a, b, mv: a.rank - b.rank, jumped, passed, parts, ow, ol: opps.length - ow, nx, o, line};
}
const byeVerdict = mv => mv > 0 ? 'Beat the bye' : mv < 0 ? 'Lost to the bye' : 'Held steady';
const byeRows = w => T.map(t => byeRow(t, w)).filter(Boolean).sort((x,y) => y.mv - x.mv || x.b.rank - y.b.rank);
const byeNames = (ts, w, rest, n = 3) => `${list(ts.slice(0, n).map(o => `${esc(o.n)} ${weekResult(o.n, w)}`))}.${ts.length > n ? ` ${up1(cnt(ts.length - n, 'other'))} ${rest}.` : ''}`;
function byeWhy(r){   // the move in sentences: the field, their own numbers, the next game
  const out = [], w = r.w;
  const field = [];
  if (r.jumped.length) field.push(`Moved past ${cnt(r.jumped.length, 'team')}. ${byeNames(r.jumped, w, 'fell behind them too')}`);
  if (r.passed.length) field.push(`Passed by ${cnt(r.passed.length, 'team')}. ${byeNames(r.passed, w, 'moved ahead too')}`);
  out.push(field.length ? field.join(' ') : 'Nobody around them changed places with them.');
  const own = `Their LTF Index went from ${r.a.idx.toFixed(1)} to ${r.b.idx.toFixed(1)}${r.parts.length ? `, with ${list(r.parts.map(x => `${lc(x.c.name)} going from ${ord(x.from)} to ${ord(x.to)}`))}` : ''}.`;
  out.push(own + (r.ow + r.ol ? ` Teams they had played went ${r.ow}-${r.ol} that week.` : ''));
  if (r.nx && r.o && r.line){
    const res = weekResult(r.o.n, w), mv = r.o.hist[w-1].rank - r.o.hist[w].rank;
    const how = `who ${res}${mv && res !== 'was also off' ? ` and went from ${ord(r.o.hist[w-1].rank)} to ${ord(r.o.hist[w].rank)}` : ''}`;
    let s = `Next: ${r.nx.site === 'A' ? 'at' : 'vs'} ${esc(r.o.n)}, ${how}. LTF gave them ${pctW(r.line[0])}% before the bye and ${pctW(r.line[1])}% after.`;
    if (r.nx.game.done) s += ` They ${r.nx.pf > r.nx.pa ? 'won' : 'lost'} ${scoreTxt(r.nx)}.`;
    out.push(s);
  } else if (r.nx && !r.o) out.push(`Next: ${esc(r.nx.opp)}, from outside FBS.`);
  return out;
}
function byeLi(r){
  const t = r.t, cls = r.mv > 0 ? 'up' : r.mv < 0 ? 'down' : '';
  return `<li class="two"><span><span class="l1"><span class="who">${badge(t,'sm')} ${tl(t)} <span class="cf">${esc(r.b.rec)}</span> <span class="tag${r.mv < 0 ? ' o' : ''}">${byeVerdict(r.mv)}</span></span><span class="meta"><span class="cf">No. ${r.a.rank} to</span> No. ${r.b.rank} <b class="${cls}">${r.mv ? signed(r.mv, 0) : '0'}</b></span></span>
    ${byeWhy(r).map(x => `<span class="sub2">${x}</span>`).join('')}</span></li>`;
}
function byesAhead(){   // the teams off in the coming week, and the results that would help them
  const w = M.next; if (w == null) return null;
  const gs = G.filter(g => g.w === w); if (!gs.length || gs.every(g => g.done)) return null;
  const all = T.filter(t => offIn(t, w) && t.sched.some(e => e.wk > w) && inGroup(t)).sort((a,b) => a.rank - b.rank);
  const off = groupKey() === 'all' ? all.filter(t => t.rank <= 40) : all;
  return all.length ? {w, off, rest: all.length - off.length} : null;
}
function aheadLi(t, w){
  const gTxt = (o, e) => e.game.done ? `${esc(o.n)} ${weekResult(o.n, w)}` : `${esc(o.n)} ${e.site === 'A' ? 'at' : 'vs'} ${esc(e.opp)} (${pctW(1 - winProb(o, e))}% to lose)`;
  const above = byRank().filter(o => o.rank < t.rank && weekGame(o, w)).slice(-3).reverse();
  const beat = [...new Set(t.g.filter(e => e.pf > e.pa && !e.fcs).map(e => e.opp))].filter(n => weekGame(byName[n], w));
  const nx = t.sched.find(e => e.wk > w), o = nx && byName[nx.opp], og = o && weekGame(o, w);
  const out = [];
  if (above.length) out.push(`A loss by any of the teams just ahead of them helps: ${list(above.map(x => gTxt(x, weekGame(x, w))))}.`);
  else out.push('Nobody is ahead of them, so the only way is to hold on.');
  if (beat.length) out.push(`Wins by teams they have beaten help too: ${list(beat.slice(0, 4).map(n => esc(n)))}${beat.length > 4 ? ` and ${NUMW[beat.length - 4] || beat.length - 4} more` : ''}.`);
  if (o) out.push(og ? `Their next opponent, ${esc(o.n)}, ${og.game.done ? weekResult(o.n, w) : `plays ${og.site === 'A' ? 'at ' : ''}${esc(og.opp)}`} this week.` : `Their next opponent, ${esc(o.n)}, is off too.`);
  return `<li class="two"><span><span class="l1"><span class="who">${badge(t,'sm')} ${tl(t)} <span class="cf">${t.w}-${t.l}</span></span><span class="meta">No. ${t.rank}</span></span>${out.map(x => `<span class="sub2">${x}</span>`).join('')}</span></li>`;
}
function viewBye(){
  const title = 'Did you beat the bye?', weeks = byeWeeks();
  const dek = `<b>${groupLabel()}.</b> A team on a bye can still move. Everyone else plays, and every team's numbers are weighed again as the teams they have played take the field. Here is who climbed while they sat, who slipped, and why.`;
  if (!weeks.length) return {title, controls:true, nofind:true, top: pageTop(title, dek), body:'<p class="empty">This page starts once there are two weeks of rankings to compare.</p>'};
  const last = weeks[weeks.length-1], wk = weeks.includes(+R.q.week) ? +R.q.week : last;
  const rows = byeRows(wk).filter(r => inGroup(r.t)), up = rows.filter(r => r.mv > 0), down = rows.filter(r => r.mv < 0).reverse(), held = rows.length - up.length - down.length;
  const seg = weeks.length > 1 ? `<div class="seg" role="group" aria-label="Week">${weeks.map(w => `<a data-keep href="${Lq({week: w === last ? null : w})}" aria-current="${w === wk}">Week ${w}</a>`).join('')}</div>` : '';
  const mini = r => rowB(r.t, r.b.rank, `<b class="${r.mv > 0 ? 'up' : 'down'}">${signed(r.mv, 0)}</b> <span class="cf">from ${r.a.rank}</span>`);
  const all = weeks.flatMap(w => byeRows(w).filter(r => inGroup(r.t)));
  const tally = all.length ? `<div class="facts">${fact('Beat the bye', all.filter(r => r.mv > 0).length, `of ${all.length} byes this season`)}${fact('Lost to the bye', all.filter(r => r.mv < 0).length, `${all.filter(r => !r.mv).length} held their spot`)}
    ${fact('Average move on a bye', signed(mean(all.map(r => r.mv)), 1), 'spots. Above zero means teams tend to climb')}</div>` : '';
  const lead = rows.length ? `${cnt(rows.length, 'team')} ${rows.length === 1 ? 'was' : 'were'} off in week ${wk}${groupKey() === 'all' ? '' : ` in the ${groupLabel()}`}. ${up.length} beat the bye, ${down.length} lost to it${held ? ` and ${held} held steady` : ''}.${down.length ? ` ${tl(down[0].t)} fell furthest, from ${ord(down[0].a.rank)} to ${ord(down[0].b.rank)}.` : ''}`.replace(/^./, c => c.toUpperCase()) : '';
  const ah = byesAhead();
  const ahead = ah ? `<section class="sec"><h2>Off this week</h2><p class="hint">The teams with no game in week ${ah.w}${ah.rest ? ` in the LTF top 40` : ''}, and the results that would help them climb while they sit.</p>${ah.off.length ? `<ol class="rows">${ah.off.map(t => aheadLi(t, ah.w)).join('')}</ol>` : ''}${ah.rest ? `<p class="hint after">${up1(cnt(ah.rest, 'more team'))} outside the top 40 ${ah.rest === 1 ? 'is' : 'are'} off too. Pick a conference above to see them.</p>` : ''}</section>` : '';
  return {title, controls:true, nofind:true, lead, card: 'bye' + (wk === last ? '' : ':' + wk), alts: [['bye' + (wk === last ? '' : ':' + wk), 'Beat the bye'], ['fraud', 'Fraud watch'], ['movers', 'Biggest movers']],
    top: pageTop(title, dek),
    body: `${seg}${rows.length ? `<div class="panels">
      <section class="panel"><h2>Beat the bye</h2><p class="hint">Climbed in the LTF rankings without playing.</p>${up.length ? `<ol class="rows">${up.slice(0, 5).map(mini).join('')}</ol>` : `<p class="hint">No one in week ${wk}.</p>`}</section>
      <section class="panel"><h2>Lost to the bye</h2><p class="hint">Slipped while they sat.</p>${down.length ? `<ol class="rows">${down.slice(0, 5).map(mini).join('')}</ol>` : `<p class="hint">No one in week ${wk}.</p>`}</section></div>
      <section class="sec"><h2>Every team that was off in week ${wk}</h2><p class="hint">Rank before the week and after it, and what moved them.</p><ol class="rows">${rows.map(byeLi).join('')}</ol></section>`
      : `<p class="empty">No team${groupKey() === 'all' ? '' : ` in the ${groupLabel()}`} was off in week ${wk}.</p>`}
    ${ahead}${tally}
    <div class="note"><p><b>How a team moves without playing.</b> Three things can do it. The teams around them win or lose. The teams they have already played win or lose, which changes what their own results are worth. And every offense and defense number is adjusted for the opponent, so those numbers shift as opponents play more games. A bye usually costs a little resume, because other teams add a result and they cannot.</p>
      <p><b>Which weeks?</b> Every week with rankings on both sides of it. A team is on a bye when they have no game that week at all. The ranks follow your weights if you have set your own on <a class="txt" href="${L('weights')}">Build your own</a>.</p></div>
    <p class="next"><a class="txt" href="${L('momentum')}">Momentum</a> &nbsp; <a class="txt" href="${L('fraud')}">Fraud watch</a></p>`};
}
/* a team's own page: one line when they were off last week */
function teamBye(t){
  const r = M.through != null && byeRow(t, M.through); if (!r) return '';
  return `<p class="next"><b>${byeVerdict(r.mv)}.</b> They were off in week ${r.w} and went from No. ${r.a.rank} to No. ${r.b.rank}. <a class="txt" href="${L('bye')}">Did you beat the bye?</a></p>`;
}

/* ================= fraud watch ================= */
/* Teams that look better on paper than they play. "How they are seen" is the better of their resume rank and their AP
   rank. "How they play" is the LTF Index with the resume part left out: offense, defense, scoring margin and the first
   half, at the standard weights. A team with a winning record whose resume ranks in the top 30, or who the AP ranks, goes
   on the watch when how they play ranks at least FR.gap spots worse than how they are seen, and on alert at FR.alert or
   more. The poll only says how a team is seen. It is never part of the LTF Index. Nothing here follows a reader's weights,
   except the finish LTF expects, which comes from the same lines as every other page. Past seasons: M.fr, made by
   backtest_site.py. */
const FR = M.fr || {gap: 8, alert: 20};
const PLAYK = ['off', 'def', 'mar', 'h1'];
let _fraud = null;
function fraudAll(){
  if (_fraud) return _fraud;
  const tot = PLAYK.reduce((s,k) => s + DEFAULTS[k], 0), play = ranks(T.map(t => PLAYK.reduce((s,k) => s + DEFAULTS[k]*t.z[k], 0)/tot));
  _fraud = {};
  T.forEach((t,i) => {
    const res = t.rk.res, apr = M.apWeek != null && t.d.apr ? t.d.apr : null, seen = apr ? Math.min(res, apr) : res, gp = t.w + t.l;
    const ok = gp >= 3 && t.w > t.l && (res <= 30 || !!apr), gap = play[i] - seen;
    const tier = !ok ? null : gap >= FR.alert ? 'alert' : gap >= FR.gap ? 'watch' : gap <= -FR.gap ? 'better' : 'legit';
    const xw = t.g.reduce((s,e) => { const o = byName[e.opp], he = e.site === 'H' ? 1 : e.site === 'A' ? -1 : 0; return s + phi((t.d.pw - (o ? o.d.pw : M.fcs) + he*M.hfa)/M.sigma); }, 0);
    _fraud[t.n] = {t, res, apr, seen, play: play[i], gap, tier, xw, gp};
  });
  return _fraud;
}
const FR_WORD = {alert: 'Fraud alert', watch: 'Fraud watch', legit: 'Legit', better: 'Better than they look'};
const frOf = t => fraudAll()[t.n];
const frList = () => Object.values(fraudAll()).filter(f => f.tier);
const frFlagged = () => frList().filter(f => f.tier === 'alert' || f.tier === 'watch').sort((a,b) => b.gap - a.gap || a.seen - b.seen);
function frSeen(f){   // how a team is seen, in a sentence
  if (f.apr) return `The AP has them ${ord(f.apr)} and their resume ranks ${ord(f.res)}.`;
  return `Their resume ranks ${ord(f.res)}${M.apWeek == null ? '' : ' and the AP does not rank them'}.`;
}
const frCore = f => `${frSeen(f)} How they play ranks ${ord(f.play)}.`;
function frCase(f){   // the case against a team and the case for them, each a list of plain sentences
  const t = f.t, k = t.d.lk || {cl:[0,0]}, extra = t.w - f.xw, qw = t.d.qw || [], against = [], forT = [];
  if (f.gap >= FR.gap) against.push(`How they play ranks ${ord(f.play)}, ${f.gap} spots below how they are seen.`);
  else if (f.gap <= -FR.gap) forT.push(`How they play ranks ${ord(f.play)}, ${-f.gap} spots better than how they are seen.`);
  else forT.push(`How they play ranks ${ord(f.play)}, in line with how they are seen.`);
  if (extra >= 0.75) against.push(`A team that plays the way they do would expect ${f.xw.toFixed(1)} wins from the games they have played. They have ${t.w}.`);
  else if (extra <= -0.75) forT.push(`They have won fewer games than their play has earned: ${t.w}, against ${f.xw.toFixed(1)} expected.`);
  else if (f.gp) forT.push(`Their record is about what their play has earned: ${f.xw.toFixed(1)} wins expected, ${t.w} won.`);
  if (k.cl[0] >= 2 && k.cl[0] > k.cl[1] - k.cl[0]) against.push(k.cl[0] === k.cl[1] ? `They have won ${k.cl[0] === 2 ? 'both' : `all ${NUMW[k.cl[0]] || k.cl[0]}`} of their one-score games.` : `They are ${k.cl[0]}-${k.cl[1] - k.cl[0]} in one-score games.`);
  else if (!k.cl[0] && t.w >= 3) forT.push('None of their wins came down to one score.');
  if (t.luck != null && t.luck >= 2) against.push(`Good luck has been worth ${signed(t.luck)} points a game: fumbles, tipped passes and the other team's kicks.`);
  else if (t.luck != null && t.luck <= -2) forT.push(`Bad luck has cost them ${Math.abs(t.luck).toFixed(1)} points a game, so their record undersells them.`);
  if (!qw.length) against.push('They have no wins over top-50 teams.');
  else forT.push(`${up1(cnt(qw.length, 'win'))} over top-50 teams${qw.length <= 3 ? `: ${list(qw.map(n => esc(n)))}` : ''}.`);
  if (t.rk.sos > 70) against.push(`Their schedule so far ranks ${ord(t.rk.sos)} of ${T.length}.`);
  else if (t.rk.sos <= 40) forT.push(`Their schedule so far ranks ${ord(t.rk.sos)}, among the hardest in the country.`);
  return {against, forT};
}
function frFinish(t){
  const p = projection(t); if (!p.left.length) return '';
  const total = t.w + t.l + p.left.length, pace = Math.round(total*t.w/Math.max(1, t.w + t.l));
  return `Their record is on pace for ${pace}-${total - pace}. LTF expects ${Math.round(p.w)}-${total - Math.round(p.w)}.`;
}
function frLi(f){
  const t = f.t, c = frCase(f), why = c.against.filter((s, i) => i > 0 || f.gap < FR.gap).slice(0, 2);
  return `<li class="two"><span><span class="l1"><span class="who">${badge(t,'sm')} ${tl(t)} <span class="cf">${t.w}-${t.l}</span>${f.apr ? ` <span class="cf">AP ${f.apr}</span>` : ''}</span><span class="meta"><span class="cf">plays like</span> No. ${f.play}</span></span>
    <span class="sub2">${frCore(f)} ${why.join(' ')} ${frFinish(t)}</span></span></li>`;
}
function frTrial(t){   // one team's verdict, with the case on both sides
  if (!t) return `<p class="hint">Pick any team to see LTF's verdict and the case on both sides.</p>`;
  const f = frOf(t);
  let word, said;
  if (f.gp < 3){ word = 'Too early'; said = 'Fraud watch starts once a team has played three games.'; }
  else if (t.w <= t.l){ word = 'Not a fraud'; said = `At ${t.w}-${t.l}, nobody is calling them good yet. Fraud watch is for teams whose record or ranking says they are.`; }
  else if (!f.tier){ word = 'Not on the radar'; said = `Their resume ranks ${ord(f.res)}${M.apWeek == null ? '' : ' and the AP does not rank them'}, so they are not on fraud watch. How they play ranks ${ord(f.play)}.`; }
  else { word = FR_WORD[f.tier]; said = frCore(f); }
  const c = frCase(f), col = f.tier === 'alert' || f.tier === 'watch' ? 'down' : f.tier ? 'up' : '';
  const ul = (h, xs) => `<div><h3>${h}</h3><ul class="plain">${(xs.length ? xs : ['Nothing stands out.']).map(s => `<li>${s}</li>`).join('')}</ul></div>`;
  return `<div class="trial"><div class="rev">${badge(t)}<span>${tl(t)}<small>${t.w}-${t.l}. LTF No. ${t.rank}${M.apWeek == null ? '' : `, AP ${f.apr ? 'No. ' + f.apr : 'unranked'}`}</small></span></div>
    <p class="verdict">Verdict: <b class="${col}">${word}</b>. ${said} ${frFinish(t)}</p>
    ${f.gp >= 3 && t.w > t.l ? `<div class="dgrid">${ul('The case against them', c.against)}${ul('The case for them', c.forT)}</div>` : ''}
    <p>${shareBtn('trial:' + t.slug, 'Share the verdict')}</p></div>`;
}
function viewFraud(){
  const title = 'Fraud watch', q = findText();
  const dek = `<b>${groupLabel()}.</b> Every season some teams look better on paper than they play. Fraud watch sets each team's resume and AP rank next to how they actually play, and flags the teams where the gap is big. How they play is the LTF Index without the resume part: offense, defense, scoring margin and the first half.`;
  if (M.through == null || M.through < 3) return {title, controls:true, top: pageTop(title, dek), body:'<p class="empty">Fraud watch starts after week 3, once teams have played three games.</p>'};
  const fl = frFlagged().filter(f => inGroup(f.t)), alert = fl.filter(f => f.tier === 'alert'), watch = fl.filter(f => f.tier === 'watch');
  const pick = bySlug[R.q.team] || null;
  const panel = (h, hint, xs, none) => `<section class="panel"><h2>${h}</h2><p class="hint">${hint}</p>${xs.length ? `<ol class="rows">${xs.map(frLi).join('')}</ol>` : `<p class="hint">${none}</p>`}</section>`;
  const names = [...T].sort((a,b) => a.n.localeCompare(b.n));
  let rows = frList().filter(f => inGroup(f.t)).sort((a,b) => b.gap - a.gap || a.seen - b.seen);
  if (q) rows = rows.filter(f => f.t.n.toLowerCase().includes(q));
  const gapCell = f => `<td class="num c ${f.gap >= FR.gap ? 'neg' : f.gap <= -FR.gap ? 'pos' : ''}" style="--t:${Math.min(1, Math.abs(f.gap)/30).toFixed(2)}">${f.gap > 0 ? '+' : f.gap < 0 ? '−' : ''}${Math.abs(f.gap)}</td>`;
  const table = rows.map(f => `<tr>${teamCell(f.t)}<td class="num">${f.t.w}-${f.t.l}</td>${M.apWeek == null ? '' : `<td class="num">${f.apr || '–'}</td>`}<td class="num">${f.res}</td><td class="num">${f.play}</td>${gapCell(f)}<td class="wide"><span class="tag${f.tier === 'alert' || f.tier === 'watch' ? ' o' : ''}">${FR_WORD[f.tier]}</span></td></tr>`).join('');
  const P = M.fr, pr = o => `${f1(o.act)}%`, same = P && P.same && P.same.length ? `<div class="scroll"><table class="grid"><thead><tr><th>Record when flagged</th><th class="num">Flagged teams won after</th><th class="num">Teams not flagged won after</th></tr></thead><tbody>
      ${P.same.map(r => `<tr><th scope="row">${r.rec}</th><td class="num"><b>${f1(r.fl)}%</b> <span class="cf">${r.flN} times</span></td><td class="num">${f1(r.no)}% <span class="cf">${r.noN} times</span></td></tr>`).join('')}</tbody></table></div>` : '';
  const past = !P ? '' : `<section class="sec"><h2>What past seasons say</h2><p class="hint">The same rule run on ${P.seasons}, after every week from 3 to 11, with the LTF Index as it stood at the time. Old polls are not in the data, so this test uses the resume half of the rule.</p>
      <div class="facts">${fact('Flagged teams, before', pr({act: P.flag.before}), 'of their games won up to the week they were flagged')}${fact('Flagged teams, after', pr(P.flag), `of the games that followed. LTF expected ${f1(P.flag.exp)}%`)}${fact('Not flagged, after', pr(P.not), `teams that looked as good on paper. They had won ${f1(P.not.before)}% before`)}</div>
      ${same}<p class="hint after">Flagged teams won a smaller share of their later games than the teams that were not flagged in ${P.held === P.of ? `all ${P.of}` : `${P.held} of ${P.of}`} seasons. A team counts once for each week they were flagged.</p></section>`;
  const top = fl[0];
  const lead = fl.length ? `After week ${M.through}, LTF has ${cnt(fl.length, 'team')}${groupKey() === 'all' ? '' : ` in the ${groupLabel()}`} on fraud watch${alert.length ? `, ${alert.length} of them on alert` : ''}. The biggest gap: ${tl(top.t)}, ${top.apr && top.apr === top.seen ? `${ord(top.apr)} in the AP poll` : `${ord(top.res)} by resume`} and ${ord(top.play)} in how they play.` : `No team${groupKey() === 'all' ? '' : ` in the ${groupLabel()}`} is on fraud watch after week ${M.through}.`;
  const gk = groupKey(), card = 'fraud' + (gk === 'all' ? '' : ':' + gk);
  return {title, controls:true, lead, card: pick && okCard('trial:' + pick.slug) ? 'trial:' + pick.slug : card, alts: [[card, 'Fraud watch'], ...(pick ? [['trial:' + pick.slug, pick.n]] : []), ['bye', 'Beat the bye'], ['luck', 'Luck']],
    top: pageTop(title, dek),
    body: `<div class="panels">
      ${panel('Fraud alert', `How they play ranks ${FR.alert} or more spots below how they are seen.`, alert, 'No team right now.')}
      ${panel('Fraud watch', `How they play ranks ${FR.gap} to ${FR.alert - 1} spots below how they are seen.`, watch, 'No team right now.')}</div>
    <section class="sec" id="trial"><h2>Put a team on trial</h2><div class="controls"><label>Team <select id="fr-team" data-pick="team"><option value="">Pick a team</option>${names.map(t => `<option value="${t.slug}"${t === pick ? ' selected' : ''}>${esc(t.n)}</option>`).join('')}</select></label></div>${frTrial(pick)}</section>
    <section class="sec"><h2>Every contender</h2><p class="hint">Every team with a winning record whose resume ranks in the top 30${M.apWeek == null ? '' : ', and every team the AP ranks'}. The gap is how many spots lower how they play ranks than how they are seen, the better of their resume and AP rank.</p>
      <div class="scroll"><table class="grid"><thead><tr>${th('Team')}${th('Record','num','rec')}${M.apWeek == null ? '' : th('AP','num','apr')}${th('Resume','num')}${th('Plays like','num')}${th('Gap','num')}${th('Verdict','wide')}</tr></thead><tbody>${table || emptyRow(M.apWeek == null ? 6 : 7, 'team')}</tbody></table></div></section>
    ${past}
    <div class="note"><p><b>How the list is made.</b> A rule makes it, the same way every week, and nobody picks the teams. How a team is seen is the better of their resume rank and their AP rank. How they play is the LTF Index without the resume part. A team goes on the watch when how they play ranks at least ${FR.gap} spots lower than how they are seen, and on alert at ${FR.alert} or more. The AP poll is used only to say how a team is seen. It is never part of the LTF Index.</p>
      <p><b>What this is, and what it is not.</b> It is not a new prediction. LTF's lines already go by how teams play, and in past seasons LTF expected flagged teams to win ${P ? `${f1(P.flag.exp)}% of their later games. They won ${f1(P.flag.act)}%` : 'about as often as they did'}. Fraud watch names the teams whose records are most likely to come back to earth, and says why.</p></div>
    <p class="next"><a class="txt" href="${L('radar')}">Under the radar</a> &nbsp; <a class="txt" href="${L('luck')}">Luck</a> &nbsp; <a class="txt" href="${L('bye')}">Did you beat the bye?</a></p>`};
}
/* a team's own page: one line when they are on the watch */
function teamFraud(t){
  const f = frOf(t); if (!f || (f.tier !== 'alert' && f.tier !== 'watch')) return '';
  return `<p class="next"><b>${FR_WORD[f.tier]}.</b> ${frCore(f)} <a class="txt" href="${L('fraud', null, {team: t.slug})}">See the case</a></p>`;
}
