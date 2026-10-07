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
  return {title:'Playoff picture', lead: `Byes today: ${list(seeds.slice(0,4).map(s => tl(s.t)))}. Last team in: ${tl(S(12).t)}. First team out: ${tl(out[0])}. Most likely champion: ${tl(champ[0].t)}, ${pct(champ[1])}.`,
    top: pageTop('Playoff picture', `If the season ended after week ${M.through} and the committee went by the LTF Index, this would be the 12-team bracket.`),
    body: `<section class="sec"><h2>The bracket</h2><p class="hint">Seeds 5 through 12 play the first round on campus, and the top four seeds get a bye to the quarterfinals. Each percentage is that team's chance to win that round, from the LTF line for every opponent they could meet. Later rounds show the most likely teams. Scroll sideways on a phone.</p>${bracket}</section>
    <section class="sec"><h2>Chance to advance</h2>
      ${colKey([['Seed', 'Place in the bracket. The top four seeds get a first-round bye.'], ['First round, Quarterfinal, Semifinal', 'The chance the team wins that round.'], ['Title', 'The chance they win the national title from this bracket.']])}
      <div class="scroll"><table class="grid"><thead><tr>${th('Seed','num','seed')}${th('Team')}${th('LTF rank','num wide','ltfrank')}${th('Last week','num wide','lw')}${th('First round','num','adv')}${th('Quarterfinal','num','adv')}${th('Semifinal','num wide','adv')}${th('Title','num','adv')}</tr></thead><tbody>${seeds.map(orow).join('')}</tbody></table></div>
      <p class="hint after">These numbers assume this exact bracket. For each team's chance of making the playoff at all, see the <a class="txt" href="${L('odds')}">season odds</a>.</p></section>
    <section class="sec"><h2>The field</h2><p class="hint">Seeds follow the LTF ranking, with movement since last week. The top four get a first-round bye.</p><div class="seeds">${seeds.map(seedRow).join('')}</div></section>
    <section class="sec"><h2>First four out</h2><ol class="rows narrowlist">${out.map(t => rowB(t, t.rank, `${pct(sim[t.n].po)} playoff chance`)).join('')}</ol>
      <p class="next"><a class="txt" href="${L('odds')}">Every team's chances at the playoff, their conference title and each win total</a></p></section>
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
  const miss25 = M.apWeek != null ? br.filter(t => !t.d.apr && t.rank <= 25) : [];
  return {title:'Under the radar', card:'polls', lead: miss25.length ? `${tl(miss25[0])} is No. ${miss25[0].rank} here and unranked by the AP. ${miss25.length === 1 ? 'They are the only team' : `${miss25.length} teams`} in the LTF top 25 ${miss25.length === 1 ? '' : 'are '}outside the poll.` : '',
    top: pageTop('Under the radar', `LTF does not know a team's reputation or where anyone was ranked in August. It goes by this season's games, so this page collects the teams that get less attention than their play deserves. The AP poll is here only to compare against. It is never part of the score.`),
    body: `${ap}
    <section class="sec"><h2>Group of 6 leaders</h2><p class="hint">The top Group of 6 teams, where they stand nationally, and how they have done against Power 4 opponents.</p>
      <div class="scroll"><table class="grid"><thead><tr>${th('Rank','num')}${th('National','num','nat')}${th('Team')}${th('Last week','num wide','lw')}${th('Record','num')}${th('LTF','num','index')}${th('Vs. Power 4','num')}${th('Best win','wide')}</tr></thead><tbody>${g6rows}</tbody></table></div>
      <p class="next"><a class="txt" href="${L('rankings', null, {group:'g6'})}">Full Group of 6 rankings</a> &nbsp; <a class="txt" href="${L('conferences')}">Conferences</a> &nbsp; <a class="txt" href="${L('leagues')}">League strength</a></p></section>`};
}

/* ================= track record ================= */
function calibration(){
  const c = BT.cal; if (!c || !c.length) return '';
  const Wd = 560, H = 300, pl = 44, pr = 16, pt = 14, pb = 40, X = v => pl + (v-50)/50*(Wd-pl-pr), Y = v => H-pb - (v-50)/50*(H-pt-pb);
  const grid = [50,60,70,80,90,100].map(v => `<line class="gl" x1="${X(50)}" y1="${Y(v)}" x2="${X(100)}" y2="${Y(v)}"/><text x="${X(50)-8}" y="${Y(v)+4}" text-anchor="end">${v}%</text><text x="${X(v)}" y="${H-pb+16}" text-anchor="middle">${v}%</text>`).join('');
  const pts = c.map(b => `<circle cx="${X(b.pred).toFixed(1)}" cy="${Y(clamp(b.act,50,100)).toFixed(1)}" r="${(4 + Math.sqrt(b.n)/7).toFixed(1)}" fill="var(--pylon)" opacity=".9"><title>LTF said ${f1(b.pred)}%. Won ${f1(b.act)}% of ${b.n} games.</title></circle>`).join('');
  const rows = BT.conf.map(b => `<tr><td class="cn">${b.label}</td><td class="num">${b.lo} to ${b.hi}%</td><td class="num">${f1(b.act)}%</td><td class="num">${b.n.toLocaleString()}</td></tr>`).join('');
  const wk = (BT.byWeek || []).map(b => `<tr><td class="cn">${b.lab}</td><td class="num">${f1(b.su)}%</td><td class="num">${f1(b.miss)}</td><td class="num">${f1(b.mktSu)}%</td><td class="num">${f1(b.mktMiss)}</td><td class="num wide">${b.n.toLocaleString()}</td></tr>`).join('');
  return `<section class="sec"><h2>${up1(NUMW[BT.n] || String(BT.n))} past seasons</h2><p class="hint">The same LTF Index, rebuilt week by week for ${BT.seasons} from only the games played to that point, picking the next week's games: ${BT.games.toLocaleString()} in all.</p>
    <div class="facts">${fact('Winners picked', f1(BT.su) + '%', `Best season ${f1(BT.bySeason.best)}%, worst ${f1(BT.bySeason.worst)}%`)}${fact('Average miss', f1(BT.miss) + ' points', 'predicted margin against the real one')}
      ${fact('The betting line, same games', f1(BT.mktSu) + '%', `off by ${f1(BT.mktMiss)} points. A yardstick, not part of the score`)}</div>
    <div class="dgrid"><div><h3>When LTF says 70%, does that team win 70%?</h3><div class="plot static"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Win chance LTF gave against how often that team won. The points sit close to the diagonal.">
      ${grid}<line class="mid" x1="${X(50)}" y1="${Y(50)}" x2="${X(100)}" y2="${Y(100)}"/>${pts}
      <text x="${(X(50)+X(100))/2}" y="${H-6}" text-anchor="middle">Win chance LTF gave the favorite</text></svg></div>
      <p class="hint after">Each dot is a group of past games. Dots on the dashed line mean the win chances were honest. Bigger dots hold more games.</p>
      <h3>How far ahead can it see?</h3><div class="scroll"><table class="grid"><thead><tr><th>Pick made</th><th class="num">LTF favorite won</th><th class="num">Games</th></tr></thead><tbody>${(CFD.hz || []).map(h => `<tr><td class="cn">${up1(h.lab)}</td><td class="num">${f1(h.act)}%</td><td class="num">${h.n.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint after">Picks for games far down the schedule held up nearly as well as picks for next week.</p></div>
    <div><h3>Does the confidence score hold up?</h3><div class="scroll"><table class="grid"><thead><tr><th>Label</th><th class="num">Confidence</th><th class="num">Pick won</th><th class="num">Games</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="hint after">Confidence is the chance the LTF pick wins. Picks in each band won about as often as the band says.</p>
      <h3>By part of the season</h3><div class="scroll"><table class="grid"><thead><tr><th>Games played in</th><th class="num">LTF winners</th><th class="num">LTF miss</th><th class="num">Line winners</th><th class="num">Line miss</th><th class="num wide">Games</th></tr></thead><tbody>${wk}</tbody></table></div>
      <p class="hint after">The LTF Index starts every season knowing nothing, so it trails the betting line most in September and has caught up by November. That gap is the price of using this season only. <a class="txt" href="${L('inputs')}">What goes in, and what stays out</a></p></div></div></section>`;
}
function viewTrack(){
  const tr = trackRecord(), a = tr.all, dec = a.w + a.l;
  if (!a.n) return {title:'LTF track record', top: pageTop('LTF track record', 'How the LTF line has done against the final score.'), body:`<p class="empty">There are no finished games with an LTF line yet. LTF sets its first lines after week 2.</p>${calibration()}`};
  const mx = Math.max(...tr.weeks.flatMap(x => [x.ai, x.am]), 1);
  const bar = (v, cls) => `<span class="tr"><i class="${cls}" style="width:${(v/mx*100).toFixed(1)}%"></i></span>`;
  const chart = `<div class="bars nomid" role="img" aria-label="Average miss by week, LTF and the betting line">${tr.weeks.map(x => `<div class="br"><a href="${L('games', null, {week:x.wk})}">Week ${x.wk}, LTF</a>${bar(x.ai,'g6')}<span class="num">${x.ai.toFixed(1)}</span></div>${x.mn ? `<div class="br"><span class="mutedl">Week ${x.wk}, betting line</span>${bar(x.am,'')}<span class="num">${x.am.toFixed(1)}</span></div>` : ''}`).join('')}</div>`;
  const wrows = tr.weeks.map(x => `<tr><td class="cn"><a class="tlink" href="${L('games', null, {week:x.wk})}">Week ${x.wk}</a></td><td class="num">${x.n}</td><td class="num">${x.w}-${x.l}</td><td class="num">${x.ai.toFixed(1)}</td><td class="num">${x.mn ? `${x.mw}-${x.ml}` : '–'}</td><td class="num">${x.mn ? x.am.toFixed(1) : '–'}</td></tr>`).join('');
  const rows = [...tr.rows].sort((x,y) => y.g.w-x.g.w || y.ei-x.ei).map(r => { const g = r.g;
    return `<tr><td class="num">${g.w}</td><td class="wrap2"><a class="tlink" href="${gameL(g)}">${finalTxt(g)}</a></td><td>${lineTxt(r.x, true)}</td>
      <td class="res ${r.right ? 'up' : 'down'}">${callTxt(r)}</td>
      <td class="num">${r.ei.toFixed(1)}</td><td class="wide">${bettingTxt(g, true) || '–'}</td><td class="num wide">${r.em == null ? '–' : r.em.toFixed(1)}</td></tr>`; }).join('');
  return {title:'LTF track record', lead: `LTF has had the winner in ${a.w} of ${dec} games this season, ${dec ? Math.round(100*a.w/dec) : 0}%, and missed the margin by ${a.ai.toFixed(1)} points a game.`,
    top: pageTop('LTF track record', `Every finished game where LTF had a line before kickoff. LTF is rebuilt for each week using only earlier games, so nothing here is graded with hindsight.`),
    body: `<div class="facts">${fact('Winners picked', `${a.w}-${a.l}`, `${dec ? Math.round(100*a.w/dec) : 0}% of ${dec} games`)}
      ${fact('Average miss', a.ai.toFixed(1) + ' points', 'predicted margin against the real one')}
      ${a.mn ? fact('The betting line, same season', `${a.mw}-${a.ml}`, `off by ${a.am.toFixed(1)} points. A yardstick only`) : ''}
      ${fact('Games graded', a.n, `weeks ${tr.weeks.map(x => x.wk).join(', ')}`)}</div>
    ${calibration()}
    <section class="sec"><h2>Average miss by week</h2><p class="hint">Shorter is better. Orange is LTF, and the bar under it is the betting line.</p>${chart}</section>
    <section class="sec"><h2>Week by week</h2><div class="scroll"><table class="grid"><thead><tr><th>Week</th><th class="num">Games</th><th class="num">LTF winners</th><th class="num">LTF miss</th><th class="num">Line winners</th><th class="num">Line miss</th></tr></thead><tbody>${wrows}</tbody></table></div>
    <p class="next"><a class="txt" href="${L('scorecard')}">Scorecard: LTF next to SP+, FPI and the betting line</a></p></section>
    <section class="sec"><h2>Every game this season</h2><p class="hint">Biggest misses first within each week. The betting line is the closing line, shown once the game is over.</p>
      <div class="scroll"><table class="grid"><thead><tr>${th('Wk','num')}${th('Final')}${th('LTF line','','line')}${th('Winner call')}${th('LTF miss','num')}${th('Betting line','wide','market')}${th('Line miss','num wide')}</tr></thead><tbody>${rows}</tbody></table></div></section>
    ${lineNote}`};
}

/* ================= weights ================= */
function previewList(){
  return byRank().slice(0,15).map(t => { const mv = t.baseRank - t.rank;
    return `<li><span class="pr">${t.rank}</span><span>${tl(t)} <span class="cf">${t.w}-${t.l}</span></span><span class="num">${t.idx.toFixed(1)}</span><span class="mv ${mv>0?'up':mv<0?'down':''}">${mv>0?'up '+mv:mv<0?'down '+(-mv):''}</span></li>`; }).join('');
}
function viewWeights(){
  const sliders = COMP.map(c => `<div class="slider"><label for="w-${c.k}">${c.name}</label><output id="o-${c.k}">${share(c.k)}%</output>
    <input id="w-${c.k}" data-weight="${c.k}" type="range" min="0" max="60" step="1" value="${W[c.k]}"><p>${c.what}</p></div>`).join('');
  return {title:'Build your own rankings', lead: `Think wins should count for more, or defense for less? Move a slider and the whole site follows your version.`,
    top: pageTop('Build your own rankings', `The site starts on the ${term('ltf', 'Level the Field Index')}, or LTF Index for short. Move a slider and every page follows your version instead: rankings, lines, picks and the playoff bracket. The five parts always add up to 100%, and your settings ride along in the link so you can share them. Every part is built from this season's games, so nothing you set here can bring a poll or a preseason ranking back in.`),
    body: `<p class="status" id="wstate">${customWeights() ? 'You are on <b>your own weights</b>.' : 'You are on the <b>LTF Index</b>.'}</p><div class="wgrid"><div>${sliders}<button class="btn" type="button" id="reset">Reset to the LTF Index</button></div>
    <div class="preview"><h3>Top 15 with these weights</h3><ol id="preview">${previewList()}</ol><p class="hint after">Up and down show movement against the LTF Index.</p></div></div>
    <p class="hint after">The LTF Index weights were tested on ${NUMW[BT.n] || BT.n} past seasons. <a class="txt" href="${L('how')}">How the weights were tested</a></p>`};
}

/* ================= how it works, about, contact ================= */
function refileNote(){   // what happened to numbers that were already on file when the formula changed
  const moved = PICKS.filter(p => p.was && p.was.length && onFile(p)), left = PICKS.filter(p => p.lm != null && !onFile(p)); if (!moved.length && !left.length) return '';
  const wks = list([...new Set(moved.map(p => p.w))].sort((a,b) => a-b).map(String)), n = k => k === 1 ? 'One' : String(k);
  return `<p>Every game this season is graded on the new formula.${moved.length ? ` ${n(moved.length)} week ${wks} ${moved.length === 1 ? 'number was' : 'numbers were'} already on file when the formula changed. ${moved.length === 1 ? 'It was' : 'They were'} refiled under the new formula the same day, before ${moved.length === 1 ? 'that game' : 'those games'} kicked off, and the earlier ${moved.length === 1 ? 'number is' : 'numbers are'} kept beside the new ones in the record.` : ''}${left.length ? ` ${n(left.length)} ${left.length === 1 ? 'game' : 'games'} had already kicked off by then${left.length <= 3 ? ` (${list(left.map(p => gameById[p.id]).filter(Boolean).map(g => `${esc(g.a)} at ${esc(g.h)}`))})` : ''}. Nothing goes on file after kickoff, so ${left.length === 1 ? 'that game is' : 'those games are'} graded on the LTF line rebuilt under the new formula from the games played before ${left.length === 1 ? 'it' : 'them'}.` : ''}</p>`;
}
function viewHow(){
  const row = (a,b,c) => `<tr><td>${a}</td><td class="num">${b}</td><td>${c}</td></tr>`;
  const def = k => `<tr><td>${GLOSS[k][0]}</td><td>${GLOSS[k][1]}</td></tr>`;
  const was = BT.was, LGC = M.lgc || {}, wkBT = (BT.byWeek || []);
  return {title:'How it works', top: pageTop('How it works', 'What goes into the LTF Index, how it was tested, and what each number means.'), body: `<div class="prose">
  <h2>One score, several views</h2>
  <p>LTF is short for Level the Field. Every one of the ${T.length} FBS teams gets a single national score, the LTF Index. The Power 4, Group of 6 and conference rankings are that same list filtered. Notre Dame is grouped with the Power 4 and the other independents with the Group of 6.</p>
  <p>The score blends what a team has accomplished with how well they have played. It runs from 0 to 100. An average FBS team is 50, and every 14 points is one standard deviation.</p>
  <h2>This season only</h2>
  <p>The LTF Index is built from this season's games and nothing else. It does not use the AP or coaches poll, preseason rankings, last season's results, recruiting rankings, betting lines or anyone else's ratings. Every team starts the year level. <a class="txt" href="${L('inputs')}">The full list of what goes in and what stays out</a></p>
  <h2>What goes into it</h2>
  <div class="tw"><table><thead><tr><th>Part</th><th class="num">Weight</th><th>What is inside, as shares of that part</th></tr></thead><tbody>
  ${row('Résumé',DEFAULTS.res+'%','Strength of record 65%: how hard this record would be for a typical top-25 team to match against the same opponents in the same stadiums. A hard schedule and a loss to a weak team are both already counted here. Quality wins 20%: wins over top-25 and top-50 teams, worth more on the road. Scoring margin 15%.')}
  ${row('Offense',DEFAULTS.off+'%','EPA per play 30%, success rate 25%, points per drive 20%, points per scoring opportunity 10%, explosive play rate 10%, yards per game 5%.')}
  ${row('Defense',DEFAULTS.def+'%','The same stats allowed: EPA per play 25%, success rate 20%, points per drive 20%, points per scoring opportunity 10%, explosive play rate 5%, yards per game 5%. Then stop rate 10% and havoc rate 5%.')}
  ${row('Scoring margin',DEFAULTS.mar+'%','Points a game better than an average team, after allowing for each opponent and for home field. A blowout counts for no more than 24 points.')}
  ${row('First half',DEFAULTS.h1+'%','The same thing at halftime. A lead built before the game is decided says more about the two teams than points scored after it, when starters sit and play-calling changes.')}
  </tbody></table></div>
  <p>These weights are the LTF Index. It is what the site shows unless you change it on the <a class="txt" href="${L('weights')}">Build your own rankings</a> page. The shares inside each part are fixed. Special teams is shown on each team's page but is not part of the score.</p>
  <h2>Every game counts</h2>
  <p>Offense, defense and scoring margin use every game a team has played, with each number adjusted for the opponent. A game against a lower-division team counts too. All lower-division opponents are treated as one pooled team, and how good that pooled team is gets worked out from this season's games like any other team's. Garbage time is removed from the play-by-play stats, so running up the score on a weak opponent earns little.</p>
  <p>The first-half part is the one exception. It uses games between FBS teams only, because a halftime lead over a lower-division team says little. In testing, counting those games there made the picks slightly worse.</p>
  <h2>League strength</h2>
  <p>Early in the season most teams have played only a few opponents, so LTF also reads how each league has done against the others. It works in two levels. Level one is the gap between the power leagues and everyone else. Those two groups play each other dozens of times in September, so that gap is measured well and LTF takes it nearly in full. Level two is one league against another inside the same group. Those leagues meet far less often, so that level is held very firmly: a league only gets credit over another when this season's games between them clearly call for it.</p>
  <p>A team is not tied to their league. The league's level is where a team starts, and their own results move them from there. ${LGC.cross ? `Across ${LGC.seasons}, in ${LGC.cross.n.toLocaleString()} games between the two groups, the LTF line fell short of the real gap by ${f1(LGC.cross.short)} points.${LGC.cross.before != null ? ` Without this step it fell short by ${f1(LGC.cross.before)}.` : ''}` : ''} The <a class="txt" href="${L('leagues')}">League strength</a> page shows this season's numbers and a standing check on whether LTF has leaned for or against any league.</p>
  <h2>How the weights were tested</h2>
  <p>For each of the ${BT.seasons} seasons the LTF Index was rebuilt as it stood after week 6, using only games played to that point, and then used to predict every later regular-season game that year, ${BT.w6 ? BT.w6.games.toLocaleString() : ''} games in all. Each season was predicted with settings fitted on the other eleven.</p>
  <div class="tw"><table><thead><tr><th>Weights: résumé, offense, defense, margin, first half</th><th class="num">Average miss</th><th>Winners picked</th></tr></thead><tbody>
  ${(BT.w6 ? BT.w6.rows : []).map((q,i) => row(q.lab, q.miss.toFixed(2) + (i ? '' : ' points'), q.su.toFixed(1) + '%')).join('')}
  </tbody></table></div>
  <p>Average miss is how far the predicted margin was from the real one. Résumé alone is the weakest predictor of later games, and no single part does as well as the blend. Past that, the exact split matters little: sensible recipes land within a few hundredths of a point of each other. The LTF Index keeps a full fifth on résumé because the rankings are meant to reward what a team has done as well as how well they have played.</p>
  <h2>What changed on October 7, 2026</h2>
  <p>Until then, 30% of the LTF Index was an average of four computer ratings: SP+, FPI, SRS and Elo. Three of those carry earlier seasons into this one, so a team's score still leaned on how good the program was a year or two ago. That part is gone. In its place are the two scoring margins above, lower-division games now count, and league strength was added in two levels.${was ? ` On the same ${was.games.toLocaleString()} past games, the old formula picked ${f1(was.su)}% of winners and missed by ${f1(was.miss)} points. The new one picks ${f1(BT.su)}% and misses by ${f1(BT.miss)}. Simply deleting the ratings and adding nothing would have fallen to ${f1(was.bare.su)}% and ${f1(was.bare.miss)}.` : ''} Every earlier week this season is shown under the new formula, so week-to-week movement compares like with like.</p>
  ${refileNote()}
  <p>On October 6 the résumé itself was trimmed. It used to have two more pieces, losses and strength of schedule. Testing showed the losses piece was the win-loss record over again, and schedule strength was being counted twice, because strength of record already allows for who a team has played.</p>
  <h2>The LTF line</h2>
  <p>For any two teams, the LTF line is the gap between their LTF Index scores converted to points, plus ${M.hfa} for the home team. The conversion comes from the same past seasons: at this point in the year, one standard deviation of the LTF Index has been worth about ${SLOPE.toFixed(1)} points in later games. For finished games the site shows the line as it stood before kickoff, built only from earlier weeks. The first lines come after week 2. The <a class="txt" href="${L('track')}">track record</a> page grades them.</p>
  <p>Each game page splits the LTF line into points from résumé, offense, defense, scoring margin, the first half and home field. Those pieces add up to the line exactly. The written preview is built from the same numbers, so it always matches what LTF shows. LTF sets no line against an FCS team.</p>
  <h2>The confidence score</h2>
  <p>Every pick for a game still to be played carries a confidence score from 50 to 99. It is the chance the LTF pick wins, worked out from the LTF line. A 50 is a coin flip. That number has been honest: across ${BT.seasons}, when LTF said 70%, that team won about 70% of the time, and picks made seven or more weeks ahead held up nearly as well as picks for the next week.</p>
  <p>Under each score the site lists reasons to trust it more or less: where the line comes from, whether the pick depends on home field, whether either team has played too few games to trust, and how steady the favorite has been. The reasons explain the pick. They do not change the number.</p>
  <h2>Upset watch</h2>
  <p>The <a class="txt" href="${L('upsets')}">upset watch</a> turns the same win chances around and reads them from the underdog's side. It lists the underdogs with a real chance this week, the top 25 teams with the least room for error, and the games where LTF picks against the AP poll.${(BT.dog || []).length ? ` In past seasons, underdogs LTF gave between ${BT.dog[1].lo} and ${BT.dog[1].hi}% won ${f1(BT.dog[1].act)}% of the time, and those between ${BT.dog[0].lo} and ${BT.dog[0].hi}% won ${f1(BT.dog[0].act)}%.` : ''}</p>
  <h2>Remaining schedules and season odds</h2>
  <p>The site plays out the rest of the season ${SIMS.toLocaleString()} times. Each run gives every team a slightly different true strength, since the LTF Index is never exactly right, then plays every remaining game. Conference title games match the top two teams by conference record. The playoff field is picked by LTF Index after each run, with each unexpected win or loss moving a team by the amount results have moved teams in past seasons. That amount is bigger early in the year, when one game is a large share of what is known, and less than half as big by November.</p>
  <p>The <a class="txt" href="${L('playoff')}">playoff picture</a> seeds the 12-team bracket by LTF rank today, using each conference's top team as a stand-in for the champion, and works out each team's chance to get through every round.</p>
  <h2>Game scores and projected scores</h2>
  <p>A game score rates one performance on the same 0 to 100 scale, using the margin, the opponent's strength and where the game was played. A projected score splits the LTF line around a total built from each team's points per drive and pace. The total is a rough guide and nothing more.</p>
  <h2>Luck and steadiness</h2>
  <p>Luck adds up things that swing games but mostly do not repeat: fumble recoveries above or below half, interceptions compared with passes defended, and opponents' field goal kicking. Steadiness is how much a team's game scores swing from week to week. Neither is part of the LTF Index. They are there to explain results.</p>
  <h2>Buying and selling</h2>
  <p>The <a class="txt" href="${L('buysell')}">buying and selling</a> lists pick out teams whose streak and whose road ahead point in opposite directions. LTF is selling a team that has won three or more in a row when it expects them to lose more than they win over their next three games against FBS teams. It is buying a team that has lost two or more in a row when it expects them to win more than they lose. The expected wins are the win chances from the LTF line for those games, added up. A rule makes the lists, nobody picks the teams, and they go on file each week before those teams play again.${M.bs ? ` Over ${M.bs.seasons}, teams on the selling list had won ${f1(M.bs.sell.before)}% of their games and won ${f1(M.bs.sell.act)}% of the ones that followed. Teams on the buying list went from ${f1(M.bs.buy.before)}% to ${f1(M.bs.buy.act)}%.` : ''} It is not a second prediction. It is the LTF line read team by team.</p>
  <h2>Momentum</h2>
  <p>The <a class="txt" href="${L('momentum')}">momentum</a> score runs from minus 10 to plus 10. It blends the change in a team's LTF Index over three weeks, how their last two games graded against the ones before, and recent results: the streak, and upsets either way by the LTF line of the day. It is tracked for the story of the season and is not part of the LTF Index.${MOM ? ` The reason is a test on ${MOM.games.toLocaleString()} games from ${MOM.seasons}. Adding momentum to the LTF line moved it ${MOM.fix.gain.toFixed(2)} points closer to the final margin, which is nothing. LTF already rises when a team plays better, because the whole season is rescored every week.` : ''}</p>
  <h2>The scorecard</h2>
  <p>The <a class="txt" href="${L('scorecard')}">scorecard</a> grades LTF each week next to SP+, FPI and the betting line, on winners picked and average miss. When a week's games are in, the site puts the LTF number for every game of the next week on file, with the SP+ and FPI numbers for the same game, and a number is never changed once the game has kicked off. SP+ and FPI are turned into a margin the plain way: one team's rating minus the other's, plus ${M.hfa} for home field. The betting line is the closing line, added once a game is over. All three are there to be measured against. None of them is part of the LTF Index.</p>
  <h2>Movement and trends</h2>
  <p>The site rebuilds the score for each earlier week from the games played up to that week, under today's formula, so the last-week column, the week selector and the week-by-week charts all compare like with like and follow whatever weights you set.</p>
  <h2>The "lost to" tag</h2>
  <p>A team gets this tag when they are ranked ahead of a team that beat them. LTF does not move teams because of the tag. Every team is rated on their whole season, so one result does not override the rest.</p>
  <h2>What the numbers mean</h2>
  <div class="tw"><table><tbody>${['index','res','off','def','mar','h1','epa','sr','ppd','ppo','net','exp','stop','hav','yds','sor','line','conf','wc','gs','luck','steady','mom','market'].map(def).join('')}</tbody></table></div>
  <p>Garbage time is removed from every play-by-play stat except yards per game, and each number is adjusted for the opponents faced, so it will not match the box score.</p>
  <h2>When the site updates</h2>
  <p>Scores and picks are refreshed every day in season. The LTF number for a game goes on file when the week before it is in the books, always before kickoff. Once a game kicks off, the number is never changed. It is graded once the game is final. If the formula ever changes, the numbers for games still to be played are refiled under the new formula, and the earlier numbers stay in the record beside them.</p>
  <p>The LTF Index moves once a week. A week turns over when nearly all of its games are final and their play-by-play has arrived, which is usually Sunday. Until then a team that played on a Tuesday or a Thursday shows the new score and record, and keeps the rank they had. This keeps the rankings from moving on half a Saturday.</p>
  <p>The numbers on this page were last rebuilt on ${builtTxt(true)}.</p>
  <h2>Where the data comes from</h2>
  <div class="tw"><table class="status"><tbody>
  <tr><td>Scores and schedule</td><td class="yes">In the score</td><td>${M.games} games through week ${M.through}, ${M.fbsGames || ''} of them between two FBS teams. Latest final score: ${esc(M.lastLabel)}</td></tr>
  <tr><td>Play-by-play</td><td class="yes">In the score</td><td>Every finished game, with expected points on each play and the score at halftime</td></tr>
  <tr><td>AP poll</td><td>Shown beside it</td><td>${M.apWeek != null ? `Week ${M.apWeek} poll, on the Under the radar page and the upset watch` : 'Not loaded'}</td></tr>
  <tr><td>SP+ and FPI</td><td>Shown beside it</td><td>Graded next to LTF on the scorecard</td></tr>
  <tr><td>Betting line</td><td>Shown beside it</td><td>${esc(M.book)} closing line for ${M.lined} of ${M.fbsGames || M.games} finished games between FBS teams, graded on the scorecard. Lines for games still to be played are not shown</td></tr>
  </tbody></table></div>
  <p>Scores and play-by-play come from the public cfbfastR data sets. The poll, the two outside ratings and the closing lines come from the CollegeFootballData.com API.</p>
  </div>`};
}
function viewAbout(){
  return {title:'About', top: pageTop(`About ${esc(BRAND)}`, 'College football, ranked on this season and nothing else.'), body: `<div class="prose">
  <p>${esc(BRAND)} ranks all ${T.length} FBS teams with one formula, the LTF Index. It does not know which teams are famous, which conferences get the most television time, where anyone was ranked in August or what happened last year. It only knows what has happened on the field this season and how well each team has played.</p>
  <p>That cuts both ways. A big-name program that has played poorly drops, and a team nobody is talking about that has beaten good opponents rises. The <a class="txt" href="${L('radar')}">Under the radar</a> page collects the second kind.</p>
  <h2>Who it is for</h2>
  <p>Anyone who argues about college football. Use it to build your own power rankings, to settle who has the better résumé, or to pick a few upsets before Saturday. It is a hobby project, made for fun.</p>
  <h2>What you can do here</h2>
  <p>See the <a class="txt" href="${L('rankings')}">rankings</a> for the country, a group or a conference. If you disagree with the formula, <a class="txt" href="${L('weights')}">build your own</a>. Open any <a class="txt" href="${L('teams')}">team</a> for their stats, results and remaining schedule. Check the <a class="txt" href="${L('picks')}">picks</a> for every week left and the <a class="txt" href="${L('upsets')}">upset watch</a>, <a class="txt" href="${L('compare')}">compare</a> any two teams, or look at the <a class="txt" href="${L('playoff')}">playoff bracket</a>.</p>
  <h2>What it is not</h2>
  <p>This is an independent project. It is not connected to any school, conference, sportsbook or the College Football Playoff. It is not a betting site. It shows no odds or lines for upcoming games and gives no betting advice. A closing betting line appears on the scorecard, for finished games only, as one yardstick to grade the picks against.</p>
  <p>Team names, colors and logos are used only to identify the teams. They belong to the schools. ${LOCAL.size ? 'You can switch logos off at the bottom of any page.' : 'Logos load from a public sports-data address when your browser allows it, and you can switch them off at the bottom of any page.'}</p>
  <h2>Sharing and privacy</h2>
  <p>Most pages have a Share button. It draws a picture of what you are looking at, with the site's name and the week on it, so you can post it or send it to a friend.</p>
  <p>${SITE && SITE.counter ? 'The site counts how many times each page is opened, using GoatCounter. It sets no cookies, keeps nothing that identifies you, and is not shared with advertisers. There are no ads here.' : 'The site sets no cookies and has no ads.'} Your followed teams and settings are kept in your own browser and never leave it.</p>
  <p><a class="txt" href="${L('inputs')}">What goes in, and what stays out</a> &nbsp; <a class="txt" href="${L('how')}">How LTF works</a> &nbsp; <a class="txt" href="${L('contact')}">Contact</a></p></div>`};
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
