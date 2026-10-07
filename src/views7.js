/* ================= buying and selling ================= */
/* A streak is the first thing people see and the road ahead is the last. Selling: a team that has won three or more in a
   row, where LTF expects them to lose more than they win over their next three games. Buying: a team that has lost two
   or more in a row, where LTF expects them to win more than they lose. The lists are made by the data build
   (buy_sell in build_data.py), never by hand, and always from the LTF Index, whatever weights a reader has set. Each
   week's lists go on file before those teams play again. A call marked rb was rebuilt and was not on file: the weeks
   from before the lists were kept, and any team whose next game had already kicked off. Every call is graded on the
   games it named. */
const BSCALLS = D.calls || [], BSPAST = M.bs || null;
const bsWeeks = () => [...new Set(BSCALLS.map(c => c.w))].sort((a,b) => a-b);
const bsOf = (w, k) => BSCALLS.filter(c => c.w === w && c.k === k && byName[c.t]);
const bsTop = (w, k) => { const cs = bsOf(w, k), filed = cs.filter(c => !c.rb); return filed.length ? [...filed, ...cs.filter(c => c.rb)] : cs; };      // for a headline, a panel or a card: the calls on file come first
const bsStreak = c => `${c.st > 0 ? 'won' : 'lost'} ${NUMW[Math.abs(c.st)] || Math.abs(c.st)} straight`;
function bsGames(c){   // the games a call named, from that team's side, with what has happened since
  return c.g.map(([id, p]) => { const g = gameById[id]; if (!g) return null;
    const home = g.h === c.t, opp = home ? g.a : g.h, done = !!g.done, won = done ? (home ? g.hp > g.ap : g.ap > g.hp) : null;
    return {g, p, home, opp, done, won, site: g.n ? 'vs' : home ? 'vs' : 'at'}; }).filter(Boolean);
}
function bsGrade(c){   // wins and losses since the call, and whether it has played out the way the list said
  const gs = bsGames(c), w = gs.filter(q => q.won === true).length, l = gs.filter(q => q.won === false).length, left = gs.length - w - l, half = gs.length/2;
  const verdict = left ? null : w === half ? 'split' : (c.k === 'sell') === (w < half) ? 'right' : 'wrong';
  return {gs, w, l, left, n: gs.length, verdict};
}
const bsTally = cs => cs.reduce((o, c) => { const r = bsGrade(c); o.w += r.w; o.l += r.l; o.left += r.left; o.bw += c.r[0]; o.bl += c.r[1]; o.n++; return o; }, {w:0, l:0, left:0, bw:0, bl:0, n:0});
const bsGameTxt = q => q.done ? `${q.won ? (q.site === 'at' ? 'won at' : 'beat') : (q.site === 'at' ? 'lost at' : 'lost to')} <a class="tlink" href="${gameL(q.g)}">${esc(q.opp)}</a> ${Math.max(q.g.hp, q.g.ap)}-${Math.min(q.g.hp, q.g.ap)}`
  : `<a class="tlink" href="${gameL(q.g)}">${q.site} ${esc(q.opp)}</a> ${Math.round(q.p*100)}%`;
const bsX = c => `${c.x.toFixed(1)} <span class="cf">of ${c.g.length}</span>`;
function bsLi(c, tagged){   // one team on a list: the streak, the games ahead and, once they are played, how it went
  const t = byName[c.t], r = bsGrade(c), played = r.gs.filter(q => q.done), ahead = r.gs.filter(q => !q.done);
  const since = played.length ? ` Since then they ${list(played.map(bsGameTxt))}.` : '';
  const next = ahead.length ? ` ${played.length ? 'Still to come' : 'Next'}: ${list(ahead.map(bsGameTxt))}.` : '';
  const verdict = r.verdict ? ` <span class="res ${r.verdict === 'right' ? 'up' : r.verdict === 'wrong' ? 'down' : ''}">${r.verdict === 'right' ? 'As called' : r.verdict === 'wrong' ? 'Missed' : 'Split'}</span>` : '';
  const meta = played.length ? `<b class="cnum">${r.w}-${r.l}</b> <span class="cf">since</span>${verdict}` : `<b class="cnum">${c.x.toFixed(1)}</b> <span class="cf">of ${c.g.length}</span>`;
  return `<li class="two"><span><span class="l1"><span class="who">${badge(t,'sm')} ${tl(t)} <span class="cf">${c.r[0]}-${c.r[1]}</span>${tagged ? ` <span class="tag${c.k === 'sell' ? ' o' : ''}">${c.k === 'sell' ? 'Selling' : 'Buying'}</span>` : ''}${c.rb && c.w === M.through ? ' <span class="cf">not on file</span>' : ''}</span><span class="meta">${meta}</span></span>
    <span class="sub2">${cap(bsStreak(c))} through week ${c.w}. LTF ${played.length ? 'expected' : 'expects'} ${c.x.toFixed(1)} wins in their next ${NUMW[c.g.length] || c.g.length}.${since}${next}</span></span></li>`;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const bsNames = (cs, n) => { const ns = cs.slice(0, n).map(c => tl(byName[c.t])); if (cs.length > n) ns.push(`${NUMW[cs.length - n] || cs.length - n} more`); return list(ns); };
function bsLead(w){
  const s = bsTop(w, 'sell'), b = bsTop(w, 'buy');
  if (!s.length && !b.length) return `No team's streak and schedule point in opposite directions after week ${w}.`;
  return `After week ${w}, LTF is ${s.length ? `selling ${bsNames(s, 3)}` : ''}${s.length && b.length ? ' and ' : ''}${b.length ? `buying ${bsNames(b, 3)}` : ''}.`;
}
function viewBuySell(){
  const weeks = bsWeeks(), dek = `Teams whose streak and whose road ahead point in opposite directions. <b>Selling</b> means a team has won three or more in a row, and LTF expects them to lose more than they win over their next three games. <b>Buying</b> means a team has lost two or more in a row, and LTF expects them to win more than they lose. The lists go on file each week before those teams play again, and every one is graded.`;
  if (!weeks.length) return {title:'Buying and selling', top: pageTop('Buying and selling', dek), body:`<p class="empty">The lists start after week 3, once teams have a streak to speak of.</p>`};
  const last = weeks[weeks.length-1], wk = weeks.includes(+R.q.week) ? +R.q.week : last, sell = bsOf(wk, 'sell'), buy = bsOf(wk, 'buy');
  const seg = `<div class="seg" role="group" aria-label="Week">${weeks.map(w => `<a data-keep href="${Lq({week: w === last ? null : w})}" aria-current="${w === wk}">After week ${w}</a>`).join('')}</div>`;
  const rebuilt = w => BSCALLS.some(c => c.w === w) && BSCALLS.filter(c => c.w === w).every(c => c.rb);
  const stray = BSCALLS.filter(c => c.rb && !rebuilt(c.w) && byName[c.t]);
  const panel = (title, hint, cs, none) => `<section class="panel"><h2>${title}</h2><p class="hint">${hint}</p>${cs.length ? `<ol class="rows">${cs.map(c => bsLi(c)).join('')}</ol>` : `<p class="hint">${none}</p>`}</section>`;
  const rec = o => o.w + o.l ? `${o.w}-${o.l}` : '–';
  const row = (label, s, b, cls) => { const ts = bsTally(s), tb = bsTally(b);
    return `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${label}</th><td class="num">${s.length}</td><td class="num wide">${ts.n ? `${ts.bw}-${ts.bl}` : '–'}</td><td class="num"><b>${rec(ts)}</b></td><td class="num">${b.length}</td><td class="num wide">${tb.n ? `${tb.bw}-${tb.bl}` : '–'}</td><td class="num"><b>${rec(tb)}</b></td><td class="num wide">${ts.left + tb.left || '–'}</td></tr>`; };
  const allS = BSCALLS.filter(c => c.k === 'sell' && byName[c.t]), allB = BSCALLS.filter(c => c.k === 'buy' && byName[c.t]), tS = bsTally(allS), tB = bsTally(allB);
  const share = o => o.w + o.l ? Math.round(100*o.w/(o.w + o.l)) + '%' : '–', before = o => o.bw + o.bl ? Math.round(100*o.bw/(o.bw + o.bl)) + '%' : '–';
  const facts = tS.w + tS.l + tB.w + tB.l ? `<div class="facts">
      ${fact('Teams LTF was selling', tS.w + tS.l ? `${tS.w}-${tS.l}` : '–', tS.w + tS.l ? `since they were listed, ${share(tS)}. They had won ${before(tS)} of their games before` : 'no games played yet')}
      ${fact('Teams LTF was buying', tB.w + tB.l ? `${tB.w}-${tB.l}` : '–', tB.w + tB.l ? `since they were listed, ${share(tB)}. They had won ${before(tB)} of their games before` : 'no games played yet')}</div>
      <p class="hint after">Every team listed this season, in the games their listing named. A team can be on the list more than one week, and each listing is graded on its own.</p>` : '';
  const P = BSPAST, pastRow = (name, o, good) => `<tr><th scope="row">${name}</th><td class="num wide">${o.n.toLocaleString()}</td><td class="num wide">${f1(o.per)}</td><td class="num">${f1(o.before)}%</td><td class="num wide">${f1(o.exp)}%</td><td class="num"><b>${f1(o.act)}%</b> <span class="cf">${o.w.toLocaleString()}-${o.l.toLocaleString()}</span></td><td class="num wide">${f1(o.rec)}% <span class="cf">${good}</span></td><td class="num wide">${o.seasons} of ${o.of}</td></tr>`;
  const past = !P ? '' : `<section class="sec"><h2>What past seasons say</h2><p class="hint">The same rule run on ${P.seasons}, week by week, with the LTF Index as it stood at the time. ${P.weeks} weekly lists in all.</p>
      <div class="scroll"><table class="grid"><thead><tr><th>List</th><th class="num wide">Teams</th><th class="num wide">A week</th><th class="num">Had won</th><th class="num wide">LTF expected</th><th class="num">Won after</th><th class="num wide">Teams it fit</th><th class="num wide">Seasons it held</th></tr></thead><tbody>
      ${pastRow('Selling', P.sell, 'had a losing record')}${pastRow('Buying', P.buy, 'had a winning record')}</tbody></table></div>
      <p class="hint after">"Won after" is the share of the listed games those teams won. Teams LTF was selling had been winning ${f1(P.sell.before)}% of the time and won ${f1(P.sell.act)}% of the games that followed. Teams LTF was buying went from ${f1(P.buy.before)}% to ${f1(P.buy.act)}%. Some weeks a list is empty: ${P.sell.none} of the ${P.weeks} weeks had no team to sell and ${P.buy.none} had none to buy.</p></section>`;
  const wkRows = weeks.map(w => row(`<a class="txt" data-keep href="${Lq({week: w === last ? null : w})}">After week ${w}</a>${rebuilt(w) ? ' <span class="cf">LTF rebuilt</span>' : ''}`, bsOf(w, 'sell'), bsOf(w, 'buy'))).join('');
  const strayNote = stray.length ? `<p class="hint after">${stray.length === 1 ? 'One team' : `${stray.length} teams`} could not go on file because their next game had already kicked off: ${list(stray.map(c => `${esc(c.t)} after week ${c.w}`))}. They are marked "not on file" and graded all the same.</p>` : '';
  const graded = `<section class="sec"><h2>Graded, week by week</h2><p class="hint">Each week's lists, with the teams' record before they were listed and their record since, in the games the listing named.</p>
      <div class="scroll"><table class="grid"><thead><tr><th>Lists made</th><th class="num">Selling</th><th class="num wide">Record before</th><th class="num">Since</th><th class="num">Buying</th><th class="num wide">Record before</th><th class="num">Since</th><th class="num wide">Games to play</th></tr></thead>
      <tbody>${wkRows}${weeks.length > 1 ? row('Season', allS, allB, 'tot') : ''}</tbody></table></div>
      ${weeks.some(rebuilt) ? `<p class="hint after">"LTF rebuilt" marks weeks from before the lists were put on file. Those lists are rebuilt under today's formula from only the games played up to that week.</p>` : ''}${strayNote}</section>`;
  return {title:'Buying and selling', card:'buysell', lead: bsLead(wk),
    top: pageTop('Buying and selling', dek),
    body: `${weeks.length > 1 ? seg : ''}<div class="panels">
      ${panel('Selling', 'Won three or more straight, with more losses than wins expected ahead. The number is how many of their next games LTF expects them to win.', sell, `No one after week ${wk}. No team on a winning streak has that hard a road ahead.`)}
      ${panel('Buying', 'Lost two or more straight, with more wins than losses expected ahead. The number is how many of their next games LTF expects them to win.', buy, `No one after week ${wk}. No team on a losing streak has that soft a road ahead.`)}
    </div>
    ${facts}${graded}${past}
    <div class="note"><p><b>How the lists are made.</b> A rule makes them, the same way every week, and nobody picks the teams. A streak counts every game, lower-division opponents included. "Next three games" means the next three against FBS teams, since LTF sets no line against anyone else. Late in the season the two that are left will do. The chance to win each game comes from the <a class="txt" href="${L('how')}">LTF line</a>, and the chances are added up.</p>
      <p><b>What this is, and what it is not.</b> It is not a new prediction. It is the LTF line for each team's next few games, told as a story about the team. It is here because streaks do not carry forward the way people expect. The <a class="txt" href="${L('momentum')}">momentum</a> page has that test. The lists always use the LTF Index, even if you have set your own weights.</p></div>
    <p class="next"><a class="txt" href="${L('upsets')}">Upset watch</a> &nbsp; <a class="txt" href="${L('picks')}">This week's picks</a></p>`};
}
/* the front page: the newest lists in one panel */
function homeBuySell(){
  const weeks = bsWeeks(), w = weeks[weeks.length-1]; if (w == null || w !== M.through) return '';
  const s = bsTop(w, 'sell'), b = bsTop(w, 'buy'); if (!s.length && !b.length) return '';
  const pick = [...s.slice(0, 2), ...b.slice(0, Math.max(2, 4 - Math.min(2, s.length)))];
  return `<section class="panel full"><h2>Buying and selling</h2><p class="hint">Teams whose streak and whose next three games point in opposite directions, by the LTF line. On file before they play again, and graded.</p>
    <ol class="rows">${pick.map(c => bsLi(c, true)).join('')}</ol><a class="more" href="${L('buysell')}">${s.length + b.length > pick.length ? `All ${s.length + b.length} teams, and how the lists have done` : 'How the lists have done'}</a></section>`;
}
/* a team's own page: one line when they are on this week's list */
function teamBuySell(t){
  const c = BSCALLS.find(q => q.w === M.through && q.t === t.n); if (!c) return '';
  const gs = bsGames(c);
  return `<p class="next"><b>${c.k === 'sell' ? 'Selling' : 'Buying'}.</b> They have ${bsStreak(c)}, and LTF expects ${c.x.toFixed(1)} wins in their next ${NUMW[c.g.length] || c.g.length} games: ${list(gs.map(bsGameTxt))}. <a class="txt" href="${L('buysell')}">Buying and selling</a></p>`;
}

/* ================= against the line ================= */
/* A benchmark and nothing more: where LTF and the closing betting line disagreed on a finished game, and who turned out
   right. The line is the hardest yardstick there is. It is never part of the LTF Index, and the site shows no line for a
   game that has not been played, so nothing on this page can be used ahead of a game. "Edge" is how far the LTF line sat
   from the betting line, named for the team LTF rated higher than the line did. */
const VSPAST = M.vs || null;
let _vs = null;
function vsLine(){
  if (_vs) return _vs;
  return _vs = scoreRows().filter(r => r.pred.mkt != null).map(r => {
    const g = r.g, lt = r.pred.ltf, mk = r.pred.mkt, gap = lt - mk, side = gap > 0 ? g.h : g.a, res = (r.act - mk) * Math.sign(gap);
    const split = lt !== 0 && mk !== 0 && r.act !== 0 && (lt > 0) !== (mk > 0), winner = r.act > 0 ? g.h : g.a;
    return {g, act: r.act, lt, mk, gap, side, split, winner, locked: r.locked, ltfPick: lt > 0 ? g.h : g.a, linePick: mk > 0 ? g.h : g.a, ltfRight: (lt > 0) === (r.act > 0),
      beat: gap === 0 || res === 0 ? null : res > 0, closer: Math.abs(r.act - lt) < Math.abs(r.act - mk), el: Math.abs(r.act - lt), em: Math.abs(r.act - mk)};
  });
}
const vsM = (g, m, full) => half(m) === 0 ? (full ? "the game a pick 'em" : "Pick 'em") : `${esc(full ? (m > 0 ? g.h : g.a) : (m > 0 ? byName[g.h] : byName[g.a]).ab)} by ${half(m)}`;      // a margin for the home team, written the way a line is
const vsCount = rows => { const s = rows.filter(r => r.split), b = rows.filter(r => r.beat != null);
  return {n: rows.length, split: s.length, sw: s.filter(r => r.ltfRight).length, bw: b.filter(r => r.beat).length, bn: b.length, closer: rows.filter(r => r.closer).length}; };
function viewVsLine(){
  const dek = `Where LTF and the betting line disagreed, and who turned out right. The line is the hardest yardstick there is, so this is a benchmark and nothing more. It covers finished games only. The site never shows a line for a game that has not been played.`;
  const all = vsLine(), P = VSPAST;
  const pastRows = !P ? '' : P.gaps.map(q => `<tr><th scope="row">${q.lo ? `Lines ${q.lo} or more points apart` : 'Every game'}</th><td class="num wide">${q.n.toLocaleString()}</td><td class="num"><b>${f1(q.beat)}%</b> <span class="cf">${q.w.toLocaleString()}-${q.l.toLocaleString()}</span></td><td class="num">${f1(q.closer)}%</td></tr>`).join('');
  const past = !P ? '' : `<section class="sec"><h2>What past seasons say</h2><p class="hint">The LTF Index rebuilt week by week for ${P.seasons}, against the closing line on ${P.games.toLocaleString()} games.</p>
      <div class="facts">${fact('Different winners', `${P.split.w}-${P.split.l}`, `LTF's team won ${f1(P.split.pct)}% of ${P.split.n} games. Over half in ${P.split.seasons} of ${P.split.of} seasons`)}
        ${fact('Through week 7', f1(P.split.early.pct) + '%', `${P.split.early.w}-${P.split.early.l} when the two picked different winners`)}
        ${fact('Week 8 on', f1(P.split.late.pct) + '%', `${P.split.late.w}-${P.split.late.l}, level with the line`)}</div>
      <div class="scroll"><table class="grid"><thead><tr><th>Games</th><th class="num wide">Count</th><th class="num">LTF's side beat the line</th><th class="num">LTF was closer</th></tr></thead><tbody>${pastRows}</tbody></table></div>
      <p class="hint after">"LTF's side" is the team LTF rated higher than the line did. They beat the line when the final margin landed on their side of it. Half is a coin flip, and that is where LTF sits however far apart the two lines were. The line is closer to the final margin more often because it knows about injuries and lineups, and early in the season it also knows about earlier seasons. LTF knows this season's games and nothing else.</p></section>`;
  if (!all.length) return {title:'Against the line', top: pageTop('Against the line', dek), body: `<p class="empty">No finished game has both an LTF line and a closing betting line yet.</p>${past}${lineNote}`};
  const weeks = [...new Set(all.map(r => r.g.w))].sort((a,b) => a-b), wk = weeks.includes(+R.q.week) ? +R.q.week : null, rows = wk ? all.filter(r => r.g.w === wk) : all, c = vsCount(rows), ca = vsCount(all);
  const seg = `<div class="seg" role="group" aria-label="Week"><a data-keep href="${Lq({week:null})}" aria-current="${!wk}">Season</a>${weeks.map(w => `<a data-keep href="${Lq({week:w})}" aria-current="${w === wk}">Week ${w}</a>`).join('')}</div>`;
  const li = r => `<li class="two"><span><span class="l1"><a class="tlink" href="${gameL(r.g)}">${finalTxt(r.g)}</a><span class="meta">${esc(byName[r.side].ab)} +${Math.abs(r.gap).toFixed(1)}</span></span>
    <span class="sub2">Week ${r.g.w}. LTF had ${vsM(r.g, r.lt, true)}. The betting line had ${vsM(r.g, r.mk, true)}.</span></span></li>`;
  const won = rows.filter(r => r.split && r.ltfRight).sort((a,b) => Math.abs(b.mk) - Math.abs(a.mk)), lost = rows.filter(r => r.split && !r.ltfRight).sort((a,b) => Math.abs(b.lt) - Math.abs(a.lt));
  const table = [...rows].filter(r => Math.abs(r.gap) >= 3).sort((a,b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 40).map(r => `<tr><td class="num">${r.g.w}</td><td class="wrap2"><a class="tlink" href="${gameL(r.g)}">${finalTxt(r.g)}</a></td><td>${vsM(r.g, r.lt)}</td><td>${vsM(r.g, r.mk)}</td>
      <td class="num">${esc(byName[r.side].ab)} +${Math.abs(r.gap).toFixed(1)}</td><td class="res ${r.beat ? 'up' : r.beat === false ? 'down' : ''}">${r.beat == null ? 'Even' : r.beat ? 'LTF\'s side' : 'The line\'s side'}</td><td class="num wide">${r.el.toFixed(1)}</td><td class="num wide">${r.em.toFixed(1)}</td></tr>`).join('');
  const wkRows = weeks.map(w => { const q = vsCount(all.filter(r => r.g.w === w));
    return `<tr><th scope="row"><a class="txt" data-keep href="${Lq({week:w})}">Week ${w}</a>${all.some(r => r.g.w === w && r.locked) ? '' : ' <span class="cf">LTF rebuilt</span>'}</th><td class="num">${q.n}</td><td class="num">${q.split}</td><td class="num"><b>${q.split ? `${q.sw}-${q.split - q.sw}` : '–'}</b></td><td class="num">${q.bn ? `${q.bw}-${q.bn - q.bw}` : '–'}</td><td class="num wide">${q.closer} of ${q.n}</td></tr>`; }).join('');
  const pct = (a, b) => b ? Math.round(100*a/b) + '%' : '–';
  return {title:'Against the line', lead: ca.split ? `When LTF and the betting line have picked different winners this season, LTF is ${ca.sw}-${ca.split - ca.sw}.` : `LTF and the betting line have picked the same winner in every game this season.`,
    top: pageTop('Against the line', dek),
    body: `${weeks.length > 1 ? seg : ''}<div class="facts">
      ${fact('Different winners', c.split ? `${c.sw}-${c.split - c.sw}` : '–', c.split ? `LTF's team won ${pct(c.sw, c.split)} of the ${c.split} games where the two disagreed` : 'the two picked the same winner every time')}
      ${fact('LTF\'s side beat the line', c.bn ? `${c.bw}-${c.bn - c.bw}` : '–', `${pct(c.bw, c.bn)}. Half is a coin flip`)}
      ${fact('LTF was closer', `${c.closer} of ${c.n}`, `${pct(c.closer, c.n)} of games, on the final margin`)}
      ${fact('Games', c.n, wk ? `week ${wk}` : `weeks ${weeks.join(', ')}`)}</div>
    <div class="panels">
      <section class="panel"><h2>Calls LTF won</h2><p class="hint">LTF and the line picked different winners, and LTF's team won. The biggest line against them comes first. The number is the edge: how many points LTF sat from the line, and toward which team.</p>${won.length ? `<ol class="rows">${won.slice(0,8).map(li).join('')}</ol>` : '<p class="hint">None in these games.</p>'}</section>
      <section class="panel"><h2>Calls the line won</h2><p class="hint">The two picked different winners, and the line's team won. LTF's most confident misses come first.</p>${lost.length ? `<ol class="rows">${lost.slice(0,8).map(li).join('')}</ol>` : '<p class="hint">None in these games.</p>'}</section>
    </div>
    <section class="sec"><h2>Week by week</h2>
      <div class="scroll"><table class="grid"><thead><tr><th>Week</th><th class="num">Games</th><th class="num">Different winners</th><th class="num">LTF's record in those</th><th class="num">LTF's side beat the line</th><th class="num wide">LTF was closer</th></tr></thead>
      <tbody>${wkRows}${weeks.length > 1 ? `<tr class="tot"><th scope="row">Season</th><td class="num">${ca.n}</td><td class="num">${ca.split}</td><td class="num"><b>${ca.split ? `${ca.sw}-${ca.split - ca.sw}` : '–'}</b></td><td class="num">${ca.bw}-${ca.bn - ca.bw}</td><td class="num wide">${ca.closer} of ${ca.n}</td></tr>` : ''}</tbody></table></div>
      <p class="hint after">"LTF rebuilt" marks weeks from before LTF numbers were put on file. Those lines are rebuilt from only the games played up to that week.</p></section>
    <section class="sec"><h2>The biggest edges${wk ? `, week ${wk}` : ''}</h2><p class="hint">Finished games where the LTF line and the betting line were 3 or more points apart, widest first. The edge names the team LTF rated higher than the line did. The last two columns are how far each line finished from the real margin.</p>
      <div class="scroll"><table class="grid"><thead><tr>${th('Wk','num')}${th('Final')}${th('LTF line','','line')}${th('Betting line','','market')}${th('Edge','num')}${th('Who was right')}${th('LTF miss','num wide')}${th('Line miss','num wide')}</tr></thead><tbody>${table || '<tr><td class="empty" colspan="8">No game had the two lines 3 or more points apart.</td></tr>'}</tbody></table></div></section>
    ${past}
    <div class="note"><p><b>Why this page exists.</b> People ask whether LTF beats the books. This is the honest answer, kept in one place: it does not, and it is not built to. LTF rates teams on this season's games alone. The line also prices in injuries, suspensions, quarterback changes and every earlier season.</p>
      <p><b>What it is good for.</b> It shows where LTF sees a team differently from everyone else, and whether that view held up. The calls LTF won are the ones worth a second look when you build your own rankings.</p></div>` + lineNote};
}
