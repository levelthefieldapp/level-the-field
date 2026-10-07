/* ================= scorecard: LTF next to the ratings people know ================= */
/* For every game, what each system said before kickoff, as a margin for the home team. From week 6 of 2026 these are put on
   file by the data build before the games and never changed. Earlier weeks have only LTF, rebuilt from the games played to
   that point, and the closing line, because weekly SP+ and FPI were not being saved yet. */
const SC_SYS = [['ltf','LTF'],['sp','SP+'],['fp','FPI'],['mod','Prediction model'],['mkt','Betting line']];
const SC_SHORT = {ltf:'LTF', sp:'SP+', fp:'FPI', mod:'Model', mkt:'Betting line'};
let _sc = null;
function scoreRows(){
  if (_sc) return _sc;
  const pk = Object.fromEntries(PICKS.map(p => [p.id, p])), rows = [];
  for (const g of G){
    if (!g.done || !byName[g.h] || !byName[g.a] || g.hs == null) continue;
    const p = pk[g.id], x = gameLine(g), locked = !!(p && p.lm != null);
    const pred = {ltf: locked ? p.lm : x ? x.m : null, sp: p && p.sp != null ? p.sp : null, fp: p && p.fp != null ? p.fp : null, mod: p && p.mm != null ? p.mm : null, mkt: -g.hs};
    if (pred.ltf == null) continue;
    rows.push({g, act: g.hp - g.ap, pred, locked});
  }
  return _sc = rows;
}
function scoreTally(rows){   // for each system: winners right and wrong, average miss, and record against the closing spread
  const out = {};
  for (const [k] of SC_SYS){
    const o = out[k] = {n:0, w:0, l:0, miss:0, aw:0, al:0, ap:0};
    for (const r of rows){
      const m = r.pred[k]; if (m == null) continue;
      o.n++; o.miss += Math.abs(r.act - m);
      if (m !== 0 && r.act !== 0){ if ((m > 0) === (r.act > 0)) o.w++; else o.l++; }
      if (k !== 'mkt'){ const lean = m + r.g.hs, res = r.act + r.g.hs; if (lean !== 0){ if (res === 0) o.ap++; else if ((lean > 0) === (res > 0)) o.aw++; else o.al++; } }
    }
    o.pct = o.w + o.l ? o.w/(o.w + o.l) : null; o.avg = o.n ? o.miss/o.n : null; o.ats = o.aw + o.al ? o.aw/(o.aw + o.al) : null;
  }
  return out;
}
const scOnFile = () => PICKS.filter(p => p.lm != null && gameById[p.id] && !gameById[p.id].done);
function viewScorecard(){
  const rows = scoreRows(), metric = ['miss','ats'].includes(R.q.m) ? R.q.m : 'win';
  const weeks = [...new Set(rows.map(r => r.g.w))].sort((a,b) => a-b), all = scoreTally(rows), file = scOnFile();
  const lockedWeeks = [...new Set(rows.filter(r => r.locked).map(r => r.g.w))];
  const cell = (o, k, best) => {
    if (!o.n || (metric === 'ats' && k === 'mkt')) return '<td class="num"><span class="cf">–</span></td>';
    const v = metric === 'win' ? (o.pct == null ? '–' : `${Math.round(o.pct*100)}% <span class="cf">${o.w}-${o.l}</span>`) : metric === 'miss' ? o.avg.toFixed(1) : (o.ats == null ? '–' : `${Math.round(o.ats*100)}% <span class="cf">${o.aw}-${o.al}${o.ap ? '-'+o.ap : ''}</span>`);
    return `<td class="num${best === k ? ' win' : ''}">${v}</td>`;
  };
  const bestOf = t => { const ks = SC_SYS.map(q => q[0]).filter(k => t[k].n && !(metric === 'ats' && k === 'mkt') && k !== 'mkt');     // the best of the rating systems. The line is the yardstick, not a contestant.
    const val = k => metric === 'win' ? (t[k].pct ?? -1) : metric === 'miss' ? -t[k].avg : (t[k].ats ?? -1);
    if (ks.length < 2) return null; const top = [...ks].sort((a,b) => val(b) - val(a)); return val(top[0]) === val(top[1]) ? null : top[0]; };
  const line = (label, rs, cls) => { const t = scoreTally(rs), b = bestOf(t); return `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${label}</th><td class="num wide">${rs.length}</td>${SC_SYS.map(([k]) => cell(t[k], k, b)).join('')}</tr>`; };
  const body = weeks.map(w => line(`<a class="txt" href="${L('recap', null, {week:w})}">Week ${w}</a>${lockedWeeks.includes(w) ? '' : ' <span class="cf">LTF rebuilt</span>'}`, rows.filter(r => r.g.w === w))).join('');
  const seg = `<div class="seg" role="group" aria-label="What to grade">${[['win','Winners picked'],['miss','Average miss'],['ats','Against the spread']].map(([k,l]) => `<a data-keep href="${Lq({m: k === 'win' ? null : k})}" aria-current="${metric === k}">${l}</a>`).join('')}</div>`;
  /* the fair comparison: only the games where every system had a number on file */
  const head = rows.filter(r => r.locked && r.pred.sp != null && r.pred.fp != null), hd = head.length ? scoreTally(head) : null, hw = head.length ? Math.min(...head.map(r => r.g.w)) : null;
  const facts = SC_SYS.map(([k, name]) => { const o = (hd || all)[k];
    return fact(name, !o.n ? 'Starts week ' + M.next : o.pct == null ? '\u2013' : Math.round(o.pct*100) + '%', !o.n ? 'no games graded yet' : `${o.w}-${o.l} on winners, off by ${o.avg.toFixed(1)} points a game`); }).join('');
  const factNote = hd ? `These five numbers cover the ${head.length} games since week ${hw}, when all five systems went on file, so they are graded on the same games.` : `Until week ${M.next} is played, only LTF and the betting line have games to grade.`;
  const past = `<div class="scroll"><table class="grid"><thead><tr><th>Past seasons</th><th class="num wide">Games</th><th class="num">Winners picked</th><th class="num">Betting line</th><th class="num">Average miss</th><th class="num">Betting line</th></tr></thead><tbody>
      <tr><th scope="row">LTF Index, ${BT.seasons}</th><td class="num wide">${BT.games.toLocaleString()}</td><td class="num">${BT.su}%</td><td class="num">${BT.mktSu}%</td><td class="num">${BT.miss}</td><td class="num">${BT.mktMiss}</td></tr>
      ${RSR ? `<tr><th scope="row">Prediction model, ${RSR.seasons}</th><td class="num wide">${RSR.games.toLocaleString()}</td><td class="num">${RSR.su}%</td><td class="num">${RSR.mktSu}%</td><td class="num">${RSR.miss}</td><td class="num">${RSR.closeMiss}</td></tr>` : ''}</tbody></table></div>`;
  const what = metric === 'win' ? 'How often each system had the winner, with the record beside it.' : metric === 'miss' ? 'How far each predicted margin was from the final margin, in points. Lower is better.' : 'Each system\'s side against the closing spread: covers, misses, then pushes. A bettor needs about 52.4% to break even.';
  return {title:'Scorecard', top: pageTop('Scorecard', `LTF graded every week against the two best-known public ratings, the prediction model and the betting line. From week 6 on, every number is put on file before kickoff and never changed.`),
    body: `<div class="facts">${facts}</div>
    <p class="hint after">${factNote}</p>
    <p class="next">${rows.length ? `${rows.length} games graded so far this season.` : 'No games graded yet.'}${file.length ? ` <b>${file.length} week ${gameById[file[0].id].w} games are on file</b>: LTF, SP+, FPI, the model and the market each have a number locked for every one. <a class="txt" href="${L('picks')}">See the picks</a>` : ''}</p>
    <section class="sec"><h2>Week by week</h2>${seg}<p class="hint">${what} The best of the rating systems each week is in bold. The betting line is the yardstick, so it is left out of that.</p>
      <div class="scroll"><table class="grid sc"><thead><tr><th>Week</th><th class="num wide">Games</th>${SC_SYS.map(([k]) => `<th class="num">${SC_SHORT[k]}</th>`).join('')}</tr></thead>
      <tbody>${body || `<tr><td class="empty" colspan="${SC_SYS.length + 2}">The first graded week shows up here once games are final.</td></tr>`}${hd && head.length < rows.length ? line(`Since week ${hw}, all five on file`, head, 'tot') : ''}${rows.length ? line(hd && head.length < rows.length ? 'Whole season' : 'Season', rows, 'tot') : ''}</tbody></table></div>
      ${weeks.some(w => !lockedWeeks.includes(w)) ? `<p class="hint after">"LTF rebuilt" marks weeks from before numbers were put on file. For those, the LTF line is rebuilt from only the games played up to that week, and SP+ and FPI are blank because their weekly ratings were not being saved yet.</p>` : ''}</section>
    <section class="sec"><h2>The longer record</h2><p class="hint">One season is a small sample. This is the same comparison over the past seasons that could be rebuilt week by week.</p>${past}
      <p class="next"><a class="txt" href="${L('track')}">Every LTF line this season, graded</a> &nbsp; <a class="txt" href="${L('model')}">Model tracker</a></p></section>
    <div class="note"><p><b>How each number is made.</b> LTF is the LTF line. SP+ and FPI are each team's rating in points, home minus away, plus ${M.hfa} for home field. The model is the separate prediction model on the Model tracker page. The betting line is the ${esc(M.book)} closing spread.</p>
      <p><b>What a good result looks like.</b> The betting line picks about ${BT.mktSu}% of winners and misses by about ${BT.mktMiss} points. Over a full season it usually finishes ahead of every public rating system. A system that stays within a point or two of the line on winners, and within about half a point on average miss, is as good as public ratings get.</p>
      <p><b>Fair play.</b> SP+ belongs to Bill Connelly and ESPN, and FPI belongs to ESPN. They are here for comparison only. Their ratings are pulled a few days before the games, so a later update on their side is not reflected.</p></div>` + fine};
}

/* ================= front page pieces: this week's games and the record so far ================= */
function weekBig(n){   // the biggest games of the coming week: the best pairs of teams by rank
  if (M.next == null) return [];
  return G.filter(g => g.w === M.next && byName[g.h] && byName[g.a]).sort((a,b) => (byName[a.h].rank + byName[a.a].rank) - (byName[b.h].rank + byName[b.a].rank)).slice(0, n);
}
function homeWeek(){
  const games = weekBig(6); if (!games.length) return '';
  const total = G.filter(g => g.w === M.next).length, spots = T.filter(t => t.g.length && momentum(t).spot && momentum(t).spot.k === 'bounce' && t.sched.some(e => !e.game.done && e.wk === M.next));
  return `<section class="sec"><h2>Week ${M.next}: the biggest games</h2><p class="hint">The LTF pick for each, the market line, and a confidence score from 1 to 99. Select a game for the reasons.</p>
    ${gameList([...games].sort((a,b) => new Date(a.d) - new Date(b.d)))}
    <p class="next linkrow"><a class="btn go" href="${L('picks')}">Every pick, with the reasons</a><a class="txt" href="${L('games')}">All ${total} games</a><a class="txt" href="${L('spread')}">Sort the lines</a>${spots.length ? `<a class="txt" href="${L('momentum')}">${spots.length} bounce-back ${spots.length === 1 ? 'spot' : 'spots'}</a>` : ''}</p></section>`;
}
function homeRecord(){
  const rows = scoreRows(); if (!rows.length) return '';
  const all = scoreTally(rows), lw = rows.filter(r => r.g.w === M.through), last = lw.length ? scoreTally(lw) : null;
  const f = (label, o, note) => fact(label, o.pct == null ? '–' : Math.round(o.pct*100) + '%', note);
  return `<section class="sec"><h2>The record so far</h2><p class="hint">Winners picked this season in games with a betting line, next to the line itself. Every pick is graded, misses included.</p>
    <div class="facts">${f('LTF, this season', all.ltf, `${all.ltf.w}-${all.ltf.l}, off by ${all.ltf.avg.toFixed(1)} points a game`)}${f('Betting line, this season', all.mkt, `${all.mkt.w}-${all.mkt.l}, off by ${all.mkt.avg.toFixed(1)}`)}
      ${last ? f(`LTF, week ${M.through}`, last.ltf, `${last.ltf.w}-${last.ltf.l}. <a class="txt" href="${L('recap')}">Recap</a>`) : ''}${fact('LTF over five past seasons', BT.su + '%', `the betting line had ${BT.mktSu}%`)}</div>
    <p class="next linkrow"><a class="txt" href="${L('scorecard')}">Scorecard: LTF against SP+, FPI and the line</a><a class="txt" href="${L('how')}">How it works</a></p></section>`;
}
