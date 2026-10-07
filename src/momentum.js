/* ================= momentum: shown for the story, never part of the LTF Index ================= */
/* Three things fans mean by momentum, each compared with the rest of the country: the rating trend over three weeks,
   how the last two games compare with the ones before, and recent results (streak, upsets, covers).
   Twelve past seasons say none of it predicts the next game once the ratings are counted (research/momentum_study.py),
   so it is here to read and it never moves a team in the rankings. */
const MOM = M.mom || null;
let _mom = null;
const MOM_W = {trend:.35, play:.25, res:.4};
function momentumAll(){
  if (_mom) return _mom;
  const dog = e => e.spr != null && e.spr >= 3, fav = e => e.spr != null && e.spr <= -3, won = e => e.pf > e.pa;
  const rows = T.map(t => {
    const hw = HW.filter(w => t.hist[w]), cur = hw[hw.length-1], back = hw[Math.max(0, hw.length-4)];
    const m = {t, idx3:null, rk3:null, from:null, wks:0, play:null, last2:null, before:null, streak:0, cov:0, miss:0, push:0, upW:[], upL:[], upSeason:0, spot:null, prog:null, res:null};
    if (hw.length >= 2){ m.idx3 = t.hist[cur].idx - t.hist[back].idx; m.rk3 = t.hist[back].rank - t.hist[cur].rank; m.from = t.hist[back].rank; m.wks = cur - back; }
    const gs = t.g.map(e => gameScore(t, e));
    if (gs.length >= 3){ m.last2 = mean(gs.slice(-2)); m.before = mean(gs.slice(0,-2)); m.play = m.last2 - m.before; }
    for (let i = t.g.length-1; i >= 0; i--){
      const w = won(t.g[i]);
      if (i === t.g.length-1) m.streak = w ? 1 : -1; else if (w === (m.streak > 0)) m.streak += w ? 1 : -1; else break;
    }
    for (const e of t.g.slice(-3)){
      if (e.cm != null){ if (e.cm > 0) m.cov++; else if (e.cm < 0) m.miss++; else m.push++; }
      if (won(e) && dog(e)) m.upW.push(e); if (!won(e) && fav(e)) m.upL.push(e);
    }
    m.upSeason = t.g.filter(e => won(e) && dog(e)).length;
    const lg = t.g[t.g.length-1];      // the spot a team is in this week: off an upset loss, or off an upset win
    if (lg && lg.spr != null) m.spot = !won(lg) && lg.spr <= -7 ? {k:'bounce', e:lg} : won(lg) && lg.spr >= 7 ? {k:'high', e:lg} : null;
    if (t.g.length) m.res = clamp(m.streak, -5, 5) + 1.5*(m.upW.length - m.upL.length) + .5*(m.cov - m.miss);
    if (t.d.ly != null) m.prog = t.d.ly - t.rank;
    return m;
  });
  for (const key of ['idx3','play','res']){
    const have = rows.filter(m => m[key] != null).map(m => m[key]), mu = have.length ? mean(have) : 0, sd = have.length ? sdev(have) || 1 : 1;
    rows.forEach(m => { m['z_'+key] = m[key] == null ? 0 : (m[key]-mu)/sd; });
  }
  rows.forEach(m => { m.raw = MOM_W.trend*m.z_idx3 + MOM_W.play*m.z_play + MOM_W.res*m.z_res; });
  const mu = mean(rows.map(m => m.raw)), sd = sdev(rows.map(m => m.raw)) || 1;
  rows.forEach(m => { m.score = clamp((m.raw-mu)/sd*3.3, -10, 10); });
  [...rows].sort((a,b) => b.score-a.score).forEach((m,i) => { m.rank = i+1; });
  return _mom = new Map(rows.map(m => [m.t, m]));
}
const momentum = t => momentumAll().get(t);
const momLabel = s => s >= 5 ? 'Surging' : s >= 2 ? 'Heating up' : s > -2 ? 'Holding steady' : s > -5 ? 'Cooling off' : 'Sliding';
const momCls = s => s >= 2 ? 'up' : s <= -2 ? 'down' : '';
const fix1 = v => (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(v).toFixed(1);      // always one decimal, so a column of them lines up
const momNum = m => `<b class="mom ${momCls(m.score)}">${fix1(m.score)}</b>`;
const NUMW = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const momTag = m => `${momNum(m)} <span class="cf">${momLabel(m.score)}</span>`;
const streakTxt = (n, cap) => !n ? '–' : `${cap ? (n > 0 ? 'Won' : 'Lost') : (n > 0 ? 'won' : 'lost')} ${Math.abs(n) === 1 ? 'last time out' : (NUMW[Math.abs(n)] || Math.abs(n)) + ' straight'}`;
const streakShort = n => !n ? '–' : `<span class="${n >= 2 ? 'up' : n <= -2 ? 'down' : ''}">${n > 0 ? 'W' : 'L'}${Math.abs(n)}</span>`;
const ats3Txt = m => m.cov + m.miss + m.push ? `${m.cov}-${m.miss}${m.push ? '-'+m.push : ''}` : '–';
const dogTxt = e => `${anA(half(e.spr))} ${half(e.spr)}-point underdog`;       // "a 3.5-point underdog", "an 8-point underdog"
const favTxt = e => `${anA(half(e.spr))} ${half(e.spr)}-point favorite`;
function momWhy(t){   // the reasons behind a team's momentum, in a sentence or two
  const m = momentum(t), a = [], b = [];
  if (m.idx3 != null) a.push(Math.abs(m.idx3) < .5 ? `Their LTF Index has barely moved over the last ${m.wks === 1 ? 'week' : (NUMW[m.wks] || m.wks) + ' weeks'}`
    : `Their LTF Index is ${m.idx3 > 0 ? 'up' : 'down'} ${Math.abs(m.idx3).toFixed(1)} over the last ${m.wks === 1 ? 'week' : (NUMW[m.wks] || m.wks) + ' weeks'}${m.rk3 ? `, moving them from No. ${m.from} to No. ${t.rank}` : ''}`);
  if (m.play != null) a.push(`their last two games graded out at ${Math.round(m.last2)}, against ${Math.round(m.before)} before that`);
  const n = m.cov + m.miss + m.push, up = s => s.charAt(0).toUpperCase() + s.slice(1);
  const lastUp = [...m.upW, ...m.upL].includes(t.g[t.g.length-1]);      // the last game is already named as an upset, so do not say it twice
  if (m.streak && !(Math.abs(m.streak) === 1 && lastUp)) b.push(Math.abs(m.streak) === 1 ? `${m.streak > 0 ? 'won' : 'lost'} last time out` : `have ${m.streak > 0 ? 'won' : 'lost'} ${NUMW[Math.abs(m.streak)] || Math.abs(m.streak)} straight`);
  if (m.upW.length) b.push(`beat ${list(m.upW.map(e => `${esc(e.opp)} as ${dogTxt(e)}`))}`);
  if (m.upL.length) b.push(`lost to ${list(m.upL.map(e => `${esc(e.opp)} as ${favTxt(e)}`))}`);
  if (n) b.push(`are ${ats3Txt(m)} against the spread in their last ${n === 3 ? 'three' : n === 2 ? 'two games with a line' : 'game with a line'}`);
  return [...a.map(s => up(s) + '.'), b.length ? 'They ' + list(b) + '.' : ''].filter(Boolean).join(' ');
}
/* a team coming off an upset, and what past seasons say about the week after */
function spotTxt(t){
  const m = momentum(t); if (!m.spot || !MOM) return '';
  const e = m.spot.e;
  return m.spot.k === 'bounce'
    ? `<b>Bounce-back spot.</b> ${esc(t.n)} lost to ${esc(e.opp)} as ${favTxt(e)} last time out. In past seasons LTF was about ${Math.abs(MOM.upL.ltf).toFixed(0)} points too low on teams in this spot the next week (${MOM.upL.nl} games, and it held in all ${NUMW[MOM.upL.yrs] || MOM.upL.yrs} seasons tested). The market had already adjusted: those teams covered ${MOM.upL.ats}% of the time.`
    : `<b>Off an upset win.</b> ${esc(t.n)} beat ${esc(e.opp)} as ${dogTxt(e)} last time out. Fans call the next one a letdown spot, but past seasons do not back that up: those teams covered ${MOM.upW.ats}% of the time the next week (${MOM.upW.n} games).`;
}
/* both teams' momentum for a game page */
function momGame(g){
  const A = byName[g.a], B = byName[g.h]; if (!A || !B || g.done || !A.g.length || !B.g.length) return '';
  const a = momentum(A), b = momentum(B);
  const row = (label, x, y) => `<tr><td>${x}</td><th scope="row">${label}</th><td>${y}</td></tr>`;
  const chg = v => v == null ? '–' : `<span class="${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${fix1(v)}</span>`;
  const rk = m => m.rk3 == null ? '–' : !m.rk3 ? 'same spot' : `<span class="${m.rk3 > 0 ? 'up' : 'down'}">${m.rk3 > 0 ? 'up' : 'down'} ${Math.abs(m.rk3)}</span> <span class="cf">from No. ${m.from}</span>`;
  const play = m => m.play == null ? '–' : `${Math.round(m.last2)} <span class="cf">was ${Math.round(m.before)}</span>`;
  const spots = [spotTxt(A), spotTxt(B)].filter(Boolean).map(s => `<p class="next">${s}</p>`).join('');
  return `<section class="sec"><h2>Momentum coming in</h2>
    <p class="hint">How each team is trending. This is here for the story of the game and is not in the LTF line: over twelve past seasons, hot and cold stretches did not predict the next result. <a class="txt" href="${L('momentum')}">See the test</a></p>
    <div class="scroll"><table class="tape mo"><tbody>
      ${row(term('mom'), momTag(a), momTag(b))}
      ${row(term('mtrend', 'LTF Index, last three weeks'), chg(a.idx3), chg(b.idx3))}
      ${row('LTF rank, last three weeks', rk(a), rk(b))}
      ${row(term('mplay', 'Last two games'), play(a), play(b))}
      ${row('Streak', streakTxt(a.streak, true), streakTxt(b.streak, true))}
      ${row(term('mats', 'ATS, last 3'), ats3Txt(a), ats3Txt(b))}
    </tbody></table></div>${spots}</section>`;
}

/* ================= who is likely to climb from here ================= */
/* The breakout watch. In past seasons three things marked teams the LTF Index was too low on after weeks 4 to 7: failing to
   cover the spread, carrying a much higher rating into the season, and bad turnover luck. Each is compared with the rest of
   the country and weighted the way those seasons say to for this week. The mirror image marked the teams that slid. */
const BRK = M.brk || null;
let _brk = null;
function breakoutAll(){
  if (_brk !== null) return _brk || null;
  const wk = BRK && BRK.wk && BRK.wk[String(M.through)]; if (!wk){ _brk = false; return null; }
  const rows = T.filter(t => t.ats.avg != null && t.d.pe != null && t.d.lk).map(t => ({t, cover: t.ats.avg, pre: t.d.pe, luck: t.d.lk.fum + t.d.lk.int}));
  if (rows.length < 40){ _brk = false; return null; }
  const zf = key => { const v = rows.map(r => r[key]), mu = mean(v), sd = sdev(v) || 1; rows.forEach(r => { r['z_'+key] = (r[key]-mu)/sd; }); };
  zf('cover'); zf('pre'); zf('luck');
  [...rows].sort((a,b) => b.pre - a.pre).forEach((r,i) => { r.preRank = i+1; });
  rows.forEach(r => { r.a = -r.z_cover; r.b = r.z_pre - r.t.cz; r.c = -r.z_luck; r.score = wk.c[0]*r.a + wk.c[1]*r.b + wk.c[2]*r.c; });
  rows.sort((a,b) => b.score - a.score).forEach((r,i) => { r.rank = i+1; });
  const tenth = Math.max(5, Math.round(rows.length/10));
  rows.forEach(r => { r.band = r.rank <= tenth ? 'up' : r.rank > rows.length - tenth ? 'down' : ''; });
  return _brk = {wk, rows, tenth, by: new Map(rows.map(r => [r.t, r]))};
}
function breakoutWhy(r, wk){   // the reasons a team is on the list: only the ones pushing that way, strongest first
  const dir = r.band === 'down' ? -1 : 1;
  const bits = [[wk.c[0]*r.a, `${r.t.ats.avg >= 0 ? 'covering' : 'missing the spread'} by ${Math.abs(r.t.ats.avg).toFixed(1)} a game`],
    [wk.c[1]*r.b, `${ord(r.preRank)} in preseason ratings, ${ord(r.t.rank)} in LTF now`],
    [wk.c[2]*r.c, `${(4.5*Math.abs(r.luck)).toFixed(1)} points a game of ${r.luck > 0 ? 'good' : 'bad'} turnover luck`]];
  const on = bits.filter(x => dir*x[0] > .15).sort((x,y) => dir*(y[0]-x[0])).map(x => x[1]);
  return on.length ? on : [bits.sort((x,y) => dir*(y[0]-x[0]))[0][1]];
}
function breakoutPanels(scope){
  const B = breakoutAll(); if (!B) return '';
  const inScope = B.rows.filter(r => scope.includes(r.t)), up = inScope.filter(r => r.band === 'up').slice(0, 8), dn = inScope.filter(r => r.band === 'down').reverse().slice(0, 8), w = B.wk;
  if (!up.length && !dn.length) return '';
  const li = r => `<li class="two"><span><span class="l1"><span class="who">${badge(r.t,'sm')} ${tl(r.t)} <span class="cf">${r.t.w}-${r.t.l}, No. ${r.t.rank}</span></span></span><span class="sub2">${breakoutWhy(r, w).map(up1).join('. ')}.</span></span></li>`;
  return `<section class="sec"><h2>Likely to climb, likely to slide</h2>
    <p class="pdek">Momentum does not predict what comes next. These three things have: failing to cover the spread, a much higher rating before the season, and bad turnover luck. Teams with all three working against them tend to be better than they have looked, and the reverse holds for teams riding all three.</p>
    <div class="facts">${fact(`Top tenth after week ${M.through}, past seasons`, signed(w.top.climb, 1) + ' spots', `LTF rank by season's end. ${w.top.up10}% gained 10 or more`)}
      ${fact('Bottom tenth', signed(w.bottom.climb, 1) + ' spots', `${w.bottom.down10}% lost 10 or more`)}
      ${fact('A typical team', w.base10 + '%', 'gained 10 or more spots')}
      ${fact('Against the spread afterward', w.top.cover + '%', 'for the top tenth. The market is not fooled')}</div>
    <div class="panels">
      <section class="panel"><h2>Likely to climb</h2><p class="hint">The LTF Index is probably too low on these teams.</p><ol class="rows">${up.map(li).join('') || '<li class="two">No team in this group is on the list.</li>'}</ol></section>
      <section class="panel"><h2>Likely to slide</h2><p class="hint">Results have run ahead of what past seasons say will last.</p><ol class="rows">${dn.map(li).join('') || '<li class="two">No team in this group is on the list.</li>'}</ol></section>
    </div>
    <p class="hint after">From ${BRK.seasons}, ${w.n} team-seasons measured after week ${M.through}, checked against a longer run back to 2014. The list is the top and bottom tenth of all FBS teams. It fades by midseason, so it comes down after week 7. It is a read on the rankings and not a betting angle.</p></section>`;
}
const up1 = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ================= the momentum page ================= */
const MOM_SIG = {trend3:'Rating rising over three weeks', form2:'Playing better in the last two games', last1:'Played better last game', wstreak:'Longer winning streak',
  cstreak:'Longer streak of covers', ats3:'Beating the spread by more lately', lastcm:'Beat the spread by more last week', ups3:'More upset wins in the last three', prog:'Program on the rise since last season'};
function viewMomentum(){
  const q = findText(), s = sortState('mom');
  const BO = breakoutAll();
  const title = 'Momentum', dek = `<b>${groupLabel()}.</b> Who is heating up and who is cooling off: the rating trend, recent play, streaks, upsets and covers. Momentum is tracked here for the story. It is not part of the LTF Index, because twelve past seasons say it does not predict the next game.${breakoutAll() ? ' Further down is what has predicted it: the teams likely to climb or slide from here.' : ''}`;
  let rows = T.filter(t => inGroup(t) && t.g.length).map(momentum);
  if (!rows.length) return {title, controls:true, top: pageTop(title, 'Who is heating up and who is cooling off.'), body:'<p class="empty">Momentum shows up once teams have played.</p>'};
  const val = m => s.key==='mom' ? m.score : s.key==='idx' ? -m.t.rank : s.key==='idx3' ? (m.idx3 ?? -99) : s.key==='rk3' ? (m.rk3 ?? -999) : s.key==='play' ? (m.play ?? -99) : s.key==='streak' ? m.streak
    : s.key==='ats3' ? (m.cov - m.miss) + m.cov/100 : s.key==='ups' ? m.upSeason : s.key==='prog' ? (m.prog ?? -999) : s.key==='out' ? (BO && BO.by.get(m.t) ? BO.by.get(m.t).score : -99) : 0;
  if (s.key==='team') rows.sort((a,b) => s.dir*-1*a.t.n.localeCompare(b.t.n)); else rows.sort((a,b) => s.dir*(val(a)-val(b)) || a.t.rank-b.t.rank);
  const scoped = [...rows].sort((a,b) => b.score-a.score); if (q) rows = rows.filter(m => m.t.n.toLowerCase().includes(q));
  const li = m => rowB(m.t, m.t.rank, `${momTag(m)}`);
  const withProg = scoped.filter(m => m.prog != null).sort((a,b) => b.prog-a.prog);
  const pli = m => rowB(m.t, m.t.rank, `<span class="cf">No. ${m.t.d.ly} last season,</span> ${moveWords(m.prog)}`);
  const heat = (v, max, txt) => v == null ? '<td class="num wide">–</td>' : `<td class="num wide c ${v>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(v)/max).toFixed(2)}">${txt}</td>`;
  const body = rows.map(m => { const t = m.t;
    return `<tr>${teamCell(t)}<td class="num wide">${t.rank}</td><td class="num">${t.w}-${t.l}</td>
      <td class="num c ${m.score>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(m.score)/8).toFixed(2)}">${momNum(m)} <span class="cf wide">${momLabel(m.score)}</span></td>
      ${heat(m.idx3, 8, m.idx3 == null ? '' : fix1(m.idx3))}
      <td class="num wide">${m.rk3 == null ? '–' : moveWords(m.rk3)}</td>
      ${heat(m.play, 30, m.play == null ? '' : `${Math.round(m.last2)} <span class="cf">was ${Math.round(m.before)}</span>`)}
      <td class="num">${streakShort(m.streak)}</td><td class="num wide">${ats3Txt(m)}</td><td class="num wide">${m.upSeason || '–'}</td>
      <td class="num wide">${m.prog == null ? '–' : `<span class="cf">${t.d.ly},</span> ${moveWords(m.prog)}`}</td>
      ${BO ? (b => !b ? '<td class="num wide">–</td>' : `<td class="num wide c ${b.score>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(b.score)/3).toFixed(2)}">${fix1(b.score)}${b.band ? ` <span class="cf">${b.band === 'up' ? 'climb' : 'slide'}</span>` : ''}</td>`)(BO.by.get(t)) : ''}</tr>`; }).join('');
  const nextOf = t => t.sched.find(e => !e.game.done);
  const spotRows = scoped.filter(m => m.spot && nextOf(m.t)).sort((a,b) => a.t.rank-b.t.rank);
  const spotLi = m => { const e = m.spot.e, ne = nextOf(m.t);
    return `<li class="two"><span><span class="l1"><span class="who">${badge(m.t,'sm')} ${tl(m.t)} <span class="cf">${m.t.w}-${m.t.l}, No. ${m.t.rank}</span></span><span class="meta">${m.spot.k === 'bounce' ? 'Bounce-back spot' : 'Off an upset win'}</span></span>
      <span class="sub2">${m.spot.k === 'bounce' ? `Lost to ${esc(e.opp)} as ${favTxt(e)}` : `Beat ${esc(e.opp)} as ${dogTxt(e)}`}. Next: <a class="txt" href="${gameL(ne.game)}">${ne.site==='A'?'at':'vs'} ${esc(ne.opp)}, week ${ne.wk}</a></span></span></li>`; };
  const sig = !MOM ? '' : MOM.sig.map(x => `<tr><td>${MOM_SIG[x.k] || x.k}</td><td class="num wide">${x.n.toLocaleString()}</td><td class="num">${x.ats.toFixed(1)}%</td><td class="num">${x.top.toFixed(1)}%</td></tr>`).join('');
  const study = !MOM ? '' : `<section class="sec"><h2>Does momentum predict anything?</h2>
      <p class="pdek">Not in a way that helps. Every FBS game from ${MOM.seasons} was checked, ${MOM.games.toLocaleString()} in all, to see whether the team with more momentum did better than the ratings and the betting line already expected.</p>
      <div class="facts">${fact('Covered after beating the spread by 10 or more', MOM.carry.hot + '%', `${MOM.carry.hotN.toLocaleString()} games. A coin flip is 50%`)}
        ${fact('Covered after missing the spread by 10 or more', MOM.carry.cold + '%', `${MOM.carry.coldN.toLocaleString()} games`)}
        ${fact('LTF favorites on a hot stretch', MOM.fav.hot.act + '%', `won, when LTF expected ${MOM.fav.hot.pred}%`)}
        ${fact('LTF favorites on a cold stretch', MOM.fav.cold.act + '%', `won, when LTF expected ${MOM.fav.cold.pred}%`)}
        ${fact('Gain from adding momentum to the LTF line', MOM.fix.gain.toFixed(2) + ' pts', `off an average miss of ${BT.miss} points`)}</div>
      <h3>Backing the team with more momentum, against the spread</h3><p class="hint">"Covered" is how often the team with more of that kind of momentum beat the spread. "Strongest fifth" is the same thing for the one game in five where the gap in momentum was widest.</p>
      <div class="scroll"><table class="grid"><thead><tr><th>Kind of momentum</th><th class="num wide">Games</th><th class="num">Covered</th><th class="num">Strongest fifth</th></tr></thead><tbody>${sig}</tbody></table></div>
      <p class="hint after">A bettor needs about 52.4% to break even. No kind of momentum gets there across all games. The strongest cases land anywhere from 47% to 53% with no pattern, which is what chance looks like at these sample sizes.</p></section>`;
  const hot = scoped[0], cold = scoped[scoped.length - 1];
  return {title, controls:true, lead: hot && cold && hot !== cold ? `Hottest${groupKey() === 'all' ? '' : ` in the ${esc(groupLabel())}`}: ${tl(hot.t)}, ${fix1(hot.score)}. Coldest: ${tl(cold.t)}, ${fix1(cold.score)}. The scale runs from minus 10 to plus 10.` : '', top: pageTop(title, dek),
    body: `<div class="panels">
      <section class="panel"><h2>Heating up</h2><p class="hint">The highest momentum scores right now.</p><ol class="rows">${scoped.slice(0,6).map(li).join('')}</ol></section>
      <section class="panel"><h2>Cooling off</h2><p class="hint">The lowest momentum scores right now.</p><ol class="rows">${scoped.slice(-6).reverse().map(li).join('')}</ol></section>
      ${withProg.length ? `<section class="panel"><h2>Programs on the rise</h2><p class="hint">LTF rank today against last season's finish.</p><ol class="rows">${withProg.slice(0,5).map(pli).join('')}</ol></section>
      <section class="panel"><h2>Programs sliding back</h2><p class="hint">The biggest drops from last season's finish.</p><ol class="rows">${withProg.slice(-5).reverse().map(pli).join('')}</ol></section>` : ''}
      ${spotRows.length ? `<section class="panel full"><h2>Spots to watch</h2><p class="hint">Teams coming off an upset where the spread was a touchdown or more.${MOM ? ` After an upset loss, LTF has been about ${Math.abs(MOM.upL.ltf).toFixed(0)} points too low on the team the next week. After an upset win there was no letdown to speak of.` : ''}</p><ol class="rows">${spotRows.map(spotLi).join('')}</ol></section>` : ''}
    </div>
    ${breakoutPanels(scoped.map(m => m.t))}
    <section class="sec"><h2>Every team</h2>${colKey([['Momentum', 'From minus 10 to plus 10. Zero is a team holding steady.'], ['LTF Index, 3 weeks', 'Change in the LTF Index over the last three weeks.', true], ['Rank, 3 weeks', 'Spots gained or lost over the same stretch.', true],
        ['Last two games', 'Average game score of the last two games, and of the games before them.', true], ['Streak', 'Wins or losses in a row.'], ['ATS, last 3', 'Record against the spread in the last three games.', true], ['Upset wins', 'Wins this season as an underdog of 3 or more.', true], ['Since last season', 'Where they finished last season, and how far they have moved.', true], BO ? ['Outlook', 'Points a game the LTF Index may be too low on a team (plus) or too high (minus), from the three things above.', true] : null])}
      <div class="scroll"><table class="grid"><thead><tr>${sortTh('team','Team','','mom')}${sortTh('idx','LTF rank','num wide','mom','ltfrank')}${th('Record','num','rec')}${sortTh('mom','Momentum','num','mom','mom')}${sortTh('idx3','LTF Index, 3 weeks','num wide','mom','mtrend')}${sortTh('rk3','Rank, 3 weeks','num wide','mom')}${sortTh('play','Last two games','num wide','mom','mplay')}${sortTh('streak','Streak','num','mom','mstreak')}${sortTh('ats3','ATS, last 3','num wide','mom','mats')}${sortTh('ups','Upset wins','num wide','mom','mups')}${sortTh('prog','Since last season','num wide','mom','mprog')}${BO ? sortTh('out','Outlook','num wide','mom','mout') : ''}</tr></thead><tbody>${body || emptyRow(BO ? 12 : 11,'team')}</tbody></table></div></section>
    ${study}
    <div class="note"><p><b>How the momentum score is built.</b> Three parts, each compared with every other FBS team: the change in LTF Index over three weeks (35%), how the last two games graded against the ones before (25%), and recent results (40%), which counts the current streak, upset wins and losses in the last three games, and covers in the last three. The blend is put on a scale from minus 10 to plus 10.</p>
      <p><b>Why it stays out of the rankings.</b> The LTF Index is rebuilt from every game each week, so a team that is playing better already rises. Adding a bonus for being hot would count the same thing twice. When that was tried on ${BT.seasons}, the LTF line got closer to the final margin by ${MOM ? MOM.fix.gain.toFixed(2) : 'under a tenth of'} points a game, which is nothing. Beating the spread one week said almost nothing about the next: the link between the two was ${MOM ? MOM.carry.corr.toFixed(2) : '0.02'} on a scale where 1 is a perfect match.</p>
      ${MOM ? `<p><b>The one thing worth watching.</b> The week after a team loses as a favorite of 7 or more, they have beaten the LTF line by ${MOM.upL.ltf.toFixed(1)} points on average (${MOM.upL.nl} games, and above zero in all ${NUMW[MOM.upL.yrs] || MOM.upL.yrs} seasons tested). That is the opposite of momentum: LTF marks a team down a little too far for one bad day. It is flagged on game pages as a bounce-back spot. It is not a betting angle, because the market had already adjusted and those teams covered ${MOM.upL.ats}% of the time.</p>` : ''}
      <p><b>Program trend.</b> "Since last season" compares the LTF rank today with where the team finished ${M.prior ? 'the ' + M.prior + ' season' : 'last season'} by power rating. Programs that rose the year before did not beat the spread more often the next year either.</p></div>`};
}
