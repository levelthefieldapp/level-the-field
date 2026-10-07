/* ================= picks, for every week left ================= */
const matchup = g => `${esc(g.a)} ${g.n?'vs':'at'} ${esc(g.h)}`;
function viewPicks(){
  const q = findText(), fut = FUTURE();
  if (!fut.length) return {title:'Picks', top: pageTop('Picks', 'The regular season is over, so there are no games left to pick.'), body:`<p class="next"><a class="txt" href="${L('track')}">See how the picks did</a></p>`};
  const wk = fut.includes(+R.q.week) ? +R.q.week : M.next, now = wk === M.next;
  const tabs = weekTabs(fut, wk, M.next, w => w === M.next ? 'Next' : 'Ahead');
  const all = weekGames(wk).filter(x => !x.g.done), noLine = all.filter(x => !x.pr).length;
  let games = all.filter(x => x.pr && [x.g.h, x.g.a].some(n => inGroup(byName[n]))).map(x => ({...x, c: confidence(x.g), ps: projScore(x.g)}));
  if (q) games = games.filter(x => x.g.h.toLowerCase().includes(q) || x.g.a.toLowerCase().includes(q));
  const title = `Week ${wk} picks`;
  if (!games.length) return {title, controls:true, top: pageTop(title, `LTF picks for week ${wk}.`), body: tabs + `<p class="empty">No games match. Clear the search box or pick a different week or group.</p>`};
  const li = (x, right, sub) => `<li class="two"><span><span class="l1"><a class="tlink" href="${gameL(x.g)}">${matchup(x.g)}</a><span class="meta">${right}</span></span><span class="sub2">${sub}</span></span></li>`;
  const pickTxt = x => x.pr.pts === 0 ? "Pick 'em" : `${esc(x.c.pick.n)} by ${x.pr.pts}`;
  const cnum = x => `<b class="cnum">${x.c.score}</b>`;
  const safest = [...games].sort((a,b) => b.c.p-a.c.p).slice(0,6).map(x => li(x, cnum(x), `${pickTxt(x)}.`)).join('');
  const closest = [...games].sort((a,b) => a.c.p-b.c.p).slice(0,6).map(x => li(x, cnum(x), `${pickTxt(x)}.${!x.g.n && x.c.pick.n === x.g.h && Math.abs(x.pr.m) <= M.hfa && x.pr.pts > 0 ? ` Take away home field and ${esc(x.c.other.n)} would be the pick.` : ''}`)).join('');
  const best = [...games].sort((a,b) => (byName[a.g.h].rank + byName[a.g.a].rank) - (byName[b.g.h].rank + byName[b.g.a].rank)).slice(0,6)
    .map(x => li(x, cnum(x), `No. ${byName[x.g.a].rank} ${x.g.n?'vs':'at'} No. ${byName[x.g.h].rank}. ${pickTxt(x)}.`)).join('');
  const uw = upsetWatch(wk), ups = (uw.alert.length ? uw.alert : uw.live).filter(u => games.some(x => x.g === u.g)).slice(0,6).map(upsetLi).join('');
  const sorted = R.q.sort === 'conf' ? [...games].sort((a,b) => b.c.p-a.c.p) : R.q.sort === 'close' ? [...games].sort((a,b) => a.c.p-b.c.p) : games;
  const rows = sorted.map(x => { const g = x.g, c = x.c, ps = x.ps;
    return `<tr class="pk"><td class="wide">${fmtDay(g.d)}</td><td class="wrap2"><a class="tlink" href="${gameL(g)}">${matchup(g)}</a><span class="cf nblock">${fmtDay(g.d)}${ps ? `. Projected: ${esc(byName[g.a].ab)} ${ps.ap}, ${esc(byName[g.h].ab)} ${ps.hp}` : ''}</span></td>
      <td><b class="pkt">${x.pr.pts === 0 ? "Pick 'em" : `${esc(c.pick.ab)} by ${x.pr.pts}`}</b></td>
      <td>${confCell(c)}</td>
      <td class="wide">${ps ? `${esc(byName[g.a].ab)} ${ps.ap}, ${esc(byName[g.h].ab)} ${ps.hp}` : '–'}</td></tr>
      <tr class="pkw"><td class="wide"></td><td colspan="4">${whyList(c, 4)}<a class="more inl" href="${gameL(g)}">Full breakdown</a></td></tr>`; }).join('');
  const b = BT, su = suRecord();
  const sure = [...games].sort((p, q2) => q2.c.p - p.c.p)[0], tight = [...games].sort((p, q2) => p.c.p - q2.c.p)[0];
  const lead = `Most confident pick${now ? '' : ` of week ${wk}`}: <a class="tlink" href="${gameL(sure.g)}">${esc(sure.c.pick.n)} over ${esc(sure.c.other.n)}</a>, ${sure.c.score} of 100.`
    + (tight && tight !== sure ? ` Closest call: <a class="tlink" href="${gameL(tight.g)}">${matchup(tight.g)}</a>, ${tight.c.score}.` : '') + ` ${games.length} games${groupKey() === 'all' ? '' : ` for the ${esc(groupLabel())}`}.`;
  const so = (key, label) => `<a data-keep href="${Lq({sort:key})}" aria-current="${(R.q.sort || null) === key}">${label}</a>`;
  return {title, controls:true, lead, top: pageTop(title, `<b>${groupKey()==='all' ? 'Every game' : esc(groupLabel())}.</b> ${now ? 'What LTF expects this week' : `What LTF expects in week ${wk}, from where every team stands today`}. Each pick has a confidence score, which is the chance the pick wins, and the reasons behind it.${now ? '' : ' Picks this far ahead will move as results come in.'}`),
    body: tabs + `<div class="facts">${fact(`Winners picked, ${NUMW[b.n] || b.n} past seasons`, f1(b.su) + '%', `${b.games ? b.games.toLocaleString() : ''} games, ${b.seasons}`)}
      ${fact('Winners picked, this season', (su.n ? Math.round(100*su.w/su.n) : 0) + '%', `${su.w} of ${su.n} games since week ${HW[0]+1}`)}
      ${fact('Average miss, past seasons', f1(b.miss) + ' points', 'predicted margin against the real one')}</div>
    <div class="panels">
      <section class="panel"><h2>Most confident</h2><p class="hint">The highest confidence scores of the week.</p><ol class="rows">${safest}</ol></section>
      <section class="panel"><h2>Closest calls</h2><p class="hint">Confidence nearest to 50, a coin flip.</p><ol class="rows">${closest}</ol></section>
      <section class="panel"><h2>Biggest games</h2><p class="hint">The matchups between the highest-ranked teams.</p><ol class="rows">${best}</ol></section>
      <section class="panel"><h2>Upset watch</h2><p class="hint">${uw.alert.length ? 'Top 25 teams with the least room for error. The number is the underdog\'s chance.' : 'The underdogs with the best chance.'} <a class="txt" href="${L('upsets', null, {week: now ? null : wk})}">The full upset watch</a></p>${ups ? `<ol class="rows">${ups}</ol>` : '<p class="hint">No underdog in this group is on the watch.</p>'}</section>
    </div>
    <section class="sec"><h2>Every game, with the why</h2>
      <div class="seg" role="group" aria-label="Order">${so(null,'By date')}${so('conf','Most confident first')}${so('close','Closest first')}</div>
      ${colKey([['LTF pick', 'The team LTF favors and by how many points.'], ['Confidence', 'The chance that pick wins, out of 100. A 50 is a coin flip.'], ['Projected score', 'A rough guide built from the LTF line.', true]])}
      <p class="hint">Under each game are the reasons to trust the pick more or less. A green mark supports the pick and a red mark counts against it. LTF cannot see injuries, suspensions or a change at quarterback.${noLine ? ` ${noLine} ${noLine===1?'game':'games'} against FCS teams ${noLine===1?'has':'have'} no line.` : ''}</p>
      <div class="scroll"><table class="grid wk picks"><thead><tr>${th('Date','wide')}${th('Game')}${th('LTF pick','','line')}${th('Confidence','','conf')}${th('Projected score','wide','ps')}</tr></thead><tbody>${rows}</tbody></table></div></section>`};
}

/* ================= upset watch ================= */
/* The same win chances, read from the underdog's side. A game is on the watch when LTF has a real favorite and the underdog
   still has a real chance: between 25% and 45%. Closer than that is a toss-up, which is no upset either way, and those are
   on the Picks page as closest calls. "Alert" is a team in the LTF top 25 in that spot against a team from outside it.
   "Calls" are games where LTF picks against the AP poll, which is here only to compare against. */
const UPSET = {lo:.25, hi:.45};
/* The table of underdogs can be narrowed to a range of chances. The ranges are the ones graded on past seasons, so each
   comes with how often underdogs like these have won. The default is the live range above. */
const UPSET_BANDS = [['', 'Live, 25 to 45%', .25, .45], ['40', '40 to 50%', .40, .5001], ['30', '30 to 40%', .30, .40], ['20', '20 to 30%', .20, .30], ['10', '10 to 20%', .10, .20], ['0', 'Under 10%', 0, .10], ['all', 'Every underdog', 0, .5001]];
function upsetWatch(wk){
  const games = wk == null ? [] : openGames(wk).filter(x => x.pr).map(x => {
    const h = byName[x.g.h], a = byName[x.g.a], fav = x.pr.m >= 0 ? h : a, dog = fav === h ? a : h, pFav = Math.max(x.pr.pHome, 1 - x.pr.pHome);
    return {g: x.g, pr: x.pr, fav, dog, pDog: 1 - pFav};
  });
  const live = games.filter(q => q.pDog >= UPSET.lo && q.pDog < UPSET.hi).sort((p, q) => q.pDog - p.pDog);
  const alert = live.filter(q => q.fav.rank <= 25 && q.dog.rank > 25);
  const apOf = t => t.d.apr || 99;
  const calls = M.apWeek == null ? [] : games.filter(q => apOf(q.dog) < apOf(q.fav)).sort((p, q) => apOf(p.dog) - apOf(q.dog));      // LTF picks the team the AP has lower
  return {games, live, alert, calls};
}
const upsetSite = q => q.g.n ? 'against' : q.dog.n === q.g.h ? 'at home against' : 'at';
const upsetLi = q => `<li class="two"><span><span class="l1"><span class="who">${badge(q.dog,'sm')} <a class="tlink" href="${gameL(q.g)}">${esc(q.dog.n)} ${upsetSite(q)} ${esc(q.fav.n)}</a></span><span class="meta"><b class="cnum">${Math.round(q.pDog*100)}%</b></span></span>
  <span class="sub2">No. ${q.dog.rank} ${esc(q.dog.n)} (${q.dog.w}-${q.dog.l}) ${upsetSite(q)} No. ${q.fav.rank} ${esc(q.fav.n)} (${q.fav.w}-${q.fav.l}), ${fmtDay(q.g.d)}. LTF line: ${lineTxt(q.pr)}.</span></span></li>`;
function viewUpsets(){
  const fut = FUTURE();
  if (!fut.length) return {title:'Upset watch', top: pageTop('Upset watch', 'The regular season is over, so there are no upsets left to watch for.'), body:`<p class="next"><a class="txt" href="${L('recap')}">See the upsets that happened</a></p>`};
  const wk = fut.includes(+R.q.week) ? +R.q.week : M.next, uw = upsetWatch(wk), q = findText();
  const scope = arr => arr.filter(u => [u.fav, u.dog].some(inGroup) && (!q || u.fav.n.toLowerCase().includes(q) || u.dog.n.toLowerCase().includes(q)));
  const byChance = R.q.sort === 'chance', alert = scope(uw.alert), calls = scope(uw.calls), top = alert[0] || scope(uw.live)[0];
  const band = UPSET_BANDS.find(b => b[0] === (R.q.chance || '')) || UPSET_BANDS[0], inBand = scope(uw.games.filter(u => u.pDog >= band[2] && u.pDog < band[3])).sort((p, q2) => q2.pDog - p.pDog);
  const live = byChance ? inBand : [...inBand].sort((p, q2) => p.fav.rank - q2.fav.rank);      // the best-ranked favorites first, since those are the upsets people talk about
  const hist = (BT.dog || []).find(b => band[0] !== '' && band[0] !== 'all' && b.lo === Math.round(band[2]*100));
  const ap = t => t.d.apr ? `AP No. ${t.d.apr}` : 'unranked by the AP';
  const callLi = u => `<li class="two"><span><span class="l1"><span class="who">${badge(u.fav,'sm')} <a class="tlink" href="${gameL(u.g)}">${esc(u.fav.n)} over ${esc(u.dog.n)}</a></span><span class="meta"><b class="cnum">${Math.round((1-u.pDog)*100)}%</b></span></span>
    <span class="sub2">LTF has ${esc(u.fav.n)} by ${u.pr.pts}${u.g.n ? ' at a neutral site' : u.fav.n === u.g.h ? ' at home' : ' on the road'}. They are ${ap(u.fav)}, and ${esc(u.dog.n)} is ${ap(u.dog)}. LTF ranks them No. ${u.fav.rank} and No. ${u.dog.rank}.</span></span></li>`;
  const dog = (BT.dog || []), dogRows = dog.map(b => `<tr><td class="cn">${b.lo ? `${b.lo} to ${b.hi}%` : `Under ${b.hi}%`}</td><td class="num">${f1(b.act)}%</td><td class="num wide">${f1(b.pred)}%</td><td class="num">${b.n.toLocaleString()}</td></tr>`).join('');
  const rows = live.map(u => { const c = Math.round(u.pDog*100);
    return `<tr><td class="wide">${fmtDay(u.g.d)}</td><td class="wrap2"><a class="teambtn" href="${gameL(u.g)}"><span>${badge(u.dog,'sm')} <span class="tn">${esc(u.dog.n)}</span> <span class="cf">${u.dog.rank}</span> <span class="cf">${upsetSite(u)}</span> ${esc(u.fav.n)} <span class="cf">${u.fav.rank}</span></span></a></td>
      <td class="num wide">${u.dog.w}-${u.dog.l}</td><td class="num wide">${u.fav.w}-${u.fav.l}</td><td class="wide">${lineTxt(u.pr, true)}</td><td><span class="pbar"><i style="width:${c*2}%"></i></span><b>${c}%</b></td></tr>`; }).join('');
  const lead = top ? `${alert.length ? `Most at risk in the top 25: No. ${top.fav.rank} ${tl(top.fav)}, with ${tl(top.dog)} given ${aPct(Math.round(top.pDog*100))} chance to beat them.` : `Best chance for an underdog: ${tl(top.dog)}, ${Math.round(top.pDog*100)}% ${upsetSite(top)} ${tl(top.fav)}.`} ${live.length} ${live.length === 1 ? 'underdog is' : 'underdogs are'} on the watch in week ${wk}.` : '';
  return {title:`Week ${wk} upset watch`, controls:true, lead,
    top: pageTop('Upset watch', `<b>Week ${wk}, ${groupKey()==='all' ? 'every game' : esc(groupLabel())}.</b> Where an upset is most likely, by the LTF line. The favorite and the underdog here are LTF's own, worked out from this season's games. A team's chance is how often they would win this game if it were played many times.`),
    body: weekTabs(fut, wk, M.next, w => w === M.next ? 'Next' : 'Ahead') + `<div class="panels">
      <section class="panel"><h2>Top 25 teams on upset alert</h2><p class="hint">LTF top 25 teams favored over a team from outside it, with the underdog given a real chance. The number is the underdog's chance.</p>${alert.length ? `<ol class="rows">${alert.slice(0,8).map(upsetLi).join('')}</ol>` : '<p class="hint">None this week. No top 25 team is in real danger against a team from outside it.</p>'}</section>
      ${M.apWeek != null ? `<section class="panel"><h2>Where LTF picks against the poll</h2><p class="hint">Games where LTF favors the team the AP poll has lower. The number is the chance the LTF pick wins. The poll is here only to compare against.</p>${calls.length ? `<ol class="rows">${calls.slice(0,8).map(callLi).join('')}</ol>` : '<p class="hint">None this week. LTF and the AP poll favor the same team in every game between ranked teams.</p>'}</section>` : ''}
    </div>
    <section class="sec"><h2>${band[0] === '' ? 'Every live underdog' : band[0] === 'all' ? 'Every underdog' : `Underdogs with ${band[0] === '0' ? 'under a 10%' : `a ${band[1]}`} chance`}</h2>
      <div class="seg wrap" role="group" aria-label="Chance to win">${UPSET_BANDS.map(b => `<a data-keep href="${Lq({chance: b[0] || null})}" aria-current="${b === band}">${b[1]}</a>`).join('')}</div>
      <p class="hint">${band[0] === '' ? `Underdogs LTF gives between ${Math.round(UPSET.lo*100)}% and ${Math.round(UPSET.hi*100)}%. Anything closer is a toss-up and sits with the <a class="txt" href="${L('picks', null, {week: wk === M.next ? null : wk})}">closest calls</a>.` : band[0] === 'all' ? 'Every game this week, from the underdog\'s side.' : `${live.length} ${live.length === 1 ? 'underdog' : 'underdogs'} in this range in week ${wk}.${hist ? ` In past seasons, underdogs LTF put in this range won ${f1(hist.act)}% of the time, across ${hist.n.toLocaleString()} games.` : ''}`} Pick a range to narrow the list. The small numbers are LTF ranks.</p>
      <div class="seg" role="group" aria-label="Order"><a data-keep href="${Lq({sort:null})}" aria-current="${!byChance}">Best favorites first</a><a data-keep href="${Lq({sort:'chance'})}" aria-current="${byChance}">Best chance first</a></div>
      <div class="scroll"><table class="grid wk"><thead><tr>${th('Date','wide')}${th('Underdog and favorite')}${th('Underdog','num wide','rec')}${th('Favorite','num wide','rec')}${th('LTF line','wide','line')}${th('Underdog wins','','wc')}</tr></thead><tbody>${rows || `<tr><td class="empty" colspan="6">${band[0] === '' ? 'No underdog is on the watch in these games.' : 'No underdog falls in this range in these games.'}</td></tr>`}</tbody></table></div></section>
    ${dogRows ? `<section class="sec"><h2>How often underdogs win</h2><p class="hint">The LTF Index rebuilt week by week for ${BT.seasons}, ${BT.games.toLocaleString()} games. When LTF gave an underdog a chance in the range on the left, this is how often they won.</p>
      <div class="scroll"><table class="grid"><thead><tr><th>Chance LTF gave the underdog</th><th class="num">Underdog won</th><th class="num wide">Average chance given</th><th class="num">Games</th></tr></thead><tbody>${dogRows}</tbody></table></div>
      <p class="hint after">About ${dog[0] ? Math.round(dog[0].act) : 45} of every 100 near coin-flip underdogs win, so picking a few of them is not reckless. An underdog under 20% is a long shot, and most weeks one of those wins anyway.</p></section>` : ''}
    <p class="next"><a class="txt" href="${L('picks', null, {week: wk === M.next ? null : wk})}">All week ${wk} picks</a> &nbsp; <a class="txt" href="${L('recap')}">Last week's upsets</a></p>`};
}

/* ================= weekly recap ================= */
function viewRecap(){
  const weeks = HW.map(w => w+1).filter(w => w <= M.through);
  const wk = weeks.includes(+R.q.week) ? +R.q.week : weeks[weeks.length-1];
  if (!wk) return {title:'Weekly recap', top: pageTop('Weekly recap', 'How LTF did on last week\'s games.'), body:'<p class="empty">The recap starts once LTF has had a line on a full week of games.</p>'};
  const seg = `<div class="seg" role="group" aria-label="Week">${weeks.map(w => `<a data-keep href="${Lq({week: w===weeks[weeks.length-1] ? null : w})}" aria-current="${w===wk}">Week ${w}</a>`).join('')}</div>`;
  const tr = trackRecord().rows.filter(r => r.g.w === wk);
  const li = (g, right, sub) => `<li class="two"><span><span class="l1"><a class="tlink" href="${gameL(g)}">${finalTxt(g)}</a><span class="meta">${right}</span></span><span class="sub2">${sub}</span></span></li>`;
  const withP = tr.map(r => { const hw = r.act > 0, p = hw ? r.x.pHome : 1-r.x.pHome; return {...r, p, win: hw ? r.g.h : r.g.a}; });
  const upsets = withP.filter(r => r.p < .3).sort((a,b) => a.p-b.p);
  const ups = upsets.slice(0,8).map(r => li(r.g, `${Math.round(r.p*100)}% chance`, `The LTF line was ${lineTxt(r.x)} before kickoff. ${esc(r.win)} won by ${Math.abs(r.act)}.`)).join('');
  const best = [...tr].filter(r => r.right === true).sort((a,b) => a.ei-b.ei).slice(0,5).map(r => li(r.g, `off by ${r.ei.toFixed(1)}`, `LTF line: ${lineTxt(r.x)}.`)).join('');
  const worst = [...tr].sort((a,b) => b.ei-a.ei).slice(0,5).map(r => li(r.g, `off by ${r.ei.toFixed(1)}`, `LTF line: ${lineTxt(r.x)}.`)).join('');
  const rows = [...tr].sort((x,y) => y.ei-x.ei).map(r => { const g = r.g;
    return `<tr><td class="wrap2"><a class="tlink" href="${gameL(g)}">${finalTxt(g)}</a></td><td>${lineTxt(r.x, true)}</td>
      <td class="res ${r.right ? 'up' : 'down'}">${callTxt(r)}</td><td class="num">${r.ei.toFixed(1)}</td></tr>`; }).join('');
  const mi = tr.length ? mean(tr.map(r => r.ei)) : 0;
  const wl2 = scoreTally(scoreRows().filter(r => r.g.w === wk)).ltf;
  return {title:`Week ${wk} recap`, card:'receipts:' + wk,
    lead: wl2.w + wl2.l ? `LTF picked ${wl2.w} of ${wl2.w + wl2.l} winners in week ${wk} and missed the margin by ${wl2.avg.toFixed(1)} points a game.${upsets.length ? ` The biggest upset: ${esc(upsets[0].win)}, given ${aPct(Math.round(upsets[0].p*100))} chance.` : ''}` : '',
    top: pageTop(`Week ${wk} recap`, `How LTF did on week ${wk}, in every game between two FBS teams. Every line here was set before kickoff, from earlier games only.`),
    body: seg + `<div class="facts">${fact('Winners picked', `${wl2.w} of ${wl2.w + wl2.l}`, `${wl2.w + wl2.l ? Math.round(100*wl2.w/(wl2.w + wl2.l)) : 0}%. Past seasons average ${f1(BT.su)}%`)}
      ${fact('Average miss', (wl2.avg ?? mi).toFixed(1) + ' points', `Past seasons average ${f1(BT.miss)}`)}
      ${fact('Upsets', upsets.length, 'winners LTF gave under 30%')}
      ${fact('Games graded', tr.length, 'every game with an LTF line')}</div>
    <div class="panels">
      <section class="panel"><h2>Upsets of the week</h2><p class="hint">Winners LTF gave less than a 30% chance.</p>${ups ? `<ol class="rows">${ups}</ol>` : '<p class="hint">None. Every winner had at least a 30% chance.</p>'}</section>
      <section class="panel"><h2>Worst misses</h2><p class="hint">Where the LTF line was furthest from the final margin.</p>${worst ? `<ol class="rows">${worst}</ol>` : '<p class="hint">No games with an LTF line this week.</p>'}</section>
      <section class="panel full"><h2>Best calls</h2><p class="hint">Right winner, and the LTF line closest to the final margin.</p>${best ? `<ol class="rows">${best}</ol>` : '<p class="hint">None this week.</p>'}</section>
    </div>
    <section class="sec"><h2>Every game with a line</h2><div class="scroll"><table class="grid"><thead><tr>${th('Final')}${th('LTF line','','line')}${th('Winner call')}${th('LTF miss','num')}</tr></thead><tbody>${rows || '<tr><td class="empty" colspan="4">No games had an LTF line.</td></tr>'}</tbody></table></div>
    <p class="next"><a class="txt" href="${L('track')}">Season-long track record</a> &nbsp; <a class="txt" href="${L('games', null, {week:wk})}">All week ${wk} scores</a> &nbsp; <a class="txt" href="${L('scorecard')}">Scorecard</a></p></section>`};
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
  const likely = T.filter(inGroup).sort((x, y) => now[y.n].po - now[x.n].po || y.cz - x.cz).slice(0, 3);
  const lead = likely.length ? `Most likely to make the playoff${groupKey() === 'all' ? '' : ` from the ${esc(groupLabel())}`}: ${list(likely.map(t => `${tl(t)} ${pct(now[t.n].po)}`))}.` : '';
  return {title:'Season odds', controls:true, lead, top: pageTop('Season odds', `<b>${groupLabel()}.</b> The rest of the season played out ${SIMS.toLocaleString()} times from the current LTF Index. Each run gives every team a slightly different true strength, plays every remaining game, holds conference title games, and picks a 12-team playoff field.`),
    body: seg + table + `<div class="note"><p>These are estimates from LTF, not forecasts from the selection committee. Conference title games are assumed to match the top two teams by conference record, and the playoff field is picked by LTF Index after each simulated season. LTF forgives a loss more easily than the committee does, so the top teams' playoff chances here run high. Win totals count regular-season games only.</p></div>
    <p class="next"><a class="txt" href="${L('playoff')}">The playoff bracket if the season ended today</a></p>`};
}
