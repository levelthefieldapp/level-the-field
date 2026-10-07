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
    const rows = [['Record', `${t.w}-${t.l}`], ['Strength of record', `${ord(t.rk.sor)} of ${T.length}`], ['Schedule so far', `${ord(t.rk.sos)} hardest`], ['Scoring margin', `${signed(t.d.mar)} a game against an average team`], ['At halftime', `${signed(t.d.h1)} against an average team`],
      ['Offense', `${ord(t.rk.off)}`], ['Defense', `${ord(t.rk.def)}`], ['Points per drive', `${t.d.oppd.toFixed(2)} scored, ${t.d.dppd.toFixed(2)} allowed`], ['Luck', t.luck == null ? '\u2013' : `${signed(t.luck)} points a game`]];
    return `<section class="panel blindc"><h2>${lab}</h2><table class="log"><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="cn">${r[1]}</td></tr>`).join('')}</tbody></table>
      <h3>Best wins</h3><ul class="plain">${w.slice(0,3).map(x => `<li>Beat ${opp(x)} by ${x.e.pf - x.e.pa}${where(x.e)}</li>`).join('') || '<li>None yet</li>'}</ul>
      <h3>Losses</h3><ul class="plain">${l.map(x => `<li>Lost to ${opp(x)} by ${x.e.pa - x.e.pf}${where(x.e)}</li>`).join('') || '<li>None</li>'}</ul>
      ${pick ? '' : `<a class="btn" data-keep href="${Lq({pick: lab === 'Team A' ? 'a' : 'b'})}">${lab} is better</a>`}</section>`; };
  const reveal = t => `<div class="rev">${badge(t)}<span>${tl(t)}<small>${esc(t.c)}. LTF No. ${t.rank}${M.apWeek == null ? '' : `, AP ${t.d.apr ? 'No. ' + t.d.apr : 'unranked'}`}</small></span></div>`;
  let result = '';
  if (pick){
    const chosen = pick === 'a' ? A : B, other = pick === 'a' ? B : A, idxPick = A.rank < B.rank ? A : B;
    const apPick = M.apWeek == null ? null : (A.d.apr || 99) === (B.d.apr || 99) ? null : (A.d.apr || 99) < (B.d.apr || 99) ? A : B;
    result = `<section class="sec"><h2>You picked ${esc(chosen.n)}</h2><div class="dgrid"><div><p class="hint">Team A</p>${reveal(A)}<p class="hint">Team B</p>${reveal(B)}</div>
      <div class="prose"><p>LTF ${idxPick === chosen ? 'agrees with you' : 'went the other way'}: it has ${esc(idxPick.n)} ${Math.abs(A.rank - B.rank)} ${Math.abs(A.rank - B.rank) === 1 ? 'spot' : 'spots'} higher.</p>
        ${apPick ? `<p>The AP poll has ${esc(apPick.n)} higher${apPick === chosen ? ', the same as you' : ''}.</p>` : M.apWeek == null ? '' : '<p>The AP poll ranks neither team.</p>'}
        <p><a class="btn" href="${L('compare', null, {a:A.slug, b:B.slug})}">Compare them in full</a></p></div></div></section>`;
  }
  return {title:'Blind résumé', top: pageTop('Blind résumé', 'Two real teams with the names taken off. Read what each has done this season and pick the better one. Then see who they are, and whether the AP poll agrees with you.'),
    body: `<p class="status">Matchup ${n+1} of ${pairs.length} this week.</p><div class="panels">${card(A, 'Team A')}${card(B, 'Team B')}</div>${result}
      <p class="next"><a class="btn go" href="${L('blind', null, {n: n+2 > pairs.length ? 1 : n+2})}">Next matchup</a> &nbsp; <a class="txt" href="${L('radar')}">Under the radar</a></p>`};
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
  const lead = top.length > 1 ? `Luckiest so far: ${tl(top[0])}, ${signed(top[0].luck)} points a game. Unluckiest: ${tl(top[top.length - 1])}, ${signed(top[top.length - 1].luck)}.` : '';
  return {title:'Luck and steadiness', controls:true, lead, top: pageTop('Luck and steadiness', `<b>${groupLabel()}.</b> Some things swing games but mostly do not repeat: which way a fumble bounces, whether a tipped pass gets picked off, whether the other kicker has a bad day. This page adds those up, and shows which teams play to the same level every week.`),
    body: `<div class="panels">
      <section class="panel"><h2>Luckiest</h2><p class="hint">Results have flattered them a little.</p><ol class="rows">${top.slice(0,5).map(li).join('')}</ol></section>
      <section class="panel"><h2>Unluckiest</h2><p class="hint">Better than their results so far.</p><ol class="rows">${top.slice(-5).reverse().map(li).join('')}</ol></section>
      <section class="panel"><h2>Steadiest</h2><p class="hint">Smallest swing in game score from week to week.</p><ol class="rows">${steady.slice(0,5).map(t => rowB(t, t.rank, `\u00B1${t.swing.toFixed(0)}`)).join('')}</ol></section>
      <section class="panel"><h2>Most up and down</h2><p class="hint">You never know which version shows up.</p><ol class="rows">${steady.slice(-5).reverse().map(t => rowB(t, t.rank, `\u00B1${t.swing.toFixed(0)}`)).join('')}</ol></section></div>
    <section class="sec"><h2>Every team</h2>${colKey([['Luck, points a game', 'Points a game gained or lost to things that mostly do not repeat. Above zero is good luck.'], ['Fumbles recovered', 'Loose balls the team got, out of all fumbles in their games. Half is normal.', true], ['Interception luck', 'Interceptions gained or lost per game compared with passes defended.', true], ['Opponent field goals', 'Kicks made against the team, out of kicks attempted.', true], ['One-score games', 'Record in games decided by 8 points or fewer.'], ['Steadiness', 'How much the team\'s game scores swing from week to week.']])}
      <div class="scroll"><table class="grid"><thead><tr>${sortTh('team','Team','','luck')}${sortTh('idx','LTF rank','num wide','luck','ltfrank')}${th('Record','num','rec')}${sortTh('luck','Luck, points a game','num','luck','luck')}${sortTh('fum','Fumbles recovered','num wide','luck')}${sortTh('int','Interception luck','num wide','luck')}${sortTh('fg','Opponent field goals','num wide','luck')}${sortTh('close','One-score games','num','luck')}${sortTh('steady','Steadiness','num','luck','steady')}</tr></thead><tbody>${body || emptyRow(9,'team')}</tbody></table></div></section>
    <div class="note"><p><b>How luck is counted.</b> Teams recover about half of all fumbles over time, so every recovery above or below half counts as luck. About one in five passes a defense gets a hand on is intercepted, so more or fewer than that counts too. Each turnover is valued at 4.5 points. Opponents' field goal kicking is compared with the national average. One-score games are shown but not added in.</p>
      <p><b>Is luck in the score?</b> No. When turnover luck and opponents' kicking were tested as extra parts of the LTF Index on twelve past seasons, neither made it more accurate. Luck is here to explain a result, such as a win that the stats say should have been a loss.</p>
      ${CFD.steady ? `<p><b>What about steadiness?</b> Steady favorites won ${f1(CFD.steady.act)}% of the time when LTF expected ${f1(CFD.steady.pred)}%, across ${CFD.steady.n.toLocaleString()} past games.${CFD.updown ? ` Up-and-down favorites won ${f1(CFD.updown.act)}% when LTF expected ${f1(CFD.updown.pred)}%.` : ''} That small boost for steady teams shows up in the reasons under a pick. It does not change the pick.</p>` : ''}</div>`};
}
