/* ================= scorecard: LTF next to the ratings people know ================= */
/* For every game between two FBS teams, what each system said before kickoff, as a margin for the home team. LTF numbers
   are put on file by the data build before the games and never changed once a game has kicked off. Every game is graded
   on today's formula: a number on file counts only if it was made under it (p.f), and a game without one is graded on
   the line rebuilt from the games played to that point, as the weeks from before numbers were filed are. SP+ and FPI go
   on file beside the LTF number. The betting line is the closing line, added once a game is final. None of the three
   is part of the LTF Index. They are yardsticks. */
const PICKS = D.picks || [];
const onFile = p => !!(p && p.lm != null && (p.f || 1) >= (M.formula || 1));      // a number on file under today's formula
const SC_SYS = [['ltf','LTF'],['sp','SP+'],['fp','FPI'],['mkt','Betting line']];
const SC_OUT = SC_SYS.filter(q => q[0] !== 'ltf').map(q => q[0]);
let _sc = null;
function scoreRows(){
  if (_sc) return _sc;
  const pk = Object.fromEntries(PICKS.map(p => [p.id, p])), rows = [];
  for (const g of G){
    if (!g.done || !byName[g.h] || !byName[g.a]) continue;
    const p = pk[g.id], x = gameLine(g), locked = onFile(p);
    const pred = {ltf: locked ? p.lm : x ? x.m : null, sp: p && p.sp != null ? p.sp : null, fp: p && p.fp != null ? p.fp : null, mkt: g.hs == null ? null : -g.hs};
    if (pred.ltf == null) continue;
    rows.push({g, act: g.hp - g.ap, pred, locked});
  }
  return _sc = rows;
}
function scoreTally(rows){   // for each system: winners right and wrong, and the average miss
  const out = {};
  for (const [k] of SC_SYS){
    const o = out[k] = {n:0, w:0, l:0, miss:0};
    for (const r of rows){
      const m = r.pred[k]; if (m == null) continue;
      o.n++; o.miss += Math.abs(r.act - m);
      if (m !== 0 && r.act !== 0){ if ((m > 0) === (r.act > 0)) o.w++; else o.l++; }
    }
    o.pct = o.w + o.l ? o.w/(o.w + o.l) : null; o.avg = o.n ? o.miss/o.n : null;
  }
  return out;
}
const scOnFile = () => PICKS.filter(p => onFile(p) && gameById[p.id] && !gameById[p.id].done);
const lineNote = `<p class="hint fineprint">The betting line is here as a yardstick and for no other reason. It is not part of the LTF Index, the site does not show lines for games still to be played, and nothing here is betting advice.</p>`;
function viewScorecard(){
  const rows = scoreRows(), metric = R.q.m === 'miss' ? 'miss' : 'win';
  const weeks = [...new Set(rows.map(r => r.g.w))].sort((a,b) => a-b), all = scoreTally(rows), file = scOnFile();
  const lockedWeeks = [...new Set(rows.filter(r => r.locked).map(r => r.g.w))], stray = rows.filter(r => !r.locked && lockedWeeks.includes(r.g.w));      // stray: a game in a week on file that had no number on file itself
  const cell = (o, k, best) => {
    if (!o.n) return '<td class="num"><span class="cf">–</span></td>';
    const v = metric === 'win' ? (o.pct == null ? '–' : `${Math.round(o.pct*100)}% <span class="cf">${o.w}-${o.l}</span>`) : o.avg.toFixed(1);
    return `<td class="num${best === k ? ' win' : ''}">${v}</td>`;
  };
  const bestOf = t => { const ks = SC_SYS.map(q => q[0]).filter(k => t[k].n && k !== 'mkt');     // the best of the rating systems. The line is the yardstick, not a contestant.
    const val = k => metric === 'win' ? (t[k].pct ?? -1) : -t[k].avg;
    if (ks.length < 2) return null; const top = [...ks].sort((a,b) => val(b) - val(a)); return val(top[0]) === val(top[1]) ? null : top[0]; };
  const line = (label, rs, cls) => { const t = scoreTally(rs), b = bestOf(t); return `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${label}</th><td class="num wide">${rs.length}</td>${SC_SYS.map(([k]) => cell(t[k], k, b)).join('')}</tr>`; };
  const wkTag = w => !lockedWeeks.includes(w) ? ' <span class="cf">LTF rebuilt</span>' : '';
  const body = weeks.map(w => line(`<a class="txt" href="${L('recap', null, {week:w})}">Week ${w}</a>${wkTag(w)}`, rows.filter(r => r.g.w === w))).join('');
  const seg = `<div class="seg" role="group" aria-label="What to grade">${[['win','Winners picked'],['miss','Average miss']].map(([k,l]) => `<a data-keep href="${Lq({m: k === 'win' ? null : k})}" aria-current="${metric === k}">${l}</a>`).join('')}</div>`;
  /* the fair comparison: only the games where every system had a number */
  const head = rows.filter(r => r.locked && SC_OUT.every(k => r.pred[k] != null)), hd = head.length ? scoreTally(head) : null, hw = head.length ? Math.min(...head.map(r => r.g.w)) : null;
  const facts = SC_SYS.map(([k, name]) => { const o = (hd || all)[k];
    return fact(name, !o.n ? 'Starts week ' + M.next : o.pct == null ? '–' : Math.round(o.pct*100) + '%', !o.n ? 'no games graded yet' : `${o.w}-${o.l} on winners, off by ${o.avg.toFixed(1)} points a game`); }).join('');
  const factNote = hd ? `These four numbers cover the ${head.length} games since week ${hw}, when all four went on file, so they are graded on the same games.` : `Until week ${M.next} is played, only LTF and the betting line have games to grade. SP+ and FPI join from week ${M.next}, when their numbers first went on file.`;
  const past = `<div class="scroll"><table class="grid"><thead><tr><th>Past seasons</th><th class="num wide">Games</th><th class="num">Winners picked</th><th class="num">Betting line</th><th class="num">Average miss</th><th class="num">Betting line</th></tr></thead><tbody>
      <tr><th scope="row">LTF Index, ${BT.seasons}</th><td class="num wide">${BT.games.toLocaleString()}</td><td class="num">${f1(BT.su)}%</td><td class="num">${f1(BT.mktSu)}%</td><td class="num">${f1(BT.miss)}</td><td class="num">${f1(BT.mktMiss)}</td></tr>
      ${(BT.byWeek || []).map(b => `<tr><td class="cn">${b.lab}</td><td class="num wide">${b.n.toLocaleString()}</td><td class="num">${f1(b.su)}%</td><td class="num">${f1(b.mktSu)}%</td><td class="num">${f1(b.miss)}</td><td class="num">${f1(b.mktMiss)}</td></tr>`).join('')}</tbody></table></div>`;
  const what = metric === 'win' ? 'How often each system had the winner, with the record beside it.' : 'How far each predicted margin was from the final margin, in points. Lower is better.';
  return {title:'Scorecard', card:'receipts',
    lead: all.ltf.w + all.ltf.l ? `LTF has picked ${Math.round(all.ltf.pct*100)}% of winners this season, ${all.ltf.w}-${all.ltf.l}, and missed the margin by ${all.ltf.avg.toFixed(1)} points a game.` : '',
    top: pageTop('Scorecard', `LTF graded every week next to the two best-known public ratings and the betting line. Every LTF number is put on file before kickoff and never changed once the game starts. Every game is graded on today's formula. The other three are yardsticks. None of them is part of the LTF Index.`),
    body: `<div class="facts">${facts}</div>
    <p class="hint after">${factNote}</p>
    <p class="next">${rows.length ? `${rows.length} games graded so far this season.` : 'No games graded yet.'}${file.length ? ` <b>${file.length} week ${gameById[file[0].id].w} games are on file.</b> <a class="txt" href="${L('picks')}">See the picks</a>` : ''}</p>
    <section class="sec"><h2>Week by week</h2>${seg}<p class="hint">${what} The best of the rating systems each week is in bold. The betting line is the yardstick, so it is left out of that.</p>
      <div class="scroll"><table class="grid sc"><thead><tr><th>Week</th><th class="num wide">Games</th>${SC_SYS.map(([k, name]) => `<th class="num">${name}</th>`).join('')}</tr></thead>
      <tbody>${body || `<tr><td class="empty" colspan="${SC_SYS.length + 2}">The first graded week shows up here once games are final.</td></tr>`}${hd && head.length < rows.length ? line(`Since week ${hw}, all four on file`, head, 'tot') : ''}${rows.length ? line(hd && head.length < rows.length ? 'Whole season' : 'Season', rows, 'tot') : ''}</tbody></table></div>
      ${weeks.some(w => !lockedWeeks.includes(w)) ? `<p class="hint after">"LTF rebuilt" marks weeks from before numbers were put on file. For those, the LTF line is rebuilt under today's formula from only the games played up to that week, and SP+ and FPI are blank because their weekly ratings were not being saved yet.</p>` : ''}
      ${stray.length ? `<p class="hint after">${stray.length === 1 ? 'One game' : `${stray.length} games`} in ${stray.length === 1 ? 'a week that is otherwise on file' : 'weeks that are otherwise on file'} had no LTF number on file under today's formula before kickoff${stray.length <= 4 ? `: ${list(stray.map(r => `${esc(r.g.a)} at ${esc(r.g.h)} in week ${r.g.w}`))}` : ''}. ${stray.length === 1 ? 'That game is' : 'Those games are'} graded on the LTF line rebuilt from the games played before ${stray.length === 1 ? 'it' : 'them'}, the same way as the rebuilt weeks, and left out of the row for games with all four on file. <a class="txt" href="${L('how')}">How numbers go on file</a></p>` : ''}</section>
    <section class="sec"><h2>The longer record</h2><p class="hint">One season is a small sample. This is the same LTF Index rebuilt week by week for ${BT.seasons}, picking the next week's games, next to the betting line on those games.</p>${past}
      <p class="next"><a class="txt" href="${L('track')}">Every LTF line this season, graded</a></p></section>
    <div class="note"><p><b>How each number is made.</b> LTF is the LTF line. SP+ and FPI are each team's rating in points, home minus away, plus ${M.hfa} for home field. The betting line is the ${esc(M.book)} closing line, read once the game is over.</p>
      <p><b>Why a betting line is on this page.</b> It is the hardest yardstick there is. It knows about injuries, suspensions and quarterback changes, and it has every earlier season to lean on. The LTF Index knows none of that. It sees this season's games and nothing else, so finishing a point or two behind the line on winners is what a good result looks like.</p>
      <p><b>Fair play.</b> SP+ belongs to Bill Connelly and ESPN, and FPI belongs to ESPN. They are here for comparison only. Their ratings are pulled a few days before the games, so a later update on their side is not reflected.</p></div>` + lineNote};
}

/* ================= front page pieces: this week's games and the record so far ================= */
function weekBig(n){   // the biggest games of the coming week: the best pairs of teams by rank
  if (M.next == null) return [];
  return G.filter(g => g.w === M.next && byName[g.h] && byName[g.a]).sort((a,b) => (byName[a.h].rank + byName[a.a].rank) - (byName[b.h].rank + byName[b.a].rank)).slice(0, n);
}
function homeWeek(){
  const games = weekBig(6); if (!games.length) return '';
  const total = G.filter(g => g.w === M.next).length, ups = upsetWatch(M.next).live.length;
  return `<section class="sec"><h2>Week ${M.next}: the biggest games</h2><p class="hint">The LTF pick for each, and the chance that pick wins. Select a game for the reasons.</p>
    ${gameList([...games].sort((a,b) => new Date(a.d) - new Date(b.d)))}
    <p class="next linkrow"><a class="btn go" href="${L('picks')}">Every pick, with the reasons</a><a class="txt" href="${L('games')}">All ${total} games</a>${ups ? `<a class="txt" href="${L('upsets')}">Upset watch: ${ups} live ${ups === 1 ? 'underdog' : 'underdogs'}</a>` : ''}</p></section>`;
}
function homeRecord(){
  const rows = scoreRows(); if (!rows.length) return '';
  const all = scoreTally(rows), lw = rows.filter(r => r.g.w === M.through), last = lw.length ? scoreTally(lw) : null;
  const f = (label, o, note) => fact(label, o.pct == null ? '–' : Math.round(o.pct*100) + '%', note);
  return `<section class="sec"><h2>The record so far</h2><p class="hint">Winners picked this season, in every game between two FBS teams. Every pick is graded, misses included.</p>
    <div class="facts">${f('LTF, this season', all.ltf, `${all.ltf.w}-${all.ltf.l}, off by ${all.ltf.avg.toFixed(1)} points a game`)}
      ${last ? f(`LTF, week ${M.through}`, last.ltf, `${last.ltf.w}-${last.ltf.l}. <a class="txt" href="${L('recap')}">Recap</a>`) : ''}${fact(`LTF over ${NUMW[BT.n] || BT.n} past seasons`, f1(BT.su) + '%', `${BT.games.toLocaleString()} games, off by ${f1(BT.miss)} points a game`)}</div>
    <p class="next linkrow"><a class="txt" href="${L('scorecard')}">Scorecard: LTF next to SP+, FPI and the betting line</a><a class="txt" href="${L('inputs')}">What goes in, and what stays out</a>${last ? shareBtn('receipts', `Share week ${M.through}'s record`, 'more inl sharebtn') : ''}</p></section>`;
}
