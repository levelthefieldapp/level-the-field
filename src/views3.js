/* ================= playoff ================= */
function playoffField(){
  const br = byRank();
  const autos = CONFS.filter(c => c.tier==='P4').sort((a,b) => a.sorted[0].rank-b.sorted[0].rank).map(c => ({t:c.sorted[0], why:`${c.name} leader`, auto:true}));
  const g6 = br.find(t => t.tier==='G6' && t.c !== 'Independent');
  autos.push({t:g6, why:`Top Group of 6 team`, auto:true});
  const nd = byName['Notre Dame'];
  if (nd && nd.rank <= 12) autos.push({t:nd, why:'Notre Dame, inside the top 12', auto:true});
  const field = new Map(autos.map(a => [a.t, a]));
  for (const t of br){ if (field.size >= 12) break; if (!field.has(t)) field.set(t, {t, why:'At-large', auto:false}); }
  const seeds = [...field.values()].sort((x,y) => x.t.rank-y.t.rank);       // automatic bids outside the top 12 fall to the bottom on their own
  seeds.forEach((s,i) => { s.seed = i+1; });
  return {seeds, out: br.filter(t => !field.has(t)).slice(0,4)};
}
function bracketOdds(seeds){   // every team's chance to get through each round, from the LTF line for every matchup it could face
  const S = n => seeds[n-1], P = (a, b, home) => lineFor(a.t, b.t, home).pA;
  const first = [[8,9],[5,12],[7,10],[6,11]].map(([hi,lo]) => { const p = P(S(hi), S(lo), 1); return [[S(hi), p], [S(lo), 1-p]]; });
  const meet = (A, B) => { const out = new Map();
    for (const [a, pa] of A) for (const [b, pb] of B){ const p = P(a, b, 0); out.set(a, (out.get(a) || 0) + pa*pb*p); out.set(b, (out.get(b) || 0) + pa*pb*(1-p)); }
    return [...out.entries()].sort((x,y) => y[1]-x[1]); };
  const qf = [meet([[S(1),1]], first[0]), meet([[S(4),1]], first[1]), meet([[S(2),1]], first[2]), meet([[S(3),1]], first[3])];
  const sf = [meet(qf[0], qf[1]), meet(qf[2], qf[3])], ch = meet(sf[0], sf[1]);
  const get = (dists, s) => { for (const d of dists){ const e = d.find(x => x[0] === s); if (e) return e[1]; } return 0; };
  for (const s of seeds) s.adv = {r1: s.seed <= 4 ? 1 : get(first, s), qf: get(qf, s), sf: get(sf, s), ch: get([ch], s)};
  return {first, qf, sf, ch};
}
function viewPlayoff(){
  const {seeds, out} = playoffField(), S = n => seeds[n-1], sim = simulate(M.through), bo = bracketOdds(seeds);
  const dates = M.season === 2026 ? ['Dec. 18 and 19, at the higher seed', 'Dec. 30 and Jan. 1, at bowl sites', 'Jan. 14 and 15', 'Jan. 25 in Las Vegas'] : ['At the higher seed', 'At bowl sites', '', ''];
  const tm = (s, p, o = {}) => `<div class="tm${o.fav ? ' fav' : ''}${o.proj ? ' proj' : ''}"><span class="sd">${s.seed}</span>${badge(s.t,'sm')}<a href="${teamL(s.t)}">${esc(o.short ? s.t.ab : s.t.n)}</a><span class="pc">${pct(p)}</span></div>`;
  const slot = inner => `<div class="slot">${inner}</div>`;
  const r1 = [[8,9],[5,12],[7,10],[6,11]].map(([hi,lo]) => { const x = lineFor(S(hi).t, S(lo).t, 1);
    return slot(`<div class="m">${tm(S(hi), x.pA, {fav: x.pA >= .5})}${tm(S(lo), 1-x.pA, {fav: x.pA < .5})}<p class="mf">At ${esc(S(hi).t.ab)}. LTF line: <a class="txt" href="${L('compare', null, {a:S(hi).t.slug, b:S(lo).t.slug, site:'a'})}">${lineTxt(x, true)}</a></p></div>`); }).join('');
  const r2 = [[1,0],[4,1],[2,2],[3,3]].map(([bye, i]) => { const opp = bo.first[i].slice().sort((a,b) => b[1]-a[1])[0][0], a = S(bye), pa = a.adv.qf, pb = opp.adv.qf;
    return slot(`<div class="m">${tm(a, pa, {fav: pa >= pb})}${tm(opp, pb, {fav: pb > pa, proj:true})}<p class="mf">${esc(a.t.ab)} has a bye, then gets the ${bo.first[i][0][0].seed}-${bo.first[i][1][0].seed} winner</p></div>`); }).join('');
  const r3 = [[0,1],[2,3]].map(([i,j]) => { const a = bo.qf[i][0][0], b = bo.qf[j][0][0];
    return slot(`<div class="m">${tm(a, a.adv.sf, {fav: a.adv.sf >= b.adv.sf, proj:true})}${tm(b, b.adv.sf, {fav: b.adv.sf > a.adv.sf, proj:true})}<p class="mf">Most likely pairing</p></div>`); }).join('');
  const fa = bo.sf[0][0][0], fb = bo.sf[1][0][0], champ = bo.ch[0];
  const r4 = slot(`<div class="m">${tm(fa, fa.adv.ch, {fav: fa.adv.ch >= fb.adv.ch, proj:true})}${tm(fb, fb.adv.ch, {fav: fb.adv.ch > fa.adv.ch, proj:true})}<p class="mf">Most likely final</p></div>
      <div class="champ" style="--tc:${esc(champ[0].t.col)};--tf:${champ[0].t.fg}"><span>Most likely champion</span><b>${esc(champ[0].t.n)}</b><span>${pct(champ[1])} to win it all</span></div>`);
  const rd = (cls, title, when, inner) => `<div class="rd ${cls}"><h3>${title}<small>${when}</small></h3><div class="ms">${inner}</div></div>`;
  const bracket = `<div class="bkwrap"><div class="bk" role="group" aria-label="Playoff bracket">${rd('r1','First round',dates[0],r1)}${rd('r2','Quarterfinals',dates[1],r2)}${rd('r3','Semifinals',dates[2],r3)}${rd('r4','Championship',dates[3],r4)}</div></div>`;
  const seedRow = s => `<div class="seed"><span class="pr">${s.seed}</span>${badge(s.t)}<span>${tl(s.t)} ${mvTxt(s.t)}<small>${s.t.w}-${s.t.l}, No. ${s.t.rank}${s.t.prevRank != null && s.t.prevRank !== s.t.rank ? `, was ${s.t.prevRank}` : ''}. Makes the field in ${pct(sim[s.t.n].po)} of simulated seasons</small></span><span class="tag${s.auto?' o':''}">${s.seed<=4?'Bye. ':''}${esc(s.why)}</span></div>`;
  const orow = s => `<tr><td class="num rk">${s.seed}</td>${teamCell(s.t)}<td class="num wide">${s.t.rank}</td><td class="num wide">${lastWeek(s.t)}</td>
      <td class="num c pos" style="--t:${s.adv.r1.toFixed(2)}">${s.seed <= 4 ? 'Bye' : pct(s.adv.r1)}</td><td class="num c pos" style="--t:${s.adv.qf.toFixed(2)}">${pct(s.adv.qf)}</td><td class="num c pos wide" style="--t:${s.adv.sf.toFixed(2)}">${pct(s.adv.sf)}</td><td class="num c pos" style="--t:${Math.min(1, s.adv.ch*2).toFixed(2)}"><b>${pct(s.adv.ch)}</b></td></tr>`;
  return {title:'Playoff picture', top: pageTop('Playoff picture', `If the season ended after week ${M.through} and the committee went by the LTF Index, this would be the 12-team bracket.`),
    body: `<section class="sec"><h2>The bracket</h2><p class="hint">Seeds 5 through 12 play the first round on campus, and the top four seeds get a bye to the quarterfinals. Each percentage is that team's chance to win that round, from the LTF line for every opponent they could meet. Later rounds show the most likely teams. Scroll sideways on a phone.</p>${bracket}</section>
    <section class="sec"><h2>Chance to advance</h2>
      ${colKey([['Seed', 'Place in the bracket. The top four seeds get a first-round bye.'], ['First round, Quarterfinal, Semifinal', 'The chance the team wins that round.'], ['Title', 'The chance they win the national title from this bracket.']])}
      <div class="scroll"><table class="grid"><thead><tr>${th('Seed','num','seed')}${th('Team')}${th('LTF rank','num wide','ltfrank')}${th('Last week','num wide','lw')}${th('First round','num','adv')}${th('Quarterfinal','num','adv')}${th('Semifinal','num wide','adv')}${th('Title','num','adv')}</tr></thead><tbody>${seeds.map(orow).join('')}</tbody></table></div>
      <p class="hint after">These numbers assume this exact bracket. For each team's chance of making the playoff at all, see the <a class="txt" href="${L('odds')}">season odds</a>.</p></section>
    <section class="sec"><h2>The field</h2><p class="hint">Seeds follow the LTF ranking, with movement since last week. The top four get a first-round bye.</p><div class="seeds">${seeds.map(seedRow).join('')}</div></section>
    <section class="sec"><h2>First four out</h2><ol class="rows narrowlist">${out.map(t => rowB(t, t.rank, `${pct(sim[t.n].po)} playoff chance`)).join('')}</ol>
      <p class="next"><a class="txt" href="${L('odds')}">Playoff, conference and win-total odds for every team</a></p></section>
    <section class="sec prose"><h2>How this is put together</h2>
      <p>The ${M.season} playoff has 12 teams. The champions of the ACC, Big Ten, Big 12 and SEC get in automatically, along with the highest-ranked champion from the American, Conference USA, MAC, Mountain West, Pac-12 and Sun Belt. Notre Dame gets a spot if they finish in the top 12. The best remaining teams fill the rest.</p>
      <p>Seeds 5 through 12 play the first round at the higher seed's stadium. The 8-9 winner meets the No. 1 seed, the 5-12 winner meets No. 4, the 7-10 winner meets No. 2 and the 6-11 winner meets No. 3. First-round lines include home field. Every later round is treated as a neutral site.</p>
      <p>Conference champions are not decided yet, so this page uses each conference's highest-ranked team as a stand-in. The real field is picked by the selection committee, which does not use the LTF Index.</p></section>`};
}

/* ================= under the radar ================= */
function viewRadar(){
  const br = byRank();
  const bestWin = t => { const w = t.g.filter(g => g.pf>g.pa && byName[g.opp]).map(g => byName[g.opp]).sort((a,b) => a.rank-b.rank)[0]; return w ? `${tl(w)} <span class="cf">No. ${w.rank}</span>` : '–'; };
  const simple = (t, extra) => `<tr><td class="num rk">${t.rank}</td>${teamCell(t)}<td class="num wide">${lastWeek(t)}</td><td class="num">${t.w}-${t.l}</td><td class="num">${t.idx.toFixed(1)}</td>${extra}</tr>`;
  let ap = '';
  if (M.apWeek != null){
    const missing = br.filter(t => !t.d.apr && t.rank <= 40).slice(0,15);
    const liked = br.filter(t => t.d.apr && t.d.apr - t.rank >= 4).sort((a,b) => (b.d.apr-b.rank)-(a.d.apr-a.rank));
    const doubted = br.filter(t => t.d.apr && t.rank - t.d.apr >= 8).sort((a,b) => (b.rank-b.d.apr)-(a.rank-a.d.apr));
    const tbl = (rows, last, cell) => `<div class="scroll"><table class="grid"><thead><tr>${th('LTF rank','num','ltfrank')}${th('Team')}${th('Last week','num wide','lw')}${th('Record','num')}${th('LTF','num','index')}${th(last, last==='Best win'?'wide':'num', last==='AP rank'?'apr':null)}</tr></thead><tbody>${rows.map(t => simple(t, cell(t))).join('')}</tbody></table></div>`;
    ap = `<section class="sec"><h2>Teams the polls are missing</h2><p class="hint">The best teams by LTF that are outside the AP Top 25. The poll is used only for this comparison and has no part in the score.</p>${tbl(missing, 'Best win', t => `<td class="wide">${bestWin(t)}</td>`)}</section>
    ${liked.length ? `<section class="sec"><h2>Ranked by the AP, rated higher by LTF</h2>${tbl(liked, 'AP rank', t => `<td class="num">${t.d.apr}</td>`)}</section>` : ''}
    ${doubted.length ? `<section class="sec"><h2>Ranked by the AP, doubted by LTF</h2><p class="hint">Teams the AP has at least eight spots higher than LTF does.</p>${tbl(doubted, 'AP rank', t => `<td class="num">${t.d.apr}</td>`)}</section>` : ''}`;
  }
  const g6rows = br.filter(t => t.tier==='G6').slice(0,15).map((t,i) => `<tr><td class="num rk">${i+1}</td><td class="num nat">${t.rank}</td>${teamCell(t)}<td class="num wide">${lastWeek(t)}</td><td class="num">${t.w}-${t.l}</td><td class="num">${t.idx.toFixed(1)}</td><td class="num">${wl(t.g.filter(g => byName[g.opp] && byName[g.opp].tier==='P4'))}</td><td class="wide">${bestWin(t)}</td></tr>`).join('');
  return {title:'Under the radar', top: pageTop('Under the radar', `LTF does not know a team's reputation. It measures a Sun Belt team and an SEC team the same way, so this page collects the teams that get less attention than their play deserves.`),
    body: `${ap}
    <section class="sec"><h2>Group of 6 leaders</h2><p class="hint">The top Group of 6 teams, where they stand nationally, and how they have done against Power 4 opponents.</p>
      <div class="scroll"><table class="grid"><thead><tr>${th('Rank','num')}${th('National','num','nat')}${th('Team')}${th('Last week','num wide','lw')}${th('Record','num')}${th('LTF','num','index')}${th('Vs. Power 4','num')}${th('Best win','wide')}</tr></thead><tbody>${g6rows}</tbody></table></div>
      <p class="next"><a class="txt" href="${L('rankings', null, {group:'g6'})}">Full Group of 6 rankings</a> &nbsp; <a class="txt" href="${L('conferences')}">Conference strength</a> &nbsp; <a class="txt" href="${L('reputation')}">Reputation gap</a></p></section>`};
}

/* ================= spread ================= */
const fineShort = `<p class="hint fineprint">For information only. This is not betting advice. If gambling is a problem for you or someone you know, call 1-800-GAMBLER.</p>`;
function viewSpread(){
  const view = R.q.view === 'ats' ? 'ats' : 'lines', q = findText();
  const seg = `<div class="seg" role="group" aria-label="Which spread view"><a data-keep href="${Lq({view:null, sort:null, dir:null})}" aria-current="${view==='lines'}">Lines by week</a><a data-keep href="${Lq({view:'ats', sort:null, dir:null, week:null})}" aria-current="${view==='ats'}">Records against the spread</a><a href="${L('track')}">Track record</a></div>`;
  if (view === 'lines'){
    const fut = FUTURE(), wk = fut.includes(+R.q.week) ? +R.q.week : M.next;
    let games = wk == null ? [] : openGames(wk).filter(x => [x.g.h, x.g.a].some(n => byName[n] && inGroup(byName[n])));
    if (q) games = games.filter(x => x.g.h.toLowerCase().includes(q) || x.g.a.toLowerCase().includes(q));
    /* any column sorts. The first click puts the biggest number on top (soonest first for the date), a second click flips it,
       and games with nothing in that column always go to the bottom. */
    const SORTS = [['date','Kickoff'],['ltf','LTF line'],['market','Market line'],['gap','LTF Edge'],['conf','Confidence']];
    const key = SORTS.some(q => q[0] === R.q.sort) ? R.q.sort : 'date', asc = R.q.dir === 'asc';
    const rows = games.map(x => ({x, g:x.g, e:edgeOf(x.g), c:confidence(x.g), t:+new Date(x.g.d) || 0}));
    const val = r => key === 'ltf' ? (r.x.pr ? r.x.pr.pts : null) : key === 'market' ? (r.g.hs == null ? null : Math.abs(r.g.hs)) : key === 'gap' ? (r.e ? Math.abs(r.e.gap) : null) : key === 'conf' ? (r.c ? r.c.p : null) : null;
    if (key === 'date') rows.sort((a,b) => (asc ? b.t - a.t : a.t - b.t));
    else rows.sort((a,b) => { const va = val(a), vb = val(b); return (va == null) - (vb == null) || (va == null ? 0 : asc ? va - vb : vb - va) || a.t - b.t; });
    const sortL = k => Lq({sort: k === 'date' ? null : k, dir: key === k && !asc ? 'asc' : null});
    const sortWord = k => k === 'date' ? (asc ? 'latest first' : 'soonest first') : k === 'ltf' || k === 'market' ? (asc ? 'closest games first' : 'biggest favorites first') : k === 'gap' ? (asc ? 'smallest first' : 'biggest first') : (asc ? 'lowest first' : 'highest first');
    const nm = n => `<span class="nw">${byName[n] ? `${badge(byName[n],'sm')} ${esc(n)} <span class="cf">${byName[n].rank}</span>` : `${esc(n)} <span class="cf">FCS</span>`}</span>`;
    const body = rows.map(({x, g, e, c}) => {
      return `<tr><td class="wide">${fmtDay(g.d)}</td><td class="wrap2"><a class="teambtn" href="${gameL(g)}"><span>${nm(g.a)} <span class="cf">${g.n?'vs':'at'}</span> ${nm(g.h)}<span class="cf nblock">${fmtDay(g.d)}. LTF line: ${x.pr ? lineTxt(x.pr) : 'none, FCS opponent'}. Market: ${marketTxt(g) ?? 'none posted'}.${c ? ` Confidence: ${c.score}, ${c.label.toLowerCase()}.` : ''}</span></span></a></td>
        <td class="wide">${x.pr ? lineTxt(x.pr) : '<span class="cf">FCS opponent</span>'}</td><td class="wide">${marketTxt(g) ?? '<span class="cf">None posted</span>'}</td>
        <td class="wrap2">${edgeTxt(e)}</td>
        <td class="wide">${confCell(c)}</td></tr>`; }).join('');
    const thg = (k, label, cls, tk) => `<th class="${cls||''}"${key === k ? ` aria-sort="${(k === 'date') !== asc ? 'ascending' : 'descending'}"` : ''}><a data-keep href="${sortL(k)}"${tk ? ` data-tip="${tk}"` : ''}>${label}</a></th>`;
    const sortRow = `<div class="sortrow" role="group" aria-label="Sort the games"><span>Sort by</span>${SORTS.map(([k, label]) => `<a data-keep href="${sortL(k)}" aria-current="${key === k}">${label}</a>`).join('')}</div>`;
    return {title:'Spread', controls:true, top: pageTop('Spread', `<b>Week ${wk}, ${groupKey()==='all' ? 'every game' : esc(groupLabel())}.</b> ${wk === M.next ? `The LTF line next to the ${esc(M.book)} line${M.pulled ? ` as of ${esc(M.pulled)}` : ''}.` : 'The LTF line for every game, with the market line where an early one is posted.'} Select a game for the full matchup, or a column heading to sort by it. Select the same heading again to flip the order.${key === 'date' && !asc ? '' : ` <b>Sorted by ${lc(SORTS.find(q => q[0] === key)[1])}, ${sortWord(key)}.</b>`}`),
      body: seg + weekTabs(fut, wk, M.next, w => w === M.next ? 'Next' : 'Ahead') + colKey([['LTF line', 'How many points better LTF thinks one team is, home field included.', true], ['Market line', 'The sportsbook point spread.', true], ['LTF Edge', 'The team LTF rates higher than the market does, and by how many points.'], ['Confidence', 'The chance the LTF pick wins, out of 100.', true]])
        + sortRow + `<div class="scroll"><table class="grid wk"><thead><tr>${thg('date','Date','wide')}${th('Game')}${thg('ltf','LTF line','wide','line')}${thg('market','Market line','wide','market')}${thg('gap','LTF Edge','','lean')}${thg('conf','Confidence','wide','conf')}</tr></thead><tbody>${body || emptyRow(6,'game')}</tbody></table></div>` + fineShort};
  }
  const s = sortState('avg');
  let rows = T.filter(inGroup);
  const split = o => o && o.n ? (o.w - o.l) + o.w/100 : null;     // a record as one number: games over .500, then wins
  const val = t => { const a = t.ats; return s.key==='avg' ? a.avg : s.key==='pct' ? (a.pct == null ? null : a.pct + (a.avg ?? 0)/1000) : s.key==='idx' ? t.cz : s.key==='rec' ? split(a.all)
    : s.key==='fav' ? split(a.fav) : s.key==='dog' ? split(a.dog) : s.key==='home' ? split(a.home) : s.key==='away' ? split(a.away) : s.key==='ou' ? (a.o + a.u + a.op ? (a.o - a.u) + a.o/100 : null) : 0; };
  if (s.key==='team') rows.sort((a,b) => s.dir*-1*a.n.localeCompare(b.n));
  else rows.sort((a,b) => { const va = val(a), vb = val(b); return (va == null) - (vb == null) || (va == null ? 0 : s.dir*(va - vb)) || a.rank - b.rank; });      // teams with no games in that split go last
  if (q) rows = rows.filter(t => t.n.toLowerCase().includes(q));
  const head = `<tr>${sortTh('team','Team','','avg')}${sortTh('idx','LTF rank','num wide','avg','ltfrank')}${sortTh('rec','Record','num','avg','ats')}${sortTh('pct','Cover rate','num','avg','cover')}${sortTh('avg','Avg. cover margin','','avg')}
    ${sortTh('fav','Favorite','num wide','avg')}${sortTh('dog','Underdog','num wide','avg')}${sortTh('home','Home','num wide','avg')}${sortTh('away','Away','num wide','avg')}${sortTh('ou','Over-under','num wide','avg')}</tr>`;
  const body = rows.map(t => { const a = t.ats, w = a.avg==null ? 0 : clamp(Math.abs(a.avg)/20,0,1)*50;
    return `<tr>${teamCell(t)}<td class="num wide">${t.rank}</td><td class="num">${recStr(a.all)}</td><td class="num">${a.pct==null?'–':Math.round(a.pct*100)+'%'}</td>
      <td><b class="avgm ${a.avg>0?'up':a.avg<0?'down':''}">${a.avg==null?'–':(a.avg>0?'+':a.avg<0?'−':'')+Math.abs(a.avg).toFixed(1)}</b><span class="zbar abar ${a.avg>=0?'pos':'neg'}"><i style="width:${w.toFixed(1)}%"></i></span></td>
      <td class="num wide">${recStr(a.fav)}</td><td class="num wide">${recStr(a.dog)}</td><td class="num wide">${recStr(a.home)}</td><td class="num wide">${recStr(a.away)}</td>
      <td class="num wide">${a.o+a.u+a.op ? `${a.o}-${a.u}${a.op?'-'+a.op:''}` : '–'}</td></tr>`; }).join('');
  return {title:'Records against the spread', controls:true, top: pageTop('Spread', `<b>${groupLabel()}.</b> How each team has done against the ${esc(M.book)} pregame line. Cover margin is the final margin plus the spread, so a 7-point favorite that wins by 10 covered by 3. Select any column heading to sort by it.`),
    body: seg + `<div class="note"><p>Each team has played four to six games. A 4-1 record against the spread is well within what coin flips produce, so read this as what has happened, not what will.</p></div>
      ${colKey([['Record', 'Times the team covered, times they did not, then pushes.'], ['Cover rate', 'The share of games they covered.'], ['Avg. cover margin', 'How many points they have beaten the spread by, on average.'], ['Favorite, Underdog, Home, Away', 'The same record, split by situation.', true], ['Over-under', 'Games that went over the total, then under.', true]])}
      <div class="scroll"><table class="grid"><thead>${head}</thead><tbody>${body || emptyRow(10,'team')}</tbody></table></div>` + fineShort};
}

/* ================= track record ================= */
function calibration(){
  const c = BT.cal; if (!c || !c.length) return '';
  const Wd = 560, H = 300, pl = 44, pr = 16, pt = 14, pb = 40, X = v => pl + (v-50)/50*(Wd-pl-pr), Y = v => H-pb - (v-50)/50*(H-pt-pb);
  const grid = [50,60,70,80,90,100].map(v => `<line class="gl" x1="${X(50)}" y1="${Y(v)}" x2="${X(100)}" y2="${Y(v)}"/><text x="${X(50)-8}" y="${Y(v)+4}" text-anchor="end">${v}%</text><text x="${X(v)}" y="${H-pb+16}" text-anchor="middle">${v}%</text>`).join('');
  const pts = c.map(b => `<circle cx="${X(b.pred).toFixed(1)}" cy="${Y(clamp(b.act,50,100)).toFixed(1)}" r="${(4 + Math.sqrt(b.n)/5).toFixed(1)}" fill="var(--pylon)" opacity=".9"><title>LTF said ${b.pred}%. Won ${b.act}% of ${b.n} games.</title></circle>`).join('');
  const rows = BT.conf.map(b => `<tr><td class="cn">${b.label}</td><td class="num">${b.lo} to ${b.hi}%</td><td class="num">${b.act}%</td><td class="num">${b.n.toLocaleString()}</td></tr>`).join('');
  const ats = BT.ats.map(b => `<tr><td class="cn">${b.hi >= 100 ? `${b.lo} points or more` : `${b.lo} to ${b.hi} points`}</td><td class="num">${b.hit}%</td><td class="num">${b.n.toLocaleString()}</td></tr>`).join('');
  const cf = (CFD.cal || []).map(b => `<tr><td class="cn">${b.lo === 0 ? `Under ${b.hi}` : b.hi === 100 ? `${b.lo} and up` : `${b.lo} to ${b.hi}`}</td><td class="num">${b.conf.toFixed(0)}</td><td class="num">${b.act}%</td><td class="num">${b.n.toLocaleString()}</td></tr>`).join('');
  return `<section class="sec"><h2>Five past seasons</h2><p class="hint">The same LTF Index, rebuilt week by week for ${BT.seasons}, picking the next week's games: ${BT.games.toLocaleString()} in all.</p>
    <div class="facts">${fact('Winners picked', BT.su + '%', `The market picked ${BT.mktSu}%`)}${fact('Average miss', BT.miss + ' points', `The market missed by ${BT.mktMiss}`)}
      ${fact('LTF side against the spread', BT.atsAll + '%', `${BT.atsN.toLocaleString()} games. A coin flip`)}</div>
    <div class="dgrid"><div><h3>When LTF says 70%, does that team win 70%?</h3><div class="plot static"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Win chance LTF gave against how often that team won. The points sit close to the diagonal.">
      ${grid}<line class="mid" x1="${X(50)}" y1="${Y(50)}" x2="${X(100)}" y2="${Y(100)}"/>${pts}
      <text x="${(X(50)+X(100))/2}" y="${H-6}" text-anchor="middle">Win chance LTF gave the favorite</text></svg></div>
      <p class="hint after">Each dot is a group of past games. Dots on the dashed line mean the win chances were honest. Bigger dots hold more games.</p>
      <h3>How far ahead can it see?</h3><div class="scroll"><table class="grid"><thead><tr><th>Pick made</th><th class="num">LTF favorite won</th><th class="num">Games</th></tr></thead><tbody>${(CFD.hz || []).map(h => `<tr><td class="cn">${h.lab.charAt(0).toUpperCase() + h.lab.slice(1)}</td><td class="num">${h.act}%</td><td class="num">${h.n.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint after">Picks for games far down the schedule held up almost as well as picks for next week.</p></div>
    <div><h3>Does the confidence score hold up?</h3><div class="scroll"><table class="grid"><thead><tr><th>Confidence</th><th class="num">Average score</th><th class="num">Pick won</th><th class="num">Games</th></tr></thead><tbody>${cf}</tbody></table></div>
      <p class="hint after">These are games that had a market line. A pick with a confidence near 65 won about 65% of the time. Scores under 50 are picks where the market favored the other team, and they lost more often than they won.</p>
      <h3>Win chance from the LTF line alone</h3><div class="scroll"><table class="grid"><thead><tr><th>Label</th><th class="num">Win chance</th><th class="num">Favorite won</th><th class="num">Games</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h3>The LTF Edge against the spread</h3><div class="scroll"><table class="grid"><thead><tr><th>Size of the edge</th><th class="num">LTF side covered</th><th class="num">Games</th></tr></thead><tbody>${ats}</tbody></table></div>
      <p class="hint after">With standard pricing a bettor needs about 52.4% to break even. The largest edges are a small sample, so do not rely on them.</p></div></div></section>`;
}
function viewTrack(){
  const tr = trackRecord(), a = tr.all, dec = a.w + a.l;
  if (!a.n) return {title:'LTF track record', top: pageTop('LTF track record', 'How the LTF line has done against the market and the final score.'), body:'<p class="empty">There are no finished games with both an LTF line and a market line yet.</p>'};
  const mx = Math.max(...tr.weeks.flatMap(x => [x.ai, x.am]), 1);
  const bar = (v, cls) => `<span class="tr"><i class="${cls}" style="width:${(v/mx*100).toFixed(1)}%"></i></span>`;
  const chart = `<div class="bars nomid" role="img" aria-label="Average miss by week, LTF and market">${tr.weeks.map(x => `<div class="br"><a href="${L('games', null, {week:x.wk})}">Week ${x.wk}, LTF</a>${bar(x.ai,'g6')}<span class="num">${x.ai.toFixed(1)}</span></div><div class="br"><span class="mutedl">Week ${x.wk}, market</span>${bar(x.am,'')}<span class="num">${x.am.toFixed(1)}</span></div>`).join('')}</div>`;
  const wrows = tr.weeks.map(x => `<tr><td class="cn"><a class="tlink" href="${L('games', null, {week:x.wk})}">Week ${x.wk}</a></td><td class="num">${x.n}</td><td class="num">${x.w}-${x.l}${x.p?'-'+x.p:''}</td><td class="num">${x.ai.toFixed(1)}</td><td class="num">${x.am.toFixed(1)}</td></tr>`).join('');
  const rows = [...tr.rows].sort((x,y) => y.g.w-x.g.w || Math.abs(y.mi-y.mm)-Math.abs(x.mi-x.mm)).map(r => { const g = r.g;
    return `<tr><td class="num">${g.w}</td><td class="wrap2"><a class="tlink" href="${gameL(g)}">${finalTxt(g)}</a></td><td class="wide">${lineTxt(r.x, true)}</td><td class="wide">${marketTxt(g, true)}</td>
      <td>${r.side ? esc(byName[r.side].ab) : '<span class="cf">Same</span>'}</td><td class="res ${r.right===true?'up':r.right===false?'down':''}">${r.right===true?'Right':r.right===false?'Wrong':'Push'}</td>
      <td class="num wide">${r.ei.toFixed(1)}</td><td class="num wide">${r.em.toFixed(1)}</td></tr>`; }).join('');
  return {title:'LTF track record', top: pageTop('LTF track record', `Every finished game where LTF had a line before kickoff. LTF is rebuilt for each week using only earlier games, so nothing here is graded with hindsight.`),
    body: `<div class="facts">${fact('LTF side against the spread', `${a.w}-${a.l}${a.p?'-'+a.p:''}`, `${dec ? Math.round(100*a.w/dec) : 0}% of ${dec} decided games`)}
      ${fact('LTF, average miss', a.ai.toFixed(1) + ' points', 'predicted margin against the real one')}
      ${fact('Market, average miss', a.am.toFixed(1) + ' points', a.am < a.ai ? 'the market has been closer' : 'LTF has been closer')}
      ${fact('Games graded', a.n, `weeks ${tr.weeks.map(x => x.wk).join(', ')}`)}</div>
    <div class="note"><p>${a.n} games is far too few to say LTF beats the line. Across five past seasons the market missed by about half a point less than LTF did, so treat a big LTF Edge as a sign LTF may be missing something, such as an injury.</p></div>
    ${calibration()}
    <section class="sec"><h2>Average miss by week</h2><p class="hint">Shorter is better. Orange is LTF, and the bar under it is the market.</p>${chart}</section>
    <section class="sec"><h2>Week by week</h2><div class="scroll"><table class="grid"><thead><tr><th>Week</th><th class="num">Games</th><th class="num">LTF side</th><th class="num">LTF miss</th><th class="num">Market miss</th></tr></thead><tbody>${wrows}</tbody></table></div>
    <p class="next"><a class="txt" href="${L('model')}">Model tracker: a separate prediction model, tested live against the market</a></p></section>
    <section class="sec"><h2>Every game this season</h2><p class="hint">"LTF side" is the team LTF rated higher than the market did. It is right when that team covered.</p>
      <div class="scroll"><table class="grid"><thead><tr>${th('Wk','num')}${th('Final')}${th('LTF line','wide','line')}${th('Market line','wide','market')}${th('LTF side','','lean')}${th('Result')}${th('LTF miss','num wide')}${th('Market miss','num wide')}</tr></thead><tbody>${rows}</tbody></table></div></section>
    ${fineShort}`};
}

/* ================= weights ================= */
function previewList(){
  return byRank().slice(0,15).map(t => { const mv = t.baseRank - t.rank;
    return `<li><span class="pr">${t.rank}</span><span>${tl(t)} <span class="cf">${t.w}-${t.l}</span></span><span class="num">${t.idx.toFixed(1)}</span><span class="mv ${mv>0?'up':mv<0?'down':''}">${mv>0?'up '+mv:mv<0?'down '+(-mv):''}</span></li>`; }).join('');
}
function viewWeights(){
  const sliders = COMP.map(c => `<div class="slider"><label for="w-${c.k}">${c.name}</label><output id="o-${c.k}">${share(c.k)}%</output>
    <input id="w-${c.k}" data-weight="${c.k}" type="range" min="0" max="60" step="1" value="${W[c.k]}"><p>${c.what}</p></div>`).join('');
  return {title:'Build your own rankings', top: pageTop('Build your own rankings', `The site starts on the ${term('ltf', 'Level the Field Index')}, or LTF Index for short. Move a slider and every page follows your version instead. The four parts always add up to 100%, and your settings ride along in the link so you can share them.`),
    body: `<p class="status" id="wstate">${customWeights() ? 'You are on <b>your own weights</b>.' : 'You are on the <b>LTF Index</b>.'}</p><div class="wgrid"><div>${sliders}<button class="btn" type="button" id="reset">Reset to the LTF Index</button></div>
    <div class="preview"><h3>Top 15 with these weights</h3><ol id="preview">${previewList()}</ol><p class="hint after">Up and down show movement against the LTF Index.</p></div></div>
    <p class="hint after">The LTF Index weights came from a test on five past seasons. <a class="txt" href="${L('how')}">How the weights were tested</a></p>`};
}

/* ================= how it works, about, contact ================= */
function viewHow(){
  const row = (a,b,c) => `<tr><td>${a}</td><td class="num">${b}</td><td>${c}</td></tr>`;
  const def = k => `<tr><td>${GLOSS[k][0]}</td><td>${GLOSS[k][1]}</td></tr>`;
  return {title:'How it works', top: pageTop('How it works', 'What goes into the LTF Index, how it was tested, and what each number means.'), body: `<div class="prose">
  <h2>One score, several views</h2>
  <p>LTF is short for Level the Field. Every one of the ${T.length} FBS teams gets a single national score, the LTF Index. The Power 4, Group of 6 and conference rankings are that same list filtered, so a Sun Belt team and an SEC team are always measured the same way. Notre Dame is grouped with the Power 4 and UConn with the Group of 6.</p>
  <p>The score blends what a team has accomplished with how well they have played. It runs from 0 to 100. An average FBS team is 50, and every 14 points is one standard deviation.</p>
  <h2>What goes into it</h2>
  <div class="tw"><table><thead><tr><th>Part</th><th class="num">Weight</th><th>What is inside, as shares of that part</th></tr></thead><tbody>
  ${row('Résumé',DEFAULTS.res+'%','Strength of record 65%: how hard this record would be for a typical top-25 team to match against the same opponents in the same stadiums. A hard schedule and a loss to a weak team are both already counted here. Quality wins 20%: wins over top-25 and top-50 teams, worth more on the road. Scoring margin 15%: adjusted for opponent and home field, capped at 24 points a game.')}
  ${row('Offense',DEFAULTS.off+'%','EPA per play 30%, success rate 25%, points per drive 20%, points per scoring opportunity 10%, explosive play rate 10%, yards per game 5%.')}
  ${row('Defense',DEFAULTS.def+'%','The same stats allowed: EPA per play 25%, success rate 20%, points per drive 20%, points per scoring opportunity 10%, explosive play rate 5%, yards per game 5%. Then stop rate 10% and havoc rate 5%.')}
  ${row('Computer ratings',DEFAULTS.cmp+'%',`${M.cmpSrc.join(', ')}. Each is converted to a standard score, then they are averaged.`)}
  </tbody></table></div>
  <p>These weights are the LTF Index. It is what the site shows unless you change it on the <a class="txt" href="${L('weights')}">Build your own rankings</a> page. The shares inside each part are fixed. Polls are not used. Special teams is shown on each team's page but is not part of the score.</p>
  <h2>What changed in the résumé</h2>
  <p>Until October 6, 2026 the résumé had two more pieces: losses, and strength of schedule. A test on ${BT.seasons} showed the losses piece was the win-loss record over again, and schedule strength was being counted twice, because strength of record already allows for who a team has played. With both in, a team could rank well on résumé for playing a hard schedule and losing. Taking them out left accuracy where it was, at ${BT.su}% of winners picked, and the résumé order now agrees with the win column more often. Every earlier week this season is shown under the new recipe, so week-to-week movement compares like with like.</p>
  <h2>How the weights were tested</h2>
  <p>The LTF Index weights come from a test on the 2021 through 2025 seasons. For each season the LTF Index was rebuilt as it stood after week 6, using only games played to that point, and then used to predict every later regular-season game that year, 2,177 games in all.</p>
  <div class="tw"><table><thead><tr><th>Weights: résumé, offense, defense, ratings</th><th class="num">Average miss</th><th>Winners picked</th></tr></thead><tbody>
  ${(BT.w6 ? BT.w6.rows : [{lab:'Résumé only', miss:14.0, su:65.8}, {lab:'60 / 15 / 15 / 10', miss:13.5, su:68.0}, {lab:'30 / 30 / 30 / 10', miss:13.2, su:69.7}, {lab:'20 / 25 / 25 / 30, the LTF Index', miss:13.1, su:70.8}, {lab:'Best fit the data could find, 10 / 25 / 20 / 45', miss:13.0, su:70.9}, {lab:'Betting line, for comparison', miss:12.3, su:71.9}])
    .map((q,i) => row(q.lab, q.miss.toFixed(1) + (i ? '' : ' points'), q.su.toFixed(1) + '%')).join('')}
  </tbody></table></div>
  <p>Average miss is how far the predicted margin was from the real one. Résumé was the weakest predictor of later games, and computer ratings earned a larger share because they remember how good a team was in earlier seasons. The test could only use Elo for that part, so the live version, which also averages SP+, FPI and SRS, likely does a little better.</p>
  <h2>The LTF line</h2>
  <p>For any two teams, the LTF line is the gap between their LTF Index scores converted to points, plus ${M.hfa} for the home team. The conversion comes from the same test: at this point in the season, one standard deviation of the index has been worth about ${SLOPE.toFixed(1)} points in later games. For finished games the site shows the line as it stood before kickoff, built only from earlier weeks. The <a class="txt" href="${L('track')}">track record</a> page grades those lines.</p>
  <p>Each game page splits the LTF line into points from résumé, offense, defense, computer ratings and home field. Those pieces add up to the line exactly. The written preview is built from the same numbers, so it always matches what LTF shows.</p>
  <h2>The LTF Edge</h2>
  <p>The LTF Edge is the gap between the LTF line and the market line, named for the team LTF rates higher. If the market has Ohio State by 34.5 and LTF has them by 21, the LTF Edge is Maryland +13.5. It is a difference of opinion and should be read that way. Across ${BT.seasons}, the LTF side beat the spread ${BT.ats.map(b => `${b.hit}% of the time on edges of ${b.hi >= 100 ? `${b.lo} points or more` : `${b.lo} to ${b.hi} points`}`).join(', ')}. Overall that was ${BT.atsAll}%, a coin flip.</p>
  <h2>The confidence score</h2>
  <p>Every pick for a game still to be played carries a confidence score from 1 to 99. It is the chance the LTF pick wins. A 50 is a coin flip.</p>
  <p>For games with no market line yet, the score is the win chance from the LTF line. That number has been honest: when LTF said 70%, that team won about 70% of the time, and picks made seven or more weeks ahead held up almost as well as picks for the next week.</p>
  <p>Once a market line is posted, the score blends the two lines in the proportion that fit past seasons best, and that blend leans heavily on the market. When both lines named the same winner, that team won ${CFD.mk.agree.act}% of the time. When the market favored the other team, the LTF pick won only ${CFD.mk.split.act}% of the time, so those picks score under 50 and are labeled contested.</p>
  <p>Under each score the site lists the reasons: where the line comes from, whether the market agrees, whether the pick depends on home field, whether either team has played too few FBS opponents to trust, and how steady the favorite has been.</p>
  <h2>Remaining schedules and season odds</h2>
  <p>The site plays out the rest of the season ${SIMS.toLocaleString()} times. Each run gives every team a slightly different true strength, since the index is never exactly right, then plays every remaining game. Conference title games match the top two teams by conference record. The playoff field is picked by LTF Index after each run, with each unexpected win or loss moving a team by the amount results have moved teams in past seasons. That amount is bigger early in the year, when one game is a large share of what is known, and about half as big by November.</p>
  <p>The <a class="txt" href="${L('playoff')}">playoff picture</a> seeds the 12-team bracket by LTF rank today, using each conference's top team as a stand-in for the champion, and works out each team's chance to get through every round.</p>
  <h2>Game scores and projected scores</h2>
  <p>A game score rates one performance on the same 0 to 100 scale, using the margin, the opponent's strength and where the game was played. A projected score splits the LTF line around a total built from each team's points per drive and pace. The total is a rough guide. In testing it was a little worse than the market total, so the site does not make over-under picks from it.</p>
  <h2>Luck, steadiness and the market's view</h2>
  <p>Luck adds up things that swing games but mostly do not repeat: fumble recoveries above or below half, interceptions compared with passes defended, and opponents' field goal kicking. Steadiness is how much a team's game scores swing from week to week. The market rating reads each team's strength back out of recent point spreads. None of the three is part of the LTF Index. They are there to explain results.</p>
  <h2>Momentum</h2>
  <p>The <a class="txt" href="${L('momentum')}">momentum</a> score runs from minus 10 to plus 10. It blends the change in a team's LTF Index over three weeks, how their last two games graded against the ones before, and recent results: the streak, upsets and covers. It is tracked for the story of the season and is not part of the LTF Index.${MOM ? ` The reason is a test on every FBS game from ${MOM.seasons}. Teams that had beaten the spread by 10 or more covered ${MOM.carry.hot}% of the time the next week, and teams that had missed by 10 or more covered ${MOM.carry.cold}%. Adding momentum to the LTF line moved it ${MOM.fix.gain.toFixed(2)} points closer to the final margin, which is nothing. LTF already rises when a team plays better, because the whole season is rescored every week. The one pattern that held is the reverse of momentum: the week after losing as a favorite of 7 or more, teams beat the LTF line by ${MOM.upL.ltf.toFixed(1)} points on average. Game pages flag that as a bounce-back spot.` : ''}</p>
  <h2>The scorecard</h2>
  <p>The <a class="txt" href="${L('scorecard')}">scorecard</a> grades LTF each week next to SP+, FPI, the prediction model and the betting line, on winners picked, average miss and record against the spread. Before each week's games the site puts every system's number for every game on file, and those numbers are never changed. SP+ and FPI are turned into a margin the plain way: one team's rating minus the other's, plus ${M.hfa} for home field. Weeks from before that started show only LTF and the betting line.</p>
  ${BRK ? `<h2>Likely to climb, likely to slide</h2>
  <p>A test on ${BRK.seasons} looked for anything known after week 5 that marked teams the LTF Index was too low on. Three things did, and they held in a longer check back to 2014: failing to cover the spread, carrying a much higher rating into the season, and bad turnover luck. Teams in the top tenth on those three went on to gain ${BRK.wk['5'] ? BRK.wk['5'].top.climb : 9} spots in the LTF rankings on average, and the bottom tenth lost about as many. The <a class="txt" href="${L('momentum')}">momentum page</a> lists both groups through week 7, after which the effect fades. It is a read on the rankings. Those teams covered the spread about half the time afterward, so the market already knew.</p>` : ''}
  <h2>Movement and trends</h2>
  <p>The site rebuilds the score for each earlier week from the games played up to that week, so the last-week column, the week selector and the week-by-week charts follow whatever weights you set. SP+, FPI and SRS only started being saved with the pull of ${esc(M.pulled || 'this week')}. For weeks before that, the computer ratings part is estimated from how each team's Elo moved.</p>
  <h2>The "lost to" tag</h2>
  <p>A team gets this tag when they are ranked ahead of a team that beat them. LTF does not move teams because of the tag. Every team is rated on their whole season, so one result does not override the rest.</p>
  <h2>What the numbers mean</h2>
  <div class="tw"><table><tbody>${['index','epa','sr','ppd','ppo','net','exp','stop','hav','yds','sor','line','market','lean','conf','cover','ats','wc','gs','luck','steady','mkt','mom'].map(def).join('')}</tbody></table></div>
  <p>The stats come from play-by-play in games between FBS teams. Garbage time is removed from everything except yards per game, and each number is adjusted for the opponents faced, so it will not match the box score.</p>
  <h2>When the site updates</h2>
  <p>Scores, betting lines and picks are refreshed every day in season. A pick goes on file as soon as the game has a betting line, always before kickoff, and is never changed after that. It is graded once the game is final.</p>
  <p>The LTF Index moves once a week. A week turns over when nearly all of its games are final and their play-by-play has arrived, which is usually Sunday. Until then a team that played on a Tuesday or a Thursday shows the new score and record, and keeps the rank they had. This keeps the rankings from moving on half a Saturday.</p>
  <p>The numbers on this page were last rebuilt on ${builtTxt(true)}.</p>
  <h2>Where the data comes from</h2>
  <div class="tw"><table class="status"><tbody>
  <tr><td>Scores and schedule</td><td class="yes">Loaded</td><td>${M.games} games in the LTF Index, through week ${M.through}. Latest final score: ${esc(M.lastLabel)}</td></tr>
  <tr><td>Play-by-play</td><td class="yes">Loaded</td><td>Every finished game, with expected points on each play</td></tr>
  <tr><td>Betting lines</td><td class="yes">Loaded</td><td>${esc(M.book)} spread and total for ${M.lined} of ${M.games} finished games${M.api ? `, plus posted lines for games ahead as of ${esc(M.pulled)}` : ''}</td></tr>
  <tr><td>Computer ratings</td><td class="yes">Loaded</td><td>${M.cmpSrc.join(', ')}</td></tr>
  </tbody></table></div>
  <p>Scores and play-by-play come from the public cfbfastR data sets. Ratings and upcoming lines come from the CollegeFootballData.com API.</p>
  </div>`};
}
function viewAbout(){
  return {title:'About', top: pageTop(`About ${esc(BRAND)}`, 'College football, ranked on one scale.'), body: `<div class="prose">
  <p>${esc(BRAND)} ranks all ${T.length} FBS teams with one formula, the LTF Index. It does not know which teams are famous, which conferences get the most television time, or where anyone was ranked in August. It only knows what has happened on the field and how well each team has played.</p>
  <p>That matters most for the teams outside the spotlight. A Group of 6 team that plays like a top-20 team shows up as a top-20 team here. The <a class="txt" href="${L('radar')}">Under the radar</a> page collects them.</p>
  <h2>What you can do here</h2>
  <p>See the <a class="txt" href="${L('rankings')}">rankings</a> for the country, a group or a conference. Open any <a class="txt" href="${L('teams')}">team</a> for their stats, results and remaining schedule. Check the <a class="txt" href="${L('picks')}">picks</a> for every week left, <a class="txt" href="${L('compare')}">compare</a> any two teams, or look at the <a class="txt" href="${L('playoff')}">playoff bracket</a>. If you disagree with the formula, <a class="txt" href="${L('weights')}">build your own</a>.</p>
  <h2>What it is not</h2>
  <p>This is an independent project. It is not connected to any school, conference, sportsbook or the College Football Playoff. The site shows betting lines for comparison, and nothing here is betting advice.</p>
  <p>Team names, colors and logos are used only to identify the teams. They belong to the schools. Logos load from a public sports-data address when your browser allows it, and you can switch them off at the bottom of any page.</p>
  <p><a class="txt" href="${L('how')}">How LTF works</a> &nbsp; <a class="txt" href="${L('contact')}">Contact</a></p></div>`};
}
function viewContact(){
  return {title:'Contact', top: pageTop('Contact', 'Found a mistake, or have an idea for the site?'), body: `<div class="prose">
  ${CONTACT_EMAIL ? `<p>Email <a class="txt" href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>. Corrections are the most useful thing you can send. If a score, a record or a team's conference looks wrong, say which page you were on.</p>`
                  : `<p>A contact address is being set up and will appear on this page.</p>`}
  <p>Most questions about the numbers are answered on the <a class="txt" href="${L('how')}">How it works</a> page.</p></div>`};
}
function viewNotFound(){
  return {title:'Page not found', top:'', body: `<div class="nf"><div class="big">4th &amp; long</div><h1 class="ptitle">That page isn't here</h1>
    <p class="pdek">The link may be old, or the address may have a typo.</p>
    <p class="nfb"><a class="btn" href="${L('home')}">Go to the front page</a> <a class="btn" href="${L('rankings')}">See the rankings</a> <a class="btn" href="${L('teams')}">Find a team</a></p></div>`};
}
