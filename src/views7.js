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
