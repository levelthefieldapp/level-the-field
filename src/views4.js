/* ================= picks, for every week left ================= */
const fine = `<p class="hint fineprint">For information only. This is not betting advice. LTF cannot see injuries or lineup changes, and over five past seasons the market predicted games a little better than LTF did. If gambling is a problem for you or someone you know, call 1-800-GAMBLER.</p>`;
const matchup = g => `${esc(g.a)} ${g.n?'vs':'at'} ${esc(g.h)}`;
function viewPicks(){
  const q = findText(), fut = FUTURE();
  if (!fut.length) return {title:'Picks', top: pageTop('Picks', 'The regular season is over, so there are no games left to pick.'), body:`<p class="next"><a class="txt" href="${L('track')}">See how the picks did</a></p>`};
  const wk = fut.includes(+R.q.week) ? +R.q.week : M.next, now = wk === M.next;
  const tabs = weekTabs(fut, wk, M.next, w => w === M.next ? 'Next' : 'Ahead');
  const all = weekGames(wk).filter(x => !x.g.done), noLine = all.filter(x => !x.pr).length;
  let games = all.filter(x => x.pr && [x.g.h, x.g.a].some(n => inGroup(byName[n]))).map(x => ({...x, c: confidence(x.g), e: edgeOf(x.g), ps: projScore(x.g)}));
  if (q) games = games.filter(x => x.g.h.toLowerCase().includes(q) || x.g.a.toLowerCase().includes(q));
  const title = `Week ${wk} picks`, lined = games.filter(x => x.g.hs != null).length, mkts = lined > 0;
  if (!games.length) return {title, controls:true, top: pageTop(title, `LTF picks for week ${wk}.`), body: tabs + `<p class="empty">No games match. Clear the search box or pick a different week or group.</p>`};
  const li = (x, right, sub) => `<li class="two"><span><span class="l1"><a class="tlink" href="${gameL(x.g)}">${matchup(x.g)}</a><span class="meta">${right}</span></span><span class="sub2">${sub}</span></span></li>`;
  const pickTxt = x => x.pr.pts === 0 ? "Pick 'em" : `${esc(x.c.pick.n)} by ${x.pr.pts}`;
  const cnum = x => `<b class="cnum">${x.c.score}</b>`;
  const safest = [...games].sort((a,b) => b.c.score-a.c.score).slice(0,6).map(x => li(x, cnum(x), `${pickTxt(x)}. ${x.c.why[1] ? x.c.why[1].t : ''}`)).join('');
  const closest = [...games].sort((a,b) => Math.abs(a.c.score-50)-Math.abs(b.c.score-50)).slice(0,6).map(x => li(x, cnum(x), `LTF line: ${lineTxt(x.pr)}.${x.g.hs != null ? ` Market: ${marketTxt(x.g)}.` : ''}`)).join('');
  const contested = games.filter(x => x.c.mk != null && x.c.mk < 0).sort((a,b) => b.c.score-a.c.score).slice(0,6)
    .map(x => li(x, cnum(x), `LTF line: ${lineTxt(x.pr)}. Market: ${marketTxt(x.g)}.`)).join('');
  const edges = games.filter(x => x.e && x.e.pts >= 4).sort((a,b) => b.e.pts-a.e.pts).slice(0,8).map(x =>
    li(x, edgeTxt(x.e, true), `LTF line: ${lineTxt(x.pr)}. Market: ${marketTxt(x.g)}.${x.e.band ? ` Edges this size covered ${x.e.band.hit}% of the time in ${x.e.band.n.toLocaleString()} past games.` : ''}`)).join('');
  const best = [...games].sort((a,b) => (byName[a.g.h].rank + byName[a.g.a].rank) - (byName[b.g.h].rank + byName[b.g.a].rank)).slice(0,6)
    .map(x => li(x, cnum(x), `No. ${byName[x.g.a].rank} ${x.g.n?'vs':'at'} No. ${byName[x.g.h].rank}. ${pickTxt(x)}.`)).join('');
  const sorted = R.q.sort === 'conf' ? [...games].sort((a,b) => b.c.score-a.c.score) : R.q.sort === 'edge' ? [...games].sort((a,b) => (b.e ? b.e.pts : -1)-(a.e ? a.e.pts : -1)) : games;
  const rows = sorted.map(x => { const g = x.g, c = x.c, ps = x.ps;
    return `<tr class="pk"><td class="wide">${fmtDay(g.d)}</td><td class="wrap2"><a class="tlink" href="${gameL(g)}">${matchup(g)}</a><span class="cf nblock">${fmtDay(g.d)}${ps ? `. Projected: ${esc(byName[g.a].ab)} ${ps.ap}, ${esc(byName[g.h].ab)} ${ps.hp}` : ''}${g.hs != null ? `. Market: ${marketTxt(g, true)}` : ''}</span></td>
      <td><b class="pkt">${x.pr.pts === 0 ? "Pick 'em" : `${esc(c.pick.ab)} ${signed(-x.pr.pts)}`}</b></td>
      <td>${confCell(c)}</td>
      <td class="wide">${ps ? `${esc(byName[g.a].ab)} ${ps.ap}, ${esc(byName[g.h].ab)} ${ps.hp}` : '–'}</td>
      <td class="wide">${marketTxt(g, true) ?? '<span class="cf">Not posted</span>'}</td><td class="wide">${edgeTxt(x.e, true)}</td></tr>
      <tr class="pkw"><td class="wide"></td><td colspan="6">${whyList(c, 5)}<a class="more inl" href="${gameL(g)}">Full breakdown</a></td></tr>`; }).join('');
  const b = BT, su = suRecord();
  const so = (key, label) => `<a data-keep href="${Lq({sort:key})}" aria-current="${(R.q.sort || null) === key}">${label}</a>`;
  return {title, controls:true, top: pageTop(title, `<b>${groupKey()==='all' ? 'Every game' : esc(groupLabel())}.</b> ${now ? 'What LTF expects this week' : `What LTF expects in week ${wk}, from where every team stands today`}. Each pick has a confidence score and the reasons behind it.${now ? '' : ` ${lined ? `Early market lines are posted for ${lined} of these ${games.length} games` : 'Market lines post closer to the game'}, so most of these scores rest on LTF alone and will move as results come in.`}`),
    body: tabs + `<div class="facts">${fact('Winners picked, five past seasons', b.su + '%', `${b.games ? b.games.toLocaleString() : ''} games. The market picked ${b.mktSu}%`)}
      ${fact('Winners picked, this season', (su.n ? Math.round(100*su.w/su.n) : 0) + '%', `${su.w} of ${su.n} games since week ${HW[0]+1}`)}
      ${fact('LTF Edge against the spread, five past seasons', b.atsAll + '%', 'A coin flip. Do not treat it as a way to beat the line')}</div>
    <div class="panels">
      <section class="panel"><h2>Most confident</h2><p class="hint">The highest confidence scores of the week.</p><ol class="rows">${safest}</ol></section>
      <section class="panel"><h2>Closest calls</h2><p class="hint">Confidence nearest to 50, a coin flip.</p><ol class="rows">${closest}</ol></section>
      ${mkts ? `<section class="panel"><h2>Contested picks</h2><p class="hint">Games where LTF and the market name different winners. In past seasons the market was right more often, so these score under 50.</p>${contested ? `<ol class="rows">${contested}</ol>` : '<p class="hint">None. LTF and the market agree on every winner that has a line.</p>'}</section>
      <section class="panel"><h2>Biggest LTF Edges</h2><p class="hint">Where the LTF line is furthest from the market line, and how edges that size have done against the spread.</p>${edges ? `<ol class="rows">${edges}</ol>` : '<p class="hint">Nothing differs by four points or more.</p>'}</section>`
      : ''}
      <section class="panel full"><h2>Biggest games</h2><p class="hint">The matchups between the highest-ranked teams.</p><ol class="rows">${best}</ol></section>
    </div>
    <section class="sec"><h2>Every game, with the why</h2>
      <div class="seg" role="group" aria-label="Order">${so(null,'By date')}${so('conf','Most confident first')}${mkts ? so('edge','Biggest LTF Edge first') : ''}</div>
      ${colKey([['LTF pick', 'The team LTF favors and by how many points.'], ['Confidence', 'The chance that pick wins, out of 100. A 50 is a coin flip.'], ['Projected score', 'A rough guide built from the LTF line.', true], ['Market', 'The sportsbook line, once it is posted.', true], ['LTF Edge', 'The team LTF rates higher than the market does, and by how many points.', true]])}
      <p class="hint">Under each game are the reasons for its score. A green mark supports the pick and a red mark counts against it.${noLine ? ` ${noLine} ${noLine===1?'game':'games'} against FCS teams ${noLine===1?'has':'have'} no line.` : ''}</p>
      <div class="scroll"><table class="grid wk picks"><thead><tr>${th('Date','wide')}${th('Game')}${th('LTF pick','','line')}${th('Confidence','','conf')}${th('Projected score','wide','ps')}${th('Market','wide','market')}${th('LTF Edge','wide','lean')}</tr></thead><tbody>${rows}</tbody></table></div></section>${fine}`};
}

/* ================= weekly recap ================= */
function viewRecap(){
  const weeks = HW.map(w => w+1).filter(w => w <= M.through);
  const wk = weeks.includes(+R.q.week) ? +R.q.week : weeks[weeks.length-1];
  if (!wk) return {title:'Weekly recap', top: pageTop('Weekly recap', 'How LTF did on last week\'s games.'), body:'<p class="empty">The recap starts once LTF has had a line on a full week of games.</p>'};
  const seg = `<div class="seg" role="group" aria-label="Week">${weeks.map(w => `<a data-keep href="${Lq({week: w===weeks[weeks.length-1] ? null : w})}" aria-current="${w===wk}">Week ${w}</a>`).join('')}</div>`;
  const gs = G.filter(g => g.done && g.w === wk).map(g => ({g, x: gameLine(g)})).filter(q => q.x);
  const dec = gs.filter(q => q.x.pts !== 0), suW = dec.filter(q => (q.x.m > 0) === (q.g.hp > q.g.ap)).length;
  const mk = gs.filter(q => q.g.hs != null && q.g.hs !== 0), mkW = mk.filter(q => (q.g.hs < 0) === (q.g.hp > q.g.ap)).length;
  const tr = trackRecord().rows.filter(r => r.g.w === wk), aw = tr.filter(r => r.right === true).length, al = tr.filter(r => r.right === false).length, ap = tr.filter(r => r.right === null).length;
  const li = (g, right, sub) => `<li class="two"><span><span class="l1"><a class="tlink" href="${gameL(g)}">${finalTxt(g)}</a><span class="meta">${right}</span></span><span class="sub2">${sub}</span></span></li>`;
  const ups = gs.map(q => { const hw = q.g.hp > q.g.ap, p = hw ? q.x.pHome : 1-q.x.pHome; return {...q, p, win: hw ? q.g.h : q.g.a}; }).filter(q => q.p < .3).sort((a,b) => a.p-b.p).slice(0,8)
    .map(q => li(q.g, `${Math.round(q.p*100)}% chance`, `The LTF line was ${lineTxt(q.x)} before kickoff. ${esc(q.win)} won by ${Math.abs(q.g.hp-q.g.ap)}.`)).join('');
  const best = tr.filter(r => r.right === true && r.side).sort((a,b) => Math.abs(b.mi-b.mm)-Math.abs(a.mi-a.mm)).slice(0,5)
    .map(r => li(r.g, `off by ${r.ei.toFixed(1)}`, `LTF line: ${lineTxt(r.x)}. Market: ${marketTxt(r.g)}. The LTF Edge was on ${esc(r.side)}, and ${esc(r.side)} covered.`)).join('');
  const worst = [...tr].sort((a,b) => b.ei-a.ei).slice(0,5)
    .map(r => li(r.g, `off by ${r.ei.toFixed(1)}`, `LTF line: ${lineTxt(r.x)}. Market: ${marketTxt(r.g)}, which was off by ${r.em.toFixed(1)}.`)).join('');
  const rows = [...tr].sort((x,y) => Math.abs(y.mi-y.mm)-Math.abs(x.mi-x.mm)).map(r => { const g = r.g;
    return `<tr><td class="wrap2"><a class="tlink" href="${gameL(g)}">${finalTxt(g)}</a></td><td class="wide">${lineTxt(r.x, true)}</td><td class="wide">${marketTxt(g, true)}</td>
      <td>${r.side ? esc(byName[r.side].ab) : '<span class="cf">Same</span>'}</td><td class="res ${r.right===true?'up':r.right===false?'down':''}">${r.right===true?'Right':r.right===false?'Wrong':'Push'}</td>
      <td class="num wide">${r.ei.toFixed(1)}</td><td class="num wide">${r.em.toFixed(1)}</td></tr>`; }).join('');
  const mi = tr.length ? mean(tr.map(r => r.ei)) : 0, mm = tr.length ? mean(tr.map(r => r.em)) : 0;
  return {title:`Week ${wk} recap`, top: pageTop(`Week ${wk} recap`, `How LTF did on week ${wk}. Every line here was set before kickoff, from earlier games only.`),
    body: seg + `<div class="facts">${fact('Winners picked', `${suW} of ${dec.length}`, `${dec.length ? Math.round(100*suW/dec.length) : 0}%. Market favorites won ${mkW} of ${mk.length}`)}
      ${fact('LTF side against the spread', `${aw}-${al}${ap?'-'+ap:''}`, `${aw+al ? Math.round(100*aw/(aw+al)) : 0}% of decided games`)}
      ${fact('Average miss', mi.toFixed(1) + ' points', `The market missed by ${mm.toFixed(1)}`)}
      ${fact('Upsets', gs.filter(q => (q.g.hp > q.g.ap ? q.x.pHome : 1-q.x.pHome) < .3).length, 'winners LTF gave under 30%')}</div>
    <div class="panels">
      <section class="panel"><h2>Upsets of the week</h2><p class="hint">Winners LTF gave less than a 30% chance.</p>${ups ? `<ol class="rows">${ups}</ol>` : '<p class="hint">None. Every winner had at least a 30% chance.</p>'}</section>
      <section class="panel"><h2>Worst misses</h2><p class="hint">Where the LTF line was furthest from the final margin.</p>${worst ? `<ol class="rows">${worst}</ol>` : '<p class="hint">No games with both lines this week.</p>'}</section>
      <section class="panel full"><h2>Best calls</h2><p class="hint">Games where LTF disagreed with the market and its side covered, largest LTF Edge first.</p>${best ? `<ol class="rows">${best}</ol>` : '<p class="hint">None this week.</p>'}</section>
    </div>
    <section class="sec"><h2>Every game with a line</h2><div class="scroll"><table class="grid"><thead><tr>${th('Final')}${th('LTF line','wide','line')}${th('Market line','wide','market')}${th('LTF side','','lean')}${th('Result')}${th('LTF miss','num wide')}${th('Market miss','num wide')}</tr></thead><tbody>${rows || '<tr><td class="empty" colspan="7">No games had both an LTF line and a market line.</td></tr>'}</tbody></table></div>
    <p class="next"><a class="txt" href="${L('track')}">Season-long track record</a> &nbsp; <a class="txt" href="${L('games', null, {week:wk})}">All week ${wk} scores</a></p></section>${fine}`};
}

/* ================= season odds ================= */
function viewOdds(){
  const now = simulate(M.through), was = PREV != null ? simulate(PREV) : null, q = findText(), view = R.q.view === 'wins' ? 'wins' : 'main';
  const s = sortState(view === 'wins' ? 'xw' : 'po');
  let rows = T.filter(inGroup);
  const val = t => { const o = now[t.n];
    if (s.key[0] === 'g' && /^g\d+$/.test(s.key)) return o.ge[WINS.indexOf(+s.key.slice(1))] + o.xw/1000;
    return s.key==='po' ? o.po*1000 + o.xw/100 + t.cz/1e4 : s.key==='cf' ? o.cf : s.key==='bowl' ? o.bowl + o.xw/1000 : s.key==='xw' ? o.xw : s.key==='chg' ? (was ? o.po - was[t.n].po : 0) : s.key==='idx' ? t.cz : 0; };
  if (s.key==='team') rows.sort((a,b) => s.dir*-1*a.n.localeCompare(b.n)); else rows.sort((a,b) => s.dir*(val(a)-val(b)));
  if (q) rows = rows.filter(t => t.n.toLowerCase().includes(q));
  const bar = v => `<span class="pbar"><i style="width:${(v*100).toFixed(0)}%"></i></span>`;
  const fin = t => { const o = now[t.n], total = t.sched.length, wins = Math.round(o.xw); return `<td class="num">${wins}-${total-wins}<small class="cf wide xwv">${o.xw.toFixed(1)}</small></td>`; };
  const seg = `<div class="seg" role="group" aria-label="Which odds"><a data-keep href="${Lq({view:null, sort:null, dir:null})}" aria-current="${view==='main'}">Playoff and titles</a><a data-keep href="${Lq({view:'wins', sort:null, dir:null})}" aria-current="${view==='wins'}">Win totals, 6 to 12</a></div>`;
  let table;
  if (view === 'wins'){
    const body = rows.map(t => { const o = now[t.n];
      return `<tr>${teamCell(t)}<td class="num">${t.w}-${t.l}</td>${fin(t)}${WINS.map((k,i) => `<td class="num c pos${k % 2 ? ' wide' : ''}" style="--t:${o.ge[i].toFixed(2)}">${pct(o.ge[i])}</td>`).join('')}</tr>`; }).join('');
    table = colKey([['Projected finish', 'The most likely final record, with the average number of wins beside it.'], ['6+ wins to 12+ wins', 'The chance the team finishes the regular season with at least that many wins.']])
      + `<div class="scroll"><table class="grid"><thead><tr>${sortTh('team','Team','','xw')}${th('Record','num','rec')}${sortTh('xw','Projected finish','num','xw','xw')}${WINS.map(k => sortTh('g'+k, `${k}+ wins`, 'num' + (k % 2 ? ' wide' : ''), 'xw', 'wt')).join('')}</tr></thead><tbody>${body || emptyRow(WINS.length+3,'team')}</tbody></table></div>`;
  } else {
    const body = rows.map(t => { const o = now[t.n], d = was ? Math.round((o.po - was[t.n].po)*100) : 0;
      return `<tr>${teamCell(t)}<td class="num wide">${t.rank}</td><td class="num">${t.w}-${t.l}</td>${fin(t)}
        <td class="num wide">${pct(o.bowl)}</td><td class="num">${t.c==='Independent' ? '–' : pct(o.cf)}</td><td>${bar(o.po)}<b class="pob">${pct(o.po)}</b></td>
        <td class="num wide">${!was ? '–' : d === 0 ? '<span class="mv same">same</span>' : `<span class="mv ${d>0?'up':'down'}">${d>0?'up':'down'} ${Math.abs(d)}</span>`}</td></tr>`; }).join('');
    table = colKey([['Projected finish', 'The most likely final record.'], ['Bowl eligible', 'The chance of reaching six wins, the mark for bowl eligibility.', true], ['Win conference', 'The chance of winning the conference title game.'], ['Make the playoff', 'The chance of landing in the 12-team field.'], ['Since last week', 'How much the playoff chance moved, in percentage points.', true]])
      + `<div class="scroll"><table class="grid"><thead><tr>${sortTh('team','Team','','po')}${sortTh('idx','LTF rank','num wide','po','ltfrank')}${th('Record','num','rec')}${sortTh('xw','Projected finish','num','po','xw')}${sortTh('bowl','Bowl eligible','num wide','po','bowl')}${sortTh('cf','Win conference','num','po','ct')}${sortTh('po','Make the playoff','','po','po')}${sortTh('chg','Since last week','num wide','po')}</tr></thead><tbody>${body || emptyRow(8,'team')}</tbody></table></div>`;
  }
  return {title:'Season odds', controls:true, top: pageTop('Season odds', `<b>${groupLabel()}.</b> The rest of the season played out ${SIMS.toLocaleString()} times from the current LTF Index. Each run gives every team a slightly different true strength, plays every remaining game, holds conference title games, and picks a 12-team playoff field.`),
    body: seg + table + `<div class="note"><p>These are estimates from LTF, not forecasts from the selection committee. Conference title games are assumed to match the top two teams by conference record, and the playoff field is picked by LTF Index after each simulated season. LTF forgives a loss more easily than the committee does, so the top teams' playoff chances here run high. Win totals count regular-season games only.</p></div>
    <p class="next"><a class="txt" href="${L('playoff')}">The playoff bracket if the season ended today</a></p>`};
}
