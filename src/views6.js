/* ================= league strength ================= */
/* How the leagues have done against each other this season, what the index does with that, and a standing check on
   whether the index has leaned for or against any league. Everything on this page is worked out from this season's
   games, except the tables marked as past seasons, which come from the twelve-season rebuild (research/backtest_site.py). */
let _lg = null;
const leagueOf = t => t.n === 'Notre Dame' ? 'Notre Dame' : t.c === 'Independent' ? 'Independents' : t.c;
const isPower = t => t.tier === 'P4';
function leagueData(){
  if (_lg) return _lg;
  const mk = () => ({n:0, w:0, l:0, pts:0}), add = (o, m) => { o.n++; o.pts += m; if (m > 0) o.w++; else if (m < 0) o.l++; };
  const L = {}, get = t => L[leagueOf(t)] || (L[leagueOf(t)] = {name: leagueOf(t), power: isPower(t), teams: T.filter(q => leagueOf(q) === leagueOf(t)), vsPower: mk(), vsOther: mk(), pair: {}, lean: mk(), beat: 0});
  T.forEach(get);
  const cross = mk(), short = mk();
  for (const g of G){
    if (!g.done) continue;
    const h = byName[g.h], a = byName[g.a]; if (!h || !a) continue;
    const mar = g.hp - g.ap, x = gameLine(g);
    if (isPower(h) !== isPower(a)){ const s = isPower(h) ? 1 : -1; add(cross, s*mar); if (x) add(short, s*(mar - x.m)); }
    if (leagueOf(h) === leagueOf(a)) continue;
    for (const [t, o, m] of [[h, a, mar], [a, h, -mar]]){
      const me = get(t); add(isPower(o) ? me.vsPower : me.vsOther, m);
      add(me.pair[leagueOf(o)] || (me.pair[leagueOf(o)] = mk()), m);
      if (x && isPower(t) && isPower(o)){ const e = m - (t === h ? x.m : -x.m); add(me.lean, e); if (e > 0) me.beat++; }
    }
  }
  const all = Object.values(L).map(q => ({...q, top25: q.teams.filter(t => t.rank <= 25).length, ap25: q.teams.filter(t => t.d.apr).length, best: [...q.teams].sort((x,y) => x.rank-y.rank)[0]}));
  return _lg = {power: all.filter(q => q.power).sort((x,y) => (y.vsPower.w - y.vsPower.l) - (x.vsPower.w - x.vsPower.l) || y.vsPower.pts - x.vsPower.pts), other: all.filter(q => !q.power).sort((x,y) => x.best.rank - y.best.rank), cross, short};
}
const wlTxt = o => o.n ? `${o.w}-${o.l}` : '–';
const avgTxt = (o, d=1) => { if (!o.n) return '–'; const v = +(o.pts/o.n).toFixed(d); return v === 0 ? 'even' : signed(v, d); };
function viewLeagues(){
  const D_ = leagueData(), P = D_.power, cr = D_.cross, lv = M.leagues || {tier:0, league:{}}, C = M.lgc && M.lgc.lean ? M.lgc : null;
  const real = P.filter(q => q.name !== 'Notre Dame'), top = real[0];
  const heat = (o, max) => !o.n ? '<td class="num">–</td>' : `<td class="num c ${o.pts>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(o.pts/o.n)/max).toFixed(2)}">${avgTxt(o)}</td>`;
  const lname = q => confByName[q.name] ? `<a class="tlink" href="${confL(confByName[q.name])}">${esc(q.name)}</a>` : q.name === 'Notre Dame' ? tl(byName['Notre Dame']) : confByName['Independent'] ? `<a class="tlink" href="${confL(confByName['Independent'])}">Other independents</a>` : esc(q.name);
  const prow = q => `<tr><td class="cn">${lname(q)}</td><td class="num">${wlTxt(q.vsPower)}</td>${heat(q.vsPower, 14)}<td class="num">${wlTxt(q.vsOther)}</td>${heat(q.vsOther, 30)}<td class="num">${q.top25}</td>${M.apWeek != null ? `<td class="num wide">${q.ap25}</td>` : ''}</tr>`;
  const names = real.map(q => q.name).sort();
  const matrix = `<div class="scroll"><table class="grid"><thead><tr><th>Record against</th>${names.map(n => `<th class="num">${esc(n)}</th>`).join('')}</tr></thead><tbody>${names.map(r => { const q = P.find(z => z.name === r);
    return `<tr><th scope="row" class="cn">${esc(r)}</th>${names.map(c => r === c ? '<td class="num"><span class="cf">–</span></td>' : `<td class="num">${q.pair[c] ? `${wlTxt(q.pair[c])} <span class="cf">${avgTxt(q.pair[c], 0)}</span>` : '<span class="cf">none yet</span>'}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
  const orow = q => `<tr><td class="cn">${lname(q)}</td><td class="num">${wlTxt(q.vsPower)}</td>${heat(q.vsPower, 30)}<td class="num">${wlTxt(q.vsOther)}</td>${heat(q.vsOther, 14)}<td class="wide">${tl(q.best)} <span class="cf">No. ${q.best.rank}</span></td></tr>`;
  const lvl = v => v == null ? '–' : Math.abs(v) < 0.05 ? 'Even' : signed(v, 1);
  const lrow = (q, base) => { const v = lv.league[q.name]; return q.name === 'Notre Dame' || q.name === 'Independents' ? '' : `<tr><td class="cn">${lname(q)}</td><td class="num c ${(v||0)>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(v||0)/3).toFixed(2)}">${lvl(v)}</td><td class="num wide">${signed((v||0) + base, 1)}</td></tr>`; };
  const leanNow = P.filter(q => q.lean.n).map(q => `<tr><td class="cn">${esc(q.name)}</td><td class="num">${q.lean.n}</td><td class="num c ${q.lean.pts>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(q.lean.pts/q.lean.n)/14).toFixed(2)}">${avgTxt(q.lean)}</td><td class="num wide">${q.beat} of ${q.lean.n}</td></tr>`).join('');
  const recOf = n => C ? C.rec.find(r => r.lg === n) : null;
  const leanPast = !C ? '' : C.lean.map(q => { const r = recOf(q.lg), flag = Math.abs(q.by) >= 2*q.se && Math.abs(q.by) >= 3;
    return `<tr><td class="cn">${esc(q.lg)}${flag ? ' <span class="tag o">Flagged</span>' : ''}</td><td class="num">${q.n}</td><td class="num c ${q.by>=0?'pos':'neg'}" style="--t:${Math.min(1, Math.abs(q.by)/8).toFixed(2)}"><b>${signed(q.by, 1)}</b></td><td class="num wide">±${q.se.toFixed(1)}</td><td class="num wide">${q.beat} of ${q.n}</td><td class="num">${r ? `${r.w}-${r.l}` : ''}</td><td class="num wide">${r ? signed(r.by, 1) : ''}</td></tr>`; }).join('');
  const pastLg = n => C && C.lean.find(q => q.lg === n);
  const b12 = pastLg('Big 12'), acc = pastLg('ACC'), sec = pastLg('SEC'), nd = pastLg('Notre Dame');
  const pairTxt = (a, b) => { const p = C && C.pairs.find(q => q.a === a && q.b === b); return p ? `${p.w}-${p.l}` : ''; };
  const t25 = C && C.top25 ? Object.entries(C.top25).sort((x,y) => y[1]-x[1]).map(([k,v]) => `${v.toFixed(1)} from ${k === 'Other' ? 'every other league combined' : k === 'Notre Dame' ? k : 'the ' + k}`) : null;
  const lead = cr.n ? `Power-league teams are ${cr.w}-${cr.l} against everyone else this season, by ${Math.abs(cr.pts/cr.n).toFixed(1)} points a game.${top && top.vsPower.n ? ` Among the power leagues, the ${esc(top.name)} has the best record against the others, ${wlTxt(top.vsPower)}.` : ''}` : '';
  return {title:'League strength', lead, card:'conferences',
    top: pageTop('League strength', `How the leagues have done against each other this season, what the LTF Index does with that, and a standing check on whether it has played favorites. Nothing here comes from reputation. A league is as strong as its results against the others say.`),
    body: `<section class="sec"><h2>League against league, this season</h2><p class="hint">Games between FBS teams from different leagues, through week ${M.through}. The margin is the average, per game. Notre Dame is counted with the power leagues.</p>
      <div class="scroll"><table class="grid"><thead><tr><th>Power leagues</th><th class="num">Against the other power leagues</th><th class="num">Margin</th><th class="num">Against everyone else</th><th class="num">Margin</th>${th('LTF top 25','num')}${M.apWeek != null ? th('AP top 25','num wide','apr') : ''}</tr></thead><tbody>${P.map(prow).join('')}</tbody></table></div>
      <h3>Head to head</h3><p class="hint">The row league's record against the column league, with the average margin beside it.</p>${matrix}
      <h3>Everyone else</h3><div class="scroll"><table class="grid"><thead><tr><th>League</th><th class="num">Against the power leagues</th><th class="num">Margin</th><th class="num">Against the other leagues here</th><th class="num">Margin</th><th class="wide">Best team</th></tr></thead><tbody>${D_.other.map(orow).join('')}</tbody></table></div></section>
    <section class="sec prose"><h2>What LTF does with it</h2>
      <p>By October most teams have played only one or two games outside their league, so a team's own results cannot say much about how their league stacks up. The leagues' combined results can. The LTF Index reads them in two levels.</p>
      <p><b>Level one: the power leagues and everyone else.</b> These two groups have met ${cr.n} times this season, so the gap between them is measured well and LTF takes it nearly in full. In the scoring-margin part of the score, that gap is worth ${Math.abs(lv.tier).toFixed(1)} points a game right now.</p>
      <p><b>Level two: one league against another in the same group.</b> Those meetings are far fewer, a handful per pairing, so this level is held very firmly. A league only gets credit over another when this season's games between them clearly call for it. The table shows how much each league has earned so far.</p></section>
    <section class="sec"><h2>League levels this season</h2><p class="hint">From the scoring-margin part of the LTF Index, in points a game. The first column is level two: the league against the others in its own group. The second column adds level one, the gap between the two groups.</p>
      <div class="dgrid"><div class="scroll"><table class="grid"><thead><tr><th>Power leagues</th><th class="num">Against their group</th><th class="num wide">Against the other group</th></tr></thead><tbody>${[...P].sort((x,y) => (lv.league[y.name]||0) - (lv.league[x.name]||0)).map(q => lrow(q, lv.tier)).join('')}</tbody></table></div>
      <div class="scroll"><table class="grid"><thead><tr><th>Everyone else</th><th class="num">Against their group</th><th class="num wide">Against the power group</th></tr></thead><tbody>${[...D_.other].sort((x,y) => (lv.league[y.name]||0) - (lv.league[x.name]||0)).map(q => lrow(q, -lv.tier)).join('')}</tbody></table></div></div>
      <p class="hint after">A league level is a starting point, not a ceiling. Each team's own games move them above or below their league, and by November their own results carry most of the weight.</p></section>
    <section class="sec"><h2>The league check: does LTF play favorites?</h2>
      <p class="pdek">Every time teams from two different power leagues meet, the result is compared with the LTF line from before kickoff. If LTF were too high on a league, that league's teams would keep falling short of the line. If it were too low, they would keep beating it.</p>
      <h3>This season</h3>${leanNow ? `<div class="scroll"><table class="grid"><thead><tr><th>League</th><th class="num">Games with an LTF line</th><th class="num">Beat the LTF line by</th><th class="num wide">Beat it in</th></tr></thead><tbody>${leanNow}</tbody></table></div>
        <p class="hint after">Plus means the league's teams did better than LTF expected. LTF sets no line until week 3, and a handful of games proves nothing, so read this as a running tally.${D_.short.n ? ` In the ${D_.short.n} games between a power-league team and a team from another league, the LTF line has ${D_.short.pts >= 0 ? 'fallen short of' : 'overshot'} the real gap by ${Math.abs(D_.short.pts/D_.short.n).toFixed(1)} points.` : ''}</p>` : '<p class="hint">No games between two power leagues have had an LTF line yet this season.</p>'}
      ${C ? `<h3>Past seasons, ${C.seasons}</h3><p class="hint">The same check on the LTF Index rebuilt week by week for twelve seasons: ${C.pp.n} games between two power leagues with an LTF line. The last two columns are every regular-season game between power leagues in those years.</p>
      <div class="scroll"><table class="grid"><thead><tr><th>League</th><th class="num">Games</th><th class="num">Beat the LTF line by</th><th class="num wide">Give or take</th><th class="num wide">Beat it in</th><th class="num">Record against the other power leagues</th><th class="num wide">Margin</th></tr></thead><tbody>${leanPast}</tbody></table></div>
      <div class="note">${sec ? `<p><b>The SEC.</b> LTF has had the SEC about right: ${Math.abs(sec.by) < 0.05 ? 'dead even' : signed(sec.by, 1) + ' points'} across ${sec.n} games. Over these seasons the SEC is ${recOf('SEC').w}-${recOf('SEC').l} against the other power leagues. Most of that edge is the ACC (${pairTxt('SEC', 'ACC')}). They are ${pairTxt('SEC', 'Big 12')} against the Big 12 and ${pairTxt('SEC', 'Big Ten')} against the Big Ten.</p>` : ''}
        ${b12 ? `<p><b>Flagged: the Big 12, rated too low.</b> Big 12 teams have beaten the LTF line by ${b12.by.toFixed(1)} points a game against the other power leagues, in ${b12.beat} of ${b12.n} games.${C.b12Early ? ` ${C.b12Early} of those ${b12.n} were played in weeks 3 and 4.` : ''} LTF has been too low on Big 12 teams in September. League strength cannot fix it, because the Big 12 plays only a few of these games a year, and no fix that uses this season's games alone has been found yet. It stays flagged here until one is.</p>` : ''}
        ${acc ? `<p><b>Flagged: the ACC, rated too high.</b> ACC teams have fallen short of the LTF line by ${Math.abs(acc.by).toFixed(1)} points across ${acc.n} games, so LTF has had the ACC a little too high, not too low.${nd ? ` More than a third of those games were against Notre Dame, who beat the line by ${nd.by.toFixed(1)} across their ${nd.n}, nearly all of them against ACC teams. The two flags are largely the same games seen from both sides.` : ''}</p>` : ''}
        <p><b>Power leagues against everyone else.</b> In ${C.cross.n.toLocaleString()} past games the power-league team won ${f1(C.cross.won)}% of the time, by ${C.cross.by} points on average, and the LTF line fell short of that gap by ${f1(C.cross.short)} points.${C.cross.before != null ? ` With league strength switched off, it fell short by ${f1(C.cross.before)}.` : ''}</p>
        <p class="hint">A league is flagged when its teams have missed the line by 3 points or more and by at least twice the give or take. The Pac-12 is counted as a power league through 2023.</p></div>` : ''}</section>
    ${t25 ? `<section class="sec prose"><h2>Who fills the top 25</h2><p>This week the LTF top 25 has ${list(P.filter(q => q.top25).sort((x,y) => y.top25-x.top25).map(q => `${q.top25} from ${q.name === 'Notre Dame' ? 'Notre Dame' : 'the ' + esc(q.name)}`))}${D_.other.some(q => q.top25) ? `, and ${D_.other.reduce((s,q) => s + q.top25, 0)} from outside the power leagues` : ', and none from outside the power leagues'}. Across ${C.seasons}, the top 25 after week 13 averaged ${list(t25)}.</p>
      <p>The count for any one league moves with the season. A league that wins its games against the others in September earns more places, and one that loses them earns fewer. </p><p class="next"><a class="txt" href="${L('rankings')}">The full rankings</a> &nbsp; <a class="txt" href="${L('conferences')}">Conference averages</a></p></section>` : ''}`};
}

/* ================= what goes in, and what stays out ================= */
function viewInputs(){
  const row = (a, b) => `<tr><td class="cn">${a}</td><td>${b}</td></tr>`;
  const was = BT.was, wk = BT.byWeek || [];
  return {title:'What goes in, and what stays out', lead: `This season's scores and play-by-play go in. Polls, preseason rankings, earlier seasons, betting lines and other people's ratings stay out.`,
    top: pageTop('What goes in, and what stays out', `The LTF Index has one rule: a team is judged on this season's games and nothing else. This page lists everything the score is built from, everything it leaves out on purpose, and what that rule costs.`),
    body: `<section class="sec prose"><h2>What goes in</h2><div class="tw"><table><thead><tr><th>From this season</th><th>How it is used</th></tr></thead><tbody>
      ${row('Final scores', 'Wins, losses and scoring margin for every game, including games against lower-division teams.')}
      ${row('Play-by-play', 'How well each offense and defense has played, down by down and drive by drive, with garbage time removed.')}
      ${row('The score at halftime', 'Who builds a lead before the game is decided, in games between FBS teams.')}
      ${row('Who played whom', 'Every number is adjusted for the opponent, so beating a good team counts for more than beating a bad one.')}
      ${row('Where the game was played', `Home field is worth ${M.hfa} points. A neutral site is worth nothing to either side.`)}
      ${row('Which league a team is in', `How each league has done against the others this season. The league a team plays in is a fact, and how strong that league is gets measured from this season's games. <a class="txt" href="${L('leagues')}">League strength</a>`)}
      </tbody></table></div></section>
    <section class="sec prose"><h2>What stays out</h2><div class="tw"><table><thead><tr><th>Left out of the score</th><th>Why</th></tr></thead><tbody>
      ${row('The AP and coaches polls', 'They are opinions, and they start from where teams were ranked before anyone played.')}
      ${row('Preseason rankings and predictions', 'A guess made in August is not something a team did.')}
      ${row('Earlier seasons', 'Last year\'s record, a program\'s history, and any rating that carries over from one year to the next. Every team starts level.')}
      ${row('Recruiting rankings and roster talent', 'They describe what a team might be. LTF goes by what a team has been.')}
      ${row('Betting lines and odds', 'A line is a prediction about a game. It is not a result.')}
      ${row('Other rating systems', 'SP+, FPI and the rest have their own ingredients, and most of them remember earlier seasons.')}
      ${row('The name on the helmet', 'Television deals, tradition and the size of the fan base do not score points.')}
      </tbody></table></div>
      <p class="hint after">Two things LTF would use if it could see them, but cannot: injuries and lineup changes. They are not in the play-by-play until they show up as results.</p></section>
    <section class="sec prose"><h2>Where you will still see some of them</h2>
      <p>Three outside numbers appear on the site, next to the score and never inside it. The AP poll is on the <a class="txt" href="${L('radar')}">Under the radar</a> page and the <a class="txt" href="${L('upsets')}">upset watch</a>, to show where the voters and the results disagree. SP+ and FPI are on the <a class="txt" href="${L('scorecard')}">scorecard</a>, graded on the same games as LTF. A closing betting line is there too, for finished games only, as the hardest yardstick there is. The site shows no odds or lines for games still to be played.</p></section>
    <section class="sec"><h2>What the rule costs</h2>
      <p class="pdek">A system that remembers last year knows something on September 1. This one knows nothing until games are played, and it pays for that early in the season.</p>
      <div class="facts">${fact(`LTF, ${BT.seasons}`, f1(BT.su) + '%', `of winners picked, off by ${f1(BT.miss)} points a game`)}${fact('The betting line, same games', f1(BT.mktSu) + '%', `off by ${f1(BT.mktMiss)}. It knows about injuries and every earlier season`)}
        ${was ? fact('The formula before October 7', f1(was.su) + '%', `off by ${f1(was.miss)}. It leaned on ratings that carry earlier seasons`) : ''}</div>
      ${wk.length ? `<div class="scroll"><table class="grid"><thead><tr><th>Games played in</th><th class="num">LTF winners</th><th class="num">Betting line</th><th class="num">LTF miss</th><th class="num">Betting line</th><th class="num wide">Games</th></tr></thead><tbody>${wk.map(b => `<tr><td class="cn">${b.lab}</td><td class="num">${f1(b.su)}%</td><td class="num">${f1(b.mktSu)}%</td><td class="num">${f1(b.miss)}</td><td class="num">${f1(b.mktMiss)}</td><td class="num wide">${b.n.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint after">The gap is widest in the first weeks and is gone by November, when this season's games say all there is to say. That is the trade: a slower start, in return for rankings that owe nothing to reputation.</p>` : ''}
      <p class="next"><a class="txt" href="${L('how')}">How the LTF Index is built</a> &nbsp; <a class="txt" href="${L('weights')}">Build your own rankings</a> &nbsp; <a class="txt" href="${L('scorecard')}">Scorecard</a></p></section>`};
}
