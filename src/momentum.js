/* ================= momentum: shown for the story, never part of the LTF Index ================= */
/* Three things fans mean by momentum, each compared with the rest of the country: the rating trend over three weeks,
   how the last two games compare with the ones before, and recent results (the streak, and upsets either way).
   An upset is judged by the LTF line of the day: a win when LTF had the team as an underdog of 3 or more, or a loss when
   LTF had them as a favorite of 3 or more. Twelve past seasons say none of it predicts the next game once the index is
   counted (research/backtest_site.py), so it is here to read and it never moves a team in the rankings. */
const MOM = M.mom && M.mom.fix ? M.mom : null;
let _mom = null;
const MOM_W = {trend:.35, play:.25, res:.4};
const ltfSide = (t, e) => { const x = gameLine(e.game); return !x ? null : (e.game.h === t.n ? x.m : -x.m); };      // the LTF line before kickoff, from this team's side
function momentumAll(){
  if (_mom) return _mom;
  const won = e => e.pf > e.pa;
  const rows = T.map(t => {
    const hw = HW.filter(w => t.hist[w]), cur = hw[hw.length-1], back = hw[Math.max(0, hw.length-4)];
    const m = {t, idx3:null, rk3:null, from:null, wks:0, play:null, last2:null, before:null, streak:0, upW:[], upL:[], upSeason:0, res:null};
    if (hw.length >= 2){ m.idx3 = t.hist[cur].idx - t.hist[back].idx; m.rk3 = t.hist[back].rank - t.hist[cur].rank; m.from = t.hist[back].rank; m.wks = cur - back; }
    const gs = t.g.map(e => gameScore(t, e));
    if (gs.length >= 3){ m.last2 = mean(gs.slice(-2)); m.before = mean(gs.slice(0,-2)); m.play = m.last2 - m.before; }
    for (let i = t.g.length-1; i >= 0; i--){
      const w = won(t.g[i]);
      if (i === t.g.length-1) m.streak = w ? 1 : -1; else if (w === (m.streak > 0)) m.streak += w ? 1 : -1; else break;
    }
    const ups = t.g.map(e => { const ln = ltfSide(t, e); return ln == null ? null : won(e) && ln <= -3 ? {e, ln, k:'w'} : !won(e) && ln >= 3 ? {e, ln, k:'l'} : null; });
    ups.slice(-3).forEach(u => { if (u) (u.k === 'w' ? m.upW : m.upL).push(u); });
    m.upSeason = ups.filter(u => u && u.k === 'w').length;
    if (t.g.length) m.res = clamp(m.streak, -5, 5) + 1.5*(m.upW.length - m.upL.length);
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
const fix1 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);      // always one decimal, so a column of them lines up
const momNum = m => `<b class="mom ${momCls(m.score)}">${fix1(m.score)}</b>`;
const NUMW = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const momTag = m => `${momNum(m)} <span class="cf">${momLabel(m.score)}</span>`;
const streakTxt = (n, cap) => !n ? '–' : `${cap ? (n > 0 ? 'Won' : 'Lost') : (n > 0 ? 'won' : 'lost')} ${Math.abs(n) === 1 ? 'last time out' : (NUMW[Math.abs(n)] || Math.abs(n)) + ' straight'}`;
const streakShort = n => !n ? '–' : `<span class="${n >= 2 ? 'up' : n <= -2 ? 'down' : ''}">${n > 0 ? 'W' : 'L'}${Math.abs(n)}</span>`;
const dogTxt = u => `${anA(half(u.ln))} ${half(u.ln)}-point underdog`;       // "a 3.5-point underdog", "an 8-point underdog", by the LTF line
const favTxt = u => `${anA(half(u.ln))} ${half(u.ln)}-point favorite`;
function momWhy(t){   // the reasons behind a team's momentum, in a sentence or two
  const m = momentum(t), a = [], b = [];
  if (m.idx3 != null) a.push(Math.abs(m.idx3) < .5 ? `Their LTF Index has barely moved over the last ${m.wks === 1 ? 'week' : (NUMW[m.wks] || m.wks) + ' weeks'}`
    : `Their LTF Index is ${m.idx3 > 0 ? 'up' : 'down'} ${Math.abs(m.idx3).toFixed(1)} over the last ${m.wks === 1 ? 'week' : (NUMW[m.wks] || m.wks) + ' weeks'}${m.rk3 ? `, moving them from No. ${m.from} to No. ${t.rank}` : ''}`);
  if (m.play != null) a.push(`their last two games graded out at ${Math.round(m.last2)}, against ${Math.round(m.before)} before that`);
  const up = s => s.charAt(0).toUpperCase() + s.slice(1), lastG = t.g[t.g.length-1];
  const lastUp = [...m.upW, ...m.upL].some(u => u.e === lastG);      // the last game is already named as an upset, so do not say it twice
  if (m.streak && !(Math.abs(m.streak) === 1 && lastUp)) b.push(Math.abs(m.streak) === 1 ? `${m.streak > 0 ? 'won' : 'lost'} last time out` : `have ${m.streak > 0 ? 'won' : 'lost'} ${NUMW[Math.abs(m.streak)] || Math.abs(m.streak)} straight`);
  if (m.upW.length) b.push(`beat ${list(m.upW.map(u => `${esc(u.e.opp)} as ${dogTxt(u)}`))}`);
  if (m.upL.length) b.push(`lost to ${list(m.upL.map(u => `${esc(u.e.opp)} as ${favTxt(u)}`))}`);
  return [...a.map(s => up(s) + '.'), b.length ? 'They ' + list(b) + '.' : ''].filter(Boolean).join(' ');
}
/* both teams' momentum for a game page */
function momGame(g){
  const A = byName[g.a], B = byName[g.h]; if (!A || !B || g.done || !A.g.length || !B.g.length) return '';
  const a = momentum(A), b = momentum(B);
  const row = (label, x, y) => `<tr><td>${x}</td><th scope="row">${label}</th><td>${y}</td></tr>`;
  const chg = v => v == null ? '–' : `<span class="${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${fix1(v)}</span>`;
  const rk = m => m.rk3 == null ? '–' : !m.rk3 ? 'same spot' : `<span class="${m.rk3 > 0 ? 'up' : 'down'}">${m.rk3 > 0 ? 'up' : 'down'} ${Math.abs(m.rk3)}</span> <span class="cf">from No. ${m.from}</span>`;
  const play = m => m.play == null ? '–' : `${Math.round(m.last2)} <span class="cf">was ${Math.round(m.before)}</span>`;
  return `<section class="sec"><h2>Momentum coming in</h2>
    <p class="hint">How each team is trending. This is here for the story of the game and is not in the LTF line: over twelve past seasons, hot and cold stretches did not predict the next result. <a class="txt" href="${L('momentum')}">See the test</a></p>
    <div class="scroll"><table class="tape mo"><tbody>
      ${row(term('mom'), momTag(a), momTag(b))}
      ${row(term('mtrend', 'LTF Index, last three weeks'), chg(a.idx3), chg(b.idx3))}
      ${row('LTF rank, last three weeks', rk(a), rk(b))}
      ${row(term('mplay', 'Last two games'), play(a), play(b))}
      ${row('Streak', streakTxt(a.streak, true), streakTxt(b.streak, true))}
    </tbody></table></div></section>`;
}
const up1 = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ================= the momentum page ================= */
const trendCards = gk => { const s = gk === 'all' ? '' : ':' + gk; return [['momentum' + s, 'Momentum'], ['luck' + s, 'Luck'], ['movers', 'Biggest movers']]; };
function viewMomentum(){
  const q = findText(), s = sortState('mom');
  const title = 'Momentum', dek = `<b>${groupLabel()}.</b> Who is heating up and who is cooling off: the rating trend, recent play, streaks and upsets. Momentum is tracked here for the story. It is not part of the LTF Index, because twelve past seasons say it does not predict the next game.`;
  let rows = T.filter(t => inGroup(t) && t.g.length).map(momentum);
  if (!rows.length) return {title, controls:true, top: pageTop(title, 'Who is heating up and who is cooling off.'), body:'<p class="empty">Momentum shows up once teams have played.</p>'};
  const val = m => s.key==='mom' ? m.score : s.key==='idx' ? -m.t.rank : s.key==='idx3' ? (m.idx3 ?? -99) : s.key==='rk3' ? (m.rk3 ?? -999) : s.key==='play' ? (m.play ?? -99) : s.key==='streak' ? m.streak : s.key==='ups' ? m.upSeason : 0;
  if (s.key==='team') rows.sort((a,b) => s.dir*-1*a.t.n.localeCompare(b.t.n)); else rows.sort((a,b) => s.dir*(val(a)-val(b)) || a.t.rank-b.t.rank);
  const scoped = [...rows].sort((a,b) => b.score-a.score); if (q) rows = rows.filter(m => m.t.n.toLowerCase().includes(q));
  const li = m => rowB(m.t, m.t.rank, `${momTag(m)}`);
  const heat = (v, max, txt) => v == null ? '<td class="num wide">–</td>' : `<td class="num wide c ${v>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(v)/max).toFixed(2)}">${txt}</td>`;
  const body = rows.map(m => { const t = m.t;
    return `<tr>${teamCell(t)}<td class="num wide">${t.rank}</td><td class="num">${t.w}-${t.l}</td>
      <td class="num c ${m.score>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(m.score)/8).toFixed(2)}">${momNum(m)} <span class="cf wide">${momLabel(m.score)}</span></td>
      ${heat(m.idx3, 8, m.idx3 == null ? '' : fix1(m.idx3))}
      <td class="num wide">${m.rk3 == null ? '–' : moveWords(m.rk3)}</td>
      ${heat(m.play, 30, m.play == null ? '' : `${Math.round(m.last2)} <span class="cf">was ${Math.round(m.before)}</span>`)}
      <td class="num">${streakShort(m.streak)}</td><td class="num wide">${m.upSeason || '–'}</td></tr>`; }).join('');
  const upsets = scoped.flatMap(m => m.upW.map(u => ({m, u}))).sort((a,b) => a.u.ln - b.u.ln).slice(0, 6);
  const upLi = x => `<li class="two"><span><span class="l1"><span class="who">${badge(x.m.t,'sm')} ${tl(x.m.t)} <span class="cf">${x.m.t.w}-${x.m.t.l}, No. ${x.m.t.rank}</span></span><span class="meta">week ${x.u.e.wk}</span></span>
      <span class="sub2">Beat ${teamRef(x.u.e.opp)} ${scoreTxt(x.u.e)} as ${dogTxt(x.u)} by the LTF line. <a class="txt" href="${gameL(x.u.e.game)}">The game</a></span></span></li>`;
  const study = !MOM ? '' : `<section class="sec"><h2>Does momentum predict anything?</h2>
      <p class="pdek">Not in a way that helps. Every game between FBS teams from ${MOM.seasons} was checked, ${MOM.games.toLocaleString()} in all, to see whether the team with more momentum did better than the LTF line already expected.</p>
      <div class="facts">${fact('LTF favorites on a hot stretch', f1(MOM.fav.hot.act) + '%', `won, when LTF expected ${f1(MOM.fav.hot.pred)}%`)}
        ${fact('LTF favorites on a cold stretch', f1(MOM.fav.cold.act) + '%', `won, when LTF expected ${f1(MOM.fav.cold.pred)}%`)}
        ${fact('Gain from adding momentum to the LTF line', MOM.fix.gain.toFixed(2) + ' pts', `off an average miss of ${f1(BT.miss)} points`)}
        ${fact('After beating the LTF line by 14 or more', f1(MOM.carry.hot) + '%', `beat it again the next week. ${MOM.carry.hotN.toLocaleString()} games`)}
        ${fact('After missing it by 14 or more', f1(MOM.carry.cold) + '%', `beat it the next week. ${MOM.carry.coldN.toLocaleString()} games`)}</div>
      <p class="hint after">Hot favorites and cold favorites both won about as often as the LTF line said they would. Beating the line by two touchdowns one week meant little the next: those teams beat it again ${f1(MOM.carry.hot)}% of the time, where a coin flip is 50%. The week after losing as an LTF favorite of 7 or more, teams landed ${Math.abs(MOM.upL.ltf).toFixed(1)} points ${MOM.upL.ltf < 0 ? 'under' : 'over'} the LTF line on average across ${MOM.upL.n} games, which is no bounce-back and no hangover.</p></section>`;
  const hot = scoped[0], cold = scoped[scoped.length - 1];
  return {title, controls:true, card: 'momentum' + (groupKey() === 'all' ? '' : ':' + groupKey()), alts: trendCards(groupKey()), lead: hot && cold && hot !== cold ? `Hottest${groupKey() === 'all' ? '' : ` in the ${esc(groupLabel())}`}: ${tl(hot.t)}, ${fix1(hot.score)}. Coldest: ${tl(cold.t)}, ${fix1(cold.score)}. The scale runs from minus 10 to plus 10.` : '', top: pageTop(title, dek),
    body: `<div class="panels">
      <section class="panel"><h2>Heating up</h2><p class="hint">The highest momentum scores right now.</p><ol class="rows">${scoped.slice(0,6).map(li).join('')}</ol></section>
      <section class="panel"><h2>Cooling off</h2><p class="hint">The lowest momentum scores right now.</p><ol class="rows">${scoped.slice(-6).reverse().map(li).join('')}</ol></section>
      ${upsets.length ? `<section class="panel full"><h2>Biggest upsets in the last three games</h2><p class="hint">Wins by teams the LTF line had as underdogs, biggest first. <a class="txt" href="${L('upsets')}">This week's upset watch</a></p><ol class="rows">${upsets.map(upLi).join('')}</ol></section>` : ''}
    </div>
    <section class="sec"><h2>Every team</h2>${colKey([['Momentum', 'From minus 10 to plus 10. Zero is a team holding steady.'], ['LTF Index, 3 weeks', 'Change in the LTF Index over the last three weeks.', true], ['Rank, 3 weeks', 'Spots gained or lost over the same stretch.', true],
        ['Last two games', 'Average game score of the last two games, and of the games before them.', true], ['Streak', 'Wins or losses in a row.'], ['Upset wins', 'Wins this season when the LTF line had them as an underdog of 3 or more.', true]])}
      <div class="scroll"><table class="grid"><thead><tr>${sortTh('team','Team','','mom')}${sortTh('idx','LTF rank','num wide','mom','ltfrank')}${th('Record','num','rec')}${sortTh('mom','Momentum','num','mom','mom')}${sortTh('idx3','LTF Index, 3 weeks','num wide','mom','mtrend')}${sortTh('rk3','Rank, 3 weeks','num wide','mom')}${sortTh('play','Last two games','num wide','mom','mplay')}${sortTh('streak','Streak','num','mom','mstreak')}${sortTh('ups','Upset wins','num wide','mom','mups')}</tr></thead><tbody>${body || emptyRow(9,'team')}</tbody></table></div></section>
    ${study}
    <div class="note"><p><b>How the momentum score is built.</b> Three parts, each compared with every other FBS team: the change in LTF Index over three weeks (35%), how the last two games graded against the ones before (25%), and recent results (40%), which counts the current streak and upset wins and losses in the last three games. An upset is judged by the LTF line of the day. The blend is put on a scale from minus 10 to plus 10.</p>
      <p><b>Why it stays out of the rankings.</b> The LTF Index is rebuilt from every game each week, so a team that is playing better already rises. Adding a bonus for being hot would count the same thing twice.${MOM ? ` When that was tried on ${MOM.seasons}, the LTF line got closer to the final margin by ${MOM.fix.gain.toFixed(2)} points a game, which is nothing. How far a team beat the LTF line one week said almost nothing about the next: the link between the two was ${MOM.carry.corr.toFixed(2)} on a scale where 1 is a perfect match.` : ''}</p></div>`};
}
