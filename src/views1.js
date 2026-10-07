/* ================= shared pieces ================= */
const strip = (v,big) => `<span class="strip${big?' big':''}" style="--x:${v.toFixed(1)}%" role="img" aria-label="LTF Index ${v.toFixed(1)} out of 100"><i></i></span>`;

/* team marks: the logo where logos are switched on and load, otherwise the abbreviation on the team's color */
let LOGO_OK = false;                                   // set once a logo has actually loaded in this browser
const logosOn = () => LOGO_OK && !LOGOS_OFF && store.get('ltf.logos') !== false;
const darkNow = () => { const th = document.documentElement.dataset.theme; return th ? th === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); };
const chip = (t, size) => `<span class="bdg${size?' '+size:''}" style="--c:${esc(t.col)};--f:${t.fg}" aria-hidden="true"><b>${esc(t.ab)}</b></span>`;
const logoOf = (t, light) => (!logosOn() || t.lgBad || !t.lg) ? null : logoSrc(t, !light && darkNow() && !t.noDark);
const ON_WHITE = {md:1, xl:1, lgm:1};                  // sizes that sit on a white plate, so they always use the light-background logo
const badge = (t, size) => { const u = logoOf(t, ON_WHITE[size]); return u ? `<img class="lg${size?' '+size:''}" src="${u}" alt="" loading="lazy" decoding="async" data-t="${t.slug}" data-s="${size||''}">` : chip(t, size); };
const tl = t => `<a class="tlink" href="${teamL(t)}">${esc(t.n)}</a>`;
const teamRef = n => byName[n] ? tl(byName[n]) : esc(n);          // FCS teams have no page, so they stay plain text

/* definitions: a dotted word opens its meaning, and a column heading shows it when pointed at */
const term = (k, label) => `<button class="term" type="button" data-term="${k}">${label || GLOSS[k][0]}</button>`;
function tipHtml(key){
  const [k, side] = String(key).split(':'), g = GLOSS[k]; if (!g) return '';
  const s = STATS.find(x => x.k === k); let extra = '';
  if (s){ const f = side === 'd' ? s.d : (s.o || s.d), def = side === 'd' || !s.o;
    extra = `<span class="px">The average team: ${s.f(AVG[f])}. ${def ? (s.dHigh ? 'Higher is better.' : 'For a defense, lower is better.') : 'Higher is better.'}</span>`; }
  else if (k === 'net') extra = `<span class="px">The average team: 0. Higher is better.</span>`;
  return `<b>${g[0]}</b>${g[1]}${extra}`;
}
function sortTh(key, label, cls, defKey, tipKey){   // a column heading that sorts. The choice lives in the link.
  const cur = R.q.sort || defKey, asc = R.q.dir === 'asc', on = cur === key;
  return `<th class="${cls||''}"${on?` aria-sort="${asc?'ascending':'descending'}"`:''}><a data-keep href="${Lq({sort: key===defKey ? null : key, dir: on && !asc ? 'asc' : null})}"${tipKey ? ` data-tip="${tipKey}"` : ''}>${label}</a></th>`;
}
const th = (label, cls, tipKey) => `<th class="${cls||''}">${tipKey ? `<span data-tip="${tipKey}">${label}</span>` : label}</th>`;
const colKey = items => `<p class="key">${items.filter(Boolean).map(([label, text, wide]) => `<span${wide?' class="wide"':''}><b>${label}</b> ${text}</span>`).join('')}</p>`;
const sortState = defKey => ({key: R.q.sort || defKey, dir: R.q.dir === 'asc' ? 1 : -1});

const h2hText = x => `Lost ${scoreTxt(x.g)} ${x.g.site==='H'?'at home to':x.g.site==='A'?'at':'at a neutral site to'} ${x.g.opp} (${x.o?'No. '+x.o.rank:'FCS'}) in week ${x.g.wk}.`;
const h2hTag = t => !t.h2h.length ? '' : ` <span class="h2h" title="${esc(t.h2h.map(h2hText).join(' '))}">lost to ${t.h2h.map(x => x.o ? 'No. '+x.o.rank : 'an FCS team').join(', ')}</span>`;
const teamCell = (t, tag) => `<th scope="row" class="team"><a class="teambtn" href="${teamL(t)}">${badge(t)}<span><span class="tn">${esc(t.n)}</span> <span class="cf">${esc(t.c)}</span>${tag ? h2hTag(t) : ''}</span></a></th>`;
const mvTxt = t => !t.move ? '' : `<span class="mv ${t.move>0?'up':'down'}" title="${t.prevRank != null ? 'Was No. '+t.prevRank+' last week' : ''}">${t.move>0?'up':'down'} ${Math.abs(t.move)}</span>`;
const crumbs = items => `<nav class="crumbs" aria-label="Breadcrumb">${items.map((x,i) => (i ? '<span aria-hidden="true">/</span>' : '') + (x[1] ? `<a href="${x[1]}">${x[0]}</a>` : `<span>${x[0]}</span>`)).join('')}</nav>`;
const pageTop = (title, dek, trail) => `${trail ? crumbs(trail) : ''}<div class="phead"><h1 class="ptitle">${title}</h1><!--share--></div><!--lead-->${dek ? `<!--about--><p class="pdek">${dek}</p>` : ''}`;
/* A page can return three more things: `lead`, the takeaway in a sentence or two, shown before anything else. `card`, the
   picture its Share button offers, with `alts` for other shapes. With a lead in place, a phone tucks the "how to read this
   page" paragraph behind a link so the answer is what shows first. */
const fillTop = (top, v) => String(top || '')
  .replace('<!--share-->', v.card && CARDS[v.card.split(':')[0]] ? shareBtn(v.card, null, null, v.alts) : '')
  .replace('<!--lead-->', v.lead ? `<p class="plead">${v.lead}</p>` : '')
  .replace('<!--about-->', v.lead ? `<button type="button" class="pabout" data-about aria-expanded="false">About this page</button>` : '');
const rowB = (t, n, meta) => `<li class="b"><span class="pr">${n}</span>${badge(t,'sm')}<span>${tl(t)} <span class="cf">${t.w}-${t.l}</span></span><span class="meta">${meta}</span></li>`;
const metaIdx = t => `${t.prevRank != null ? `<span class="cf">was ${t.prevRank},</span> ${moveWords(t.move)}` : ''} <b class="mnum">${t.idx.toFixed(1)}</b>`;
const favs = () => { let a = store.get('ltf.favs'); if (!Array.isArray(a)){ const one = store.get('ltf.fav'); a = one ? [one] : []; } return a.map(sl => bySlug[sl]).filter(Boolean); };
const wl = gs => gs.length ? `${gs.filter(g => g.pf>g.pa).length}-${gs.filter(g => g.pf<g.pa).length}` : '–';
const nextGames = () => openGames(M.next);
const emptyRow = (span, what) => `<tr><td class="empty" colspan="${span}">No ${what} matches "${esc(R.q.find || '')}". Clear the search box or pick a different group.</td></tr>`;
const weekTabs = (weeks, wk, def, lab) => `<div class="weeks" role="group" aria-label="Week">${weeks.map(w => `<a data-keep href="${Lq({week: w === def ? null : w, sort:null, dir:null})}" aria-current="${w===wk}">Wk ${w}<small>${lab(w)}</small></a>`).join('')}</div>`;
const fact = (label, value, note) => `<div class="fact"><span>${label}</span><b>${value}</b>${note ? `<small>${note}</small>` : ''}</div>`;

/* ================= home ================= */
function viewHome(){
  const br = byRank(), a = br[0], b = br[1], gap = a.idx - b.idx;
  const lastGame = t => { const g = t.g[t.g.length-1]; return g ? `a ${scoreTxt(g)} ${g.pf>g.pa?'win over':'loss to'} ${esc(g.opp)}` : ''; };
  const head = a.prevRank && a.prevRank !== 1 ? `${esc(a.n)} takes over at No. 1` : gap >= 4 ? `${esc(a.n)} is No. 1, and it isn't close` : gap >= 1.5 ? `${esc(a.n)} stays on top` : `${esc(a.n)} leads ${esc(b.n)} by a hair`;
  const firsts = COMP.filter(c => a.rk[c.k] === 1).map(c => c.name.toLowerCase());
  const ne = a.sched.find(e => !e.game.done), npr = ne && gameLine(ne.game);
  const nextUp = !ne ? 'The regular season is done.' : !npr ? `Next up: ${esc(ne.opp)}.` : `Next up: ${byName[ne.opp].rank <= 25 ? 'No. '+byName[ne.opp].rank+' ' : ''}${esc(ne.opp)}, where the LTF line is ${npr.pts===0 ? "a pick 'em" : esc(npr.fav.n)+' by '+npr.pts}.`;
  const lead = `<section class="story" style="--tc:${esc(a.col)};--tf:${a.fg}" data-ab="${esc(a.ab)}">
      <p class="kick">${logosOn() ? badge(a,'md') : ''}LTF Index, after week ${M.through}</p><h1>${head}</h1>
      <p class="dek">${a.w}-${a.l}${firsts.length ? `, and first in the country in ${list(firsts)}` : ''}. ${esc(b.n)} is second, ${gap.toFixed(1)} points back. ${nextUp}</p>
      <div class="nums"><div><b>${a.idx.toFixed(1)}</b><span>LTF Index</span></div>${COMP.slice(0,3).map(c => `<div><b>${ord(a.rk[c.k])}</b><span>${c.name.toLowerCase()}</span></div>`).join('')}</div>
      <a class="cta" href="${teamL(a)}">See ${esc(a.n)}'s full page</a></section>`;
  const top = br.slice(0,10).map(t => rowB(t, t.rank, metaIdx(t))).join('');
  const pool = T.filter(t => t.move && (t.rank <= 60 || t.prevRank <= 60));
  const riser = [...pool].filter(t => t.move > 0).sort((x,y) => y.move-x.move)[0];
  const sleeper = M.apWeek != null ? br.find(t => !t.d.apr) : null;
  const uw = upsetWatch(M.next), hotSeat = uw.alert[0] || uw.live[0];
  const tile = (t, kick, th, tp, to) => `<a class="tile" style="--tc:${esc(t.col)}" href="${to}"><span class="kick">${badge(t,'sm')}${kick}</span><strong class="th">${th}</strong><span class="tp">${tp}</span></a>`;
  const tiles = [
    riser && tile(riser, 'Biggest riser', `${esc(riser.n)} jumps ${riser.move} spots`, `Now No. ${riser.rank} after ${lastGame(riser)}.`, teamL(riser)),
    sleeper && tile(sleeper, 'Under the radar', `The polls are sleeping on ${esc(sleeper.n)}`, `${sleeper.w}-${sleeper.l} and No. ${sleeper.rank} here, but outside the AP Top 25.`, teamL(sleeper)),
    hotSeat && tile(hotSeat.dog, `Upset watch, week ${M.next}`, `${esc(hotSeat.dog.n)} has ${aPct(Math.round(hotSeat.pDog*100))} shot`, `${hotSeat.g.n ? 'Against' : hotSeat.dog.n === hotSeat.g.h ? 'At home against' : 'At'} No. ${hotSeat.fav.rank} ${esc(hotSeat.fav.n)}. LTF line: ${lineTxt(hotSeat.pr)}.`, L('upsets')),
  ].filter(Boolean).join('');
  const mrow = t => rowB(t, t.rank, `<span class="cf">was ${t.prevRank},</span> ${moveWords(t.move)}`);
  const hot = T.filter(t => t.rank <= 60 && t.g.length >= 3).map(momentum).sort((x,y) => y.score-x.score), mli = m => rowB(m.t, m.t.rank, momTag(m));
  const up = [...pool].filter(t => t.move>0).sort((x,y) => y.move-x.move).slice(0,5).map(mrow).join('');
  const down = [...pool].filter(t => t.move<0).sort((x,y) => x.move-y.move).slice(0,5).map(mrow).join('');
  const missing = br.filter(t => t.rank <= 30 && !t.d.apr).slice(0,6).map(t => rowB(t, t.rank, metaIdx(t))).join('');
  const g6 = br.filter(t => t.tier==='G6').slice(0,6).map((t,i) => rowB(t, i+1, `${mvTxt(t)} No. ${t.rank} nationally`)).join('');
  const alerts = (uw.alert.length ? uw.alert : uw.live).slice(0,5).map(upsetLi).join('');
  const mineRow = t => { const st = stakes(t), o = odds(t);
    return `<section class="mine" aria-label="${esc(t.n)}">${badge(t)}<div><div class="t1"><a href="${teamL(t)}">${esc(t.n)}</a> is No. ${t.rank} ${mvTxt(t)}</div>
      <div class="t2">${t.w}-${t.l}, LTF Index ${t.idx.toFixed(1)}. ${st ? `Next: ${st.e.site==='A'?'at':'vs'} ${esc(st.e.opp)}, ${clamp(Math.round(st.p*100),1,99)}% to win. A win puts them near No. ${st.win}, a loss near No. ${st.lose}. ` : ''}Playoff chance ${pct(o.po)}.</div></div>
      <a class="btn go" href="${teamL(t)}">Open</a></section>`; };
  const mine = favs().map(mineRow).join('');
  const pick = (mine ? '' : `<p class="hint pickteam">Have a team? Follow them and they stay pinned to the top of this page. <a class="txt" href="${L('teams')}">Pick your team</a></p>`)
    + `<p class="hint pickteam">Think wins should count for more, or defense for less? Set your own weights and every page follows. <a class="txt" href="${L('weights')}">Build your own rankings</a></p>`;
  const wkAll = M.next != null ? G.filter(g => g.w === M.next) : [], wkFin = wkAll.filter(g => g.done).length;      // a week turns over once its games are in, so mid-week some of it is already final
  const status = `<p class="status"><b>Updated ${builtTxt()}.</b>${STALE ? ' The daily update has not run since then.' : ''} The LTF Index is through week ${M.through}.${M.next == null ? '' : wkFin ? ` Week ${M.next} is under way, with ${wkFin} of ${wkAll.length} games final. The rankings move when the week is in the books.` : ` Week ${M.next} lines and picks are up.`} <a class="txt" href="${L('scorecard')}">How LTF is doing</a></p>`;
  const start = store.get('ltf.started') ? '' : `<section class="start" aria-label="How to use this site"><div><h2>New here? Three things to know</h2>
      <ol><li><b>One score for every team.</b> The LTF Index runs 0 to 100, and 50 is an average team. It is built from this season's games and nothing else: no polls, no preseason rankings, no betting lines.</li>
      <li><b>Every number has a reason.</b> Open any team or game to see what drives it. Point at a column heading, or tap a dotted word, for a plain definition.</li>
      <li><b>It predicts, with receipts.</b> The <a class="txt" href="${L('picks')}">picks</a> carry a confidence score and the reasons behind it, and the <a class="txt" href="${L('scorecard')}">scorecard</a> grades every one. Think the formula is wrong? <a class="txt" href="${L('weights')}">Build your own</a>.</li></ol></div>
      <button type="button" class="btn" data-dismiss="start">Got it</button></section>`;
  const since = window._since && window._since.length ? `<section class="since" aria-label="Since your last visit"><b>Since your last visit:</b> ${window._since.map(x => `${tl(x.t)} ${x.from === x.t.rank ? `held at No. ${x.from}` : `went from No. ${x.from} to No. ${x.t.rank}`}`).join('. ')}.</section>` : '';
  const body = `${status}${since}${start}${mine}<div class="front">${lead}
      <section class="sec"><h2>Top 10</h2><p class="hint">LTF Index, with movement since last week.</p><ol class="rows">${top}</ol><p class="next linkrow"><a class="txt" href="${L('rankings')}">All ${T.length} teams</a><a class="txt" href="${L('weights')}">Build your own rankings</a>${shareBtn('top25', 'Share the Top 25', 'more inl sharebtn', [['top25','Top 25'],['top10','Top 10']])}</p></section></div>
    ${homeWeek()}
    ${tiles ? `<div class="tiles">${tiles}</div>` : ''}${pick}
    <div class="panels">
      <div class="stack">
      <section class="panel"><h2>Biggest movers</h2><p class="hint">Teams in or near the top 60, since last week.</p>${up||down ? `<ol class="rows">${up}${down}</ol>` : '<p class="hint">Movement shows up once there are two weeks of results.</p>'}</section>
      ${hot.length ? `<section class="panel"><h2>Heating up, cooling off</h2><p class="hint">Momentum among the top 60: rating trend, recent play, streaks and upsets. It is tracked for the story and is not part of the LTF Index.</p><ol class="rows">${hot.slice(0,3).map(mli).join('')}${hot.slice(-3).reverse().map(mli).join('')}</ol><a class="more" href="${L('momentum')}">Momentum for every team</a></section>` : ''}
      </div>
      <div class="stack">
      ${M.apWeek != null ? `<section class="panel"><h2>The polls are missing these teams</h2><p class="hint">In the LTF top 30, outside the AP Top 25. The poll is only here for comparison.</p><ol class="rows">${missing || '<li class="two">Every team in the LTF top 30 is also ranked by the AP.</li>'}</ol><a class="more" href="${L('radar')}">More under the radar</a></section>` : ''}
      <section class="panel"><h2>Group of 6 leaders</h2><p class="hint">Same scale as everyone else.</p><ol class="rows">${g6}</ol><a class="more" href="${L('rankings', null, {group:'g6'})}">The full Group of 6 rankings</a></section>
      </div>
      ${alerts ? `<section class="panel full"><h2>Upset watch, week ${M.next}</h2><p class="hint">${uw.alert.length ? 'Top 25 teams with the least room for error this week, by the LTF line. The number is the underdog\'s chance to win.' : 'The underdogs with the best chance this week, by the LTF line.'}</p><ol class="rows">${alerts}</ol><a class="more" href="${L('upsets')}">The full upset watch</a></section>` : ''}
      ${homeBuySell()}
    </div>
    ${homeRecord()}`;
  return {title:'', top:'', body};
}

/* ================= rankings ================= */
const rankSeg = on => `<div class="seg viewseg" role="group" aria-label="How to show the rankings"><a data-keep href="${Lq({view:null})}" aria-current="${on === 'list'}">List</a><a data-keep href="${Lq({view:'tiers', week:null, sort:null, dir:null})}" aria-current="${on === 'tiers'}">Tiers</a></div>`;
function tierBoard(teams){   // every team in its band, as a wall of marks. This is the picture fans argue over.
  return `<div class="tbands">${TIERS.map(tr => { const ts = teams.filter(t => tierOf(t) === tr); if (!ts.length) return '';
    return `<section class="tband" aria-label="${tr.name}"><h2>${tr.name}<small>LTF Index ${tr.what}</small></h2><div class="tmarks">${ts.map(t => `<a class="tmark" href="${teamL(t)}" title="${esc(t.n)}, No. ${t.rank}, ${t.idx.toFixed(1)}">${logoOf(t, true) ? badge(t,'md') + `<b>${esc(t.ab)}</b>` : chip(t)}<small>${t.rank}</small></a>`).join('')}</div></section>`; }).join('')}</div>`;
}
function viewRankings(){
  if (R.q.view === 'tiers'){
    const q = findText(); let ts = T.filter(inGroup).sort((a,b) => a.rank-b.rank); const all = ts;
    if (q) ts = ts.filter(t => t.n.toLowerCase().includes(q) || t.ab.toLowerCase() === q);
    const count = k => all.filter(t => tierOf(t).k === k).length, top = all.filter(t => tierOf(t).k === 'title');
    const lead = all.length ? `${top.length ? `${list(top.map(tl))} ${top.length === 1 ? 'is the only title contender' : 'are the title contenders'}` : 'No team is in the top tier'}${groupKey() === 'all' ? '' : ` from the ${esc(groupLabel())}`} right now. ${count('playoff')} more ${count('playoff') === 1 ? 'team is' : 'teams are'} playoff caliber and ${count('top25')} are top 25 caliber.` : '';
    return {title:'Tiers', controls:true, lead, card: groupKey() === 'all' ? 'tiers' : null, alts: [['tiers','Tiers'],['top25','Top 25'],['top10','Top 10']],
      top: pageTop('Rankings', `<b>${groupLabel()}, in tiers.</b> The same LTF Index, cut into seven bands eight points wide. The names describe the level a team has played at so far. They are not a forecast. Select a team for their full page.`),
      body: rankSeg('tiers') + (ts.length ? tierBoard(ts) : `<p class="empty">No team matches "${esc(R.q.find || '')}".</p>`)};
  }
  const wk = HW.includes(+R.q.week) ? +R.q.week : M.through, live = wk === M.through;
  const weeks = HW.length > 1 ? `<div class="seg" role="group" aria-label="Rankings as of which week">${HW.map(w => `<a data-keep href="${Lq({week: w===M.through ? null : w, sort:null, dir:null})}" aria-current="${w===wk}">${w===M.through ? `After week ${w}, latest` : `After week ${w}`}</a>`).join('')}</div>` : '';
  const q = findText();
  let table, key;
  if (live){
    const scoped = T.filter(inGroup).sort((a,b) => b.cz-a.cz); scoped.forEach((t,i) => { t.srank = i+1; });
    const s = sortState('idx');
    const val = t => s.key==='idx' ? t.cz : s.key==='rec' ? t.w/Math.max(1,t.w+t.l) + t.w/1000 : s.key==='move' ? (t.move ?? 0) : COMP.some(c => c.k===s.key) ? t.z[s.key] : t.cz;
    let rows = [...scoped];
    if (s.key==='team') rows.sort((a,b) => s.dir*-1*a.n.localeCompare(b.n)); else rows.sort((a,b) => -s.dir*(val(b)-val(a)) || b.cz-a.cz);
    if (q) rows = rows.filter(t => t.n.toLowerCase().includes(q) || t.ab.toLowerCase() === q);
    const showNat = groupKey() !== 'all', hasMove = HW.length > 1, span = 5 + COMP.length + (showNat?1:0) + (hasMove?1:0);
    const head = `<tr>${th('Rank','num')}${showNat ? th('National','num','nat') : ''}${sortTh('team','Team','','idx')}${sortTh('rec','Record','num','idx','rec')}${sortTh('idx','LTF','','idx','index')}
      ${hasMove ? sortTh('move','Last week','num wide','idx','lw') : ''}${COMP.map(c => sortTh(c.k,c.col,'num wide','idx',c.k)).join('')}${th('Last 3','wide','form')}</tr>`;
    const body = rows.map(t => `<tr><td class="num rk">${t.srank}</td>${showNat?`<td class="num nat">${t.rank}</td>`:''}${teamCell(t, true)}
      <td class="num rec">${t.w}-${t.l}<small class="wide">${t.cw+t.cl?`${t.cw}-${t.cl}`:''}</small></td>
      <td class="idx"><b>${t.idx.toFixed(1)}</b>${strip(t.idx)}</td>
      ${hasMove ? `<td class="num wide">${lastWeek(t)}</td>` : ''}
      ${COMP.map(c => { const zv = t.z[c.k]; return `<td class="num c wide ${zv>=0?'pos':'neg'}" style="--t:${clamp(Math.abs(zv)/2.5,0,1).toFixed(2)}">${t.rk[c.k]}</td>`; }).join('')}<td class="wide">${form(t)}</td></tr>`).join('');
    table = `<div class="scroll"><table class="grid"><thead>${head}</thead><tbody>${body || emptyRow(span,'team')}</tbody></table></div>`;
    key = colKey([['LTF', 'The LTF Index, from 0 to 100. An average team is 50. The green bar shows the same score as a spot on a field.'],
      hasMove && ['Last week', 'Rank a week ago, then how far the team moved.', true],
      ['Résumé, Offense, Defense, Margin, 1st half', 'The team\'s national rank in each of the five parts of the score. Greener is better and redder is worse.', true],
      ['Last 3', 'The last three games, oldest first.', true]]);
  } else {
    const i = HW.indexOf(wk), prev = i > 0 ? HW[i-1] : null;
    let rows = T.filter(t => inGroup(t) && t.hist[wk]).sort((a,b) => a.hist[wk].rank-b.hist[wk].rank);
    rows.forEach((t,n) => { t.srank = n+1; });
    if (q) rows = rows.filter(t => t.n.toLowerCase().includes(q));
    const body = rows.map(t => { const h = t.hist[wk], p = prev != null && t.hist[prev], mv = p ? p.rank - h.rank : 0;
      return `<tr><td class="num rk">${groupKey()==='all' ? h.rank : t.srank}</td>${teamCell(t)}<td class="num">${h.rec}</td><td class="idx"><b>${h.idx.toFixed(1)}</b>${strip(h.idx)}</td>
        <td class="num wide">${p ? moveWords(mv) : '–'}</td><td class="num">${t.rank}</td></tr>`; }).join('');
    table = `<div class="scroll"><table class="grid"><thead><tr>${th('Rank then','num')}${th('Team')}${th('Record then','num')}${th('LTF then','','index')}${th('Change that week','num wide')}${th('Rank now','num')}</tr></thead><tbody>${body || emptyRow(6,'team')}</tbody></table></div>`;
    key = '';
  }
  const nFlag = live ? T.filter(t => inGroup(t) && t.h2h.length).length : 0;
  const dek = live ? `<b>${groupLabel()}.</b> Every team on one scale. Select a team for their full page, or a column heading to sort by it.${nFlag ? ` ${nFlag} ${nFlag===1?'team is':'teams are'} tagged "lost to" because they are ranked ahead of a team that beat them.` : ''}`
                   : `<b>${groupLabel()}, as things stood after week ${wk}.</b> Built only from games played through that week.`;
  const gk = groupKey(), pool = T.filter(inGroup), own = gk === 'all' ? 'is No. 1' : `leads the ${esc(groupLabel())}`;
  let lead = '';
  if (live && pool.length){ const by = [...pool].sort((a,b) => b.cz-a.cz), a = by[0], b2 = by[1];
    const riser = by.filter(t => t.move >= 3 && (confBySlug[gk] || t.rank <= 60 || t.prevRank <= 60)).sort((x,y) => y.move-x.move)[0];
    lead = `${tl(a)} ${own} at ${a.idx.toFixed(1)}${b2 ? `, with ${tl(b2)} ${(a.idx-b2.idx).toFixed(1)} back` : ''}.${riser ? ` Biggest riser: ${tl(riser)}, up ${riser.move} to No. ${riser.rank}.` : ''}`; }
  else if (pool.length){ const a = pool.filter(t => t.hist[wk]).sort((x,y) => x.hist[wk].rank-y.hist[wk].rank)[0];
    if (a) lead = `After week ${wk}, ${tl(a)} ${gk === 'all' ? 'was No. 1' : `led the ${esc(groupLabel())}`} at ${a.hist[wk].idx.toFixed(1)}. They are No. ${a.rank} now.`; }
  return {title:'Rankings', controls:true, top: pageTop('Rankings', dek), body: rankSeg('list') + weeks + key + table, lead,
    card: confBySlug[gk] ? 'conference:' + gk : 'top25', alts: confBySlug[gk] ? null : [['top25','Top 25'],['top10','Top 10'],['tiers','Tiers']]};
}

/* ================= teams ================= */
function viewTeams(){
  const order = [...CONFS].sort((a,b) => (a.tier==='P4'?0:a.tier==='G6'?1:2) - (b.tier==='P4'?0:b.tier==='G6'?1:2) || a.name.localeCompare(b.name));
  const body = order.map(c => `<section class="sec"><h2><a href="${confL(c)}">${esc(c.label)}</a></h2><p class="hint">${c.teams.length} teams${c.tier ? `, ${c.tier==='P4'?'Power 4':'Group of 6'}` : ''}. <a class="txt" href="${confL(c)}">Conference page</a></p>
    <div class="tgrid">${[...c.teams].sort((a,b) => a.n.localeCompare(b.n)).map(t => `<a class="tcard" href="${teamL(t)}">${badge(t)}<span><span class="nm">${esc(t.n)}</span><small>No. ${t.rank}, ${t.w}-${t.l}</small></span></a>`).join('')}</div></section>`).join('');
  return {title:'Teams', top: pageTop('Teams', `All ${T.length} FBS teams by conference. Every team has their own page with their score, stats, results and remaining schedule.`), body};
}

/* ================= team page ================= */
function trend(t){   // rank after each week: week along the bottom, rank up the left side with No. 1 at the top
  const pts = HW.filter(w => t.hist[w]).map(w => ({w, ...t.hist[w]}));
  if (pts.length < 2) return '<p class="next">The week-by-week chart appears once there are two weeks of rankings.</p>';
  const N = T.length, rs = pts.map(p => p.rank), best = Math.min(...rs), worst = Math.max(...rs);
  const step = [1,2,5,10,20,25,50].find(v => (worst-best)/v <= 4) || 50;
  let lo = Math.floor(best/step)*step, hi = Math.ceil(worst/step)*step;      // the rank axis runs a step past the best and worst rank held
  if (lo >= best) lo -= step; if (hi <= worst) hi += step;
  lo = Math.max(1, lo); hi = Math.min(N, hi);
  const ticks = []; for (let v = Math.ceil(lo/step)*step; v <= hi; v += step) if (v >= 1) ticks.push(v);
  if (ticks[0] !== lo) ticks.unshift(lo); if (ticks[ticks.length-1] !== hi) ticks.push(hi);
  const Wd = 460, H = 270, pl = 46, pr = 16, pt = 40, pb = 62, x0 = pl + 20, x1 = Wd - pr - 16, y0 = pt, y1 = H - pb;
  const X = i => x0 + i/(pts.length-1)*(x1-x0), Y = r => y0 + (r-lo)/((hi-lo)||1)*(y1-y0);
  const P = pts.map((p,i) => ({...p, x:X(i), y:Y(p.rank), mv: i ? pts[i-1].rank - p.rank : null}));
  const col = mv => mv > 0 ? 'var(--good)' : mv < 0 ? 'var(--bad)' : 'var(--muted)';
  const below = (q,i) => { const nb = [P[i-1], P[i+1]].filter(Boolean), up = nb.filter(o => o.y < q.y - 1).length, dn = nb.filter(o => o.y > q.y + 1).length; return up > dn; };   // put the label on the side the line does not come from
  const lean = (q,i) => { const a = P[i-1], b = P[i+1]; return !a || !b ? 0 : a.y < q.y - 4 && b.y > q.y + 4 ? 9 : a.y > q.y + 4 && b.y < q.y - 4 ? -9 : 0; };   // on a slope, nudge the label off the line
  const tip = q => `Week ${q.w}: No. ${q.rank}${q.mv == null ? '' : q.mv > 0 ? `, up ${q.mv}` : q.mv < 0 ? `, down ${-q.mv}` : ', same spot'}. LTF Index ${q.idx.toFixed(1)}, record ${q.rec}.`;
  const kept = ticks.filter((v,i) => i === 0 || i === ticks.length-1 || (Math.abs(Y(v)-Y(lo)) > 13 && Math.abs(Y(v)-Y(hi)) > 13));
  return `<svg class="trend" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="LTF rank after each week. ${P.map(tip).join(' ')}">
    <text class="at" x="${pl-8}" y="${pt-22}" text-anchor="end">Rank</text>
    ${kept.map(v => `<line class="gr" x1="${pl}" x2="${Wd-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${pl-8}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
    <line class="ax" x1="${pl}" x2="${pl}" y1="${pt-10}" y2="${H-pb+18}"/><line class="ax" x1="${pl}" x2="${Wd-pr}" y1="${H-pb+18}" y2="${H-pb+18}"/>
    ${P.map(q => `<line class="ax" x1="${q.x.toFixed(1)}" x2="${q.x.toFixed(1)}" y1="${H-pb+18}" y2="${H-pb+23}"/><text x="${q.x.toFixed(1)}" y="${H-pb+38}" text-anchor="middle">${q.w}</text>`).join('')}
    <text class="at" x="${((pl+Wd-pr)/2).toFixed(1)}" y="${H-4}" text-anchor="middle">Week</text>
    ${P.slice(1).map((q,i) => `<line x1="${P[i].x.toFixed(1)}" y1="${P[i].y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${col(q.mv)}" stroke-width="3" stroke-linecap="round"/>`).join('')}
    ${P.map((q,i) => `<g><title>${tip(q)}</title><circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${i === P.length-1 ? 6 : 5}" class="${i === P.length-1 ? 'now' : 'pt'}"/>
      <text class="tv${P.length > 9 ? ' sm' : ''}" x="${(q.x + lean(q,i)).toFixed(1)}" y="${(below(q,i) ? q.y+20 : q.y-11).toFixed(1)}" text-anchor="middle">${q.rank}</text></g>`).join('')}
  </svg><p class="hint after">LTF rank after each week, with No. 1 at the top. The number on each point is the rank that week, and it reads off the scale on the left. A green line is a move up and a red line is a slide.</p>`;
}
function say(k,t){
  const d = t.d;
  if (k==='res'){
    const q = d.qw.length ? `Wins over top-50 teams: ${d.qw.map(teamRef).join(', ')}.` : 'No wins over a top-50 team yet.';
    return `${term('sor')} ${d.sor.toFixed(1)} out of 100, ${ord(t.rk.sor)} nationally. A typical top-25 team would match this record about ${Math.round(100-d.sor)}% of the time. ${q} The schedule so far ranks ${ord(t.rk.sos)} in difficulty, which strength of record already allows for.`;
  }
  if (k==='off') return `${ord(t.rk.oepa)} in EPA per play, ${ord(t.rk.osr)} in success rate, ${ord(t.rk.oppd)} in points per drive and ${ord(t.rk.oppo)} in points per scoring opportunity.`;
  if (k==='def') return `${ord(t.rk.depa)} in EPA per play allowed, ${ord(t.rk.dsr)} in success rate allowed, ${ord(t.rk.dppd)} in points per drive allowed and ${ord(t.rk.stop)} in stop rate.`;
  if (k==='mar') return `${signed(d.mar)} points a game against an average team, with every opponent and home field allowed for and blowouts capped at 24.`;
  if (k==='h1') return `${signed(d.h1)} points against an average team by halftime, adjusted the same way.`;
  return '';
}
function statTable(t){
  const d = t.d, blank = '<td></td><td></td>';
  const rows = STATS.map(s => `<tr><td>${term(s.k, s.n)}${s.x ? ' <span class="rk2">not in the score</span>' : ''}</td>${s.o ? `<td class="num">${s.f(d[s.o])}</td><td class="num rkc">${t.rk[s.o]} ${trendArrow(t, s.o)}</td>` : blank}<td class="num">${s.f(d[s.d])}</td><td class="num rkc">${t.rk[s.d]} ${trendArrow(t, s.d)}</td></tr>`).join('');
  return `<h3>Offense and defense, stat by stat</h3>
    <div class="scroll"><table class="log stats"><thead><tr><th>Stat</th><th class="num">Offense</th><th class="num">Rank</th><th class="num">Defense</th><th class="num">Rank</th></tr></thead><tbody>${rows}
    <tr><td>${term('net')}</td><td class="num">${signed(t.netOpp,2)}</td><td class="num rkc">${t.rk.netOpp}</td>${blank}</tr>
    <tr><td>Special teams, points per game <span class="rk2">not in the score</span></td><td class="num">${signed(d.st,2)}</td><td class="num rkc">${t.rk.st}</td>${blank}</tr></tbody></table></div>
    <p class="next small">Ranks are out of ${T.length}. "Up" or "down" beside a rank means it moved three or more spots since last week. Tap any stat name for what it means. Every number is adjusted for opponent, so it will differ from the box score. <a class="txt" href="${L('stats')}">See every team's stats</a></p>`;
}
function gameLog(t){
  if (!t.g.length) return '<p class="next">No games played yet.</p>';
  const rows = t.g.map(g => {
    const o = byName[g.opp], where = g.site==='A' ? 'at' : 'vs', win = g.pf > g.pa, ln = ltfSide(t, g);
    const exp = ln == null ? '<span class="rk2">no line yet</span>' : half(ln) === 0 ? "Pick 'em" : ln > 0 ? `Favored by ${half(ln)}` : `Underdog by ${half(ln)}`;
    return `<tr><td class="num">${g.wk}</td><td>${where} ${teamRef(g.opp)}${g.site==='N'?' <span class="rk2">neutral</span>':''} <span class="rk2">${o ? 'No. '+o.rank : 'FCS'}</span></td>
      <td><a class="txt" href="${gameL(g.game)}"><b class="${win?'up':'down'}">${win?'W':'L'}</b> ${scoreTxt(g)}</a></td><td class="num">${gsCell(gameScore(t, g))}</td><td class="wide">${o ? exp : '<span class="rk2">FCS opponent</span>'}</td></tr>`;
  }).join('');
  const sc = t.g.map(g => ({g, v: gameScore(t, g)})).sort((a,b) => b.v-a.v);
  return `<div class="scroll"><table class="log"><thead><tr><th class="num">Wk</th><th>Opponent</th><th>Result</th><th class="num">${term('gs')}</th><th class="wide">${term('line', 'LTF line, before kickoff')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${sc.length > 1 ? `<p class="next">Best showing: ${Math.round(sc[0].v)} against ${esc(sc[0].g.opp)}. Weakest: ${Math.round(sc[sc.length-1].v)} against ${esc(sc[sc.length-1].g.opp)}.</p>` : ''}`;
}
function remaining(t){
  const p = projection(t);
  if (!p.left.length) return '<p class="next">No regular-season games left.</p>';
  const rows = p.left.map(x => { const e = x.e, o = byName[e.opp], gl = gameLine(e.game), pc = clamp(Math.round(x.p*100),1,99);
    return `<tr><td class="num">${e.wk}</td><td>${e.site==='A'?'at':'vs'} ${teamRef(e.opp)}${e.site==='N'?' <span class="rk2">neutral</span>':''} <span class="rk2">${o ? 'No. '+o.rank : 'FCS'}</span></td>
      <td><span class="pbar"><i style="width:${pc}%"></i></span>${pc}%</td><td>${gl ? `<a class="txt" href="${gameL(e.game)}">${lineTxt(gl, true)}</a>` : '<span class="rk2">no line</span>'}</td></tr>`; }).join('');
  const o = odds(t), wins = Math.round(o.xw), total = t.sched.length;
  return `<div class="scroll"><table class="log"><thead><tr><th class="num">Wk</th><th>Opponent</th><th>${term('wc')}</th><th>${term('line')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="next">On pace to finish about <b>${wins}-${total-wins}</b>, with ${o.xw.toFixed(1)} wins on average across the simulated seasons. Chance to win out: ${pct(o.out)}. Conference title games and bowls are not included. Select a line for the reasons behind it.</p>
    <h3>${term('wt', 'Chance to win at least')}</h3><div class="bars nomid wt">${WINS.map((k,i) => `<div class="br"><span>${k} ${k===12 && total===12 ? '(all of them)' : 'games'}</span><span class="tr"><i class="g6" style="width:${(o.ge[i]*100).toFixed(1)}%"></i></span><span class="num">${pct(o.ge[i])}</span></div>`).join('')}</div>`;
}
function viewTeam(){
  const t = bySlug[R.id]; if (!t) return viewNotFound();
  const conf = confByName[t.c], fl = favs(), fav = fl.includes(t), o = odds(t), st = stakes(t), sw = strengths(t);
  const parts = COMP.map(c => { const zv = t.z[c.k], w = clamp(Math.abs(zv)/3,0,1)*50;
    return `<tr><th scope="row">${term(c.k, c.name)}<span class="wt">${share(c.k)}% of the score</span></th>
      <td class="zcell"><span class="zbar ${zv>=0?'pos':'neg'}"><i style="width:${w.toFixed(1)}%"></i></span></td>
      <td class="num">${ord(t.rk[c.k])}<br>${tierTag(t.rk[c.k])}</td><td class="say">${say(c.k,t)}</td></tr>`; }).join('');
  const mv = t.move, moved = mv == null ? '' : mv > 0 ? ` Up ${mv} ${mv===1?'spot':'spots'} since last week.` : mv < 0 ? ` Down ${-mv} ${mv===-1?'spot':'spots'} since last week.` : ' Same spot as last week.';
  const other = byRank().find(x => x !== t);
  const ne = t.sched.find(q => !q.game.done), nx = ne && gameLine(ne.game), no = ne && byName[ne.opp];
  const nextUp = ne ? `<b>Next:</b> ${ne.site === 'A' ? 'at' : 'vs'} ${no ? `No. ${no.rank} ` : ''}${teamRef(ne.opp)}${ne.site === 'N' ? ' at a neutral site' : ''}, ${fmtDay(ne.date)}.${nx ? ` LTF line: ${lineTxt(nx)}.` : ''} <a class="txt" href="${gameL(ne.game)}">Game preview</a>` : '';
  const hs = HW.filter(w => t.hist[w]).map(w => ({w, r:t.hist[w].rank})), hi = [...hs].sort((a,b) => a.r-b.r)[0], lo = [...hs].sort((a,b) => b.r-a.r)[0];
  const range = hs.length > 1 ? `<p class="next">Season high: No. ${hi.r} after week ${hi.w}. Season low: No. ${lo.r} after week ${lo.w}. <a class="txt" href="${L('rankings', null, {week: HW[0]})}">Rankings by week</a></p>` : '';
  const body = `<div class="tpage">
    <div class="hero" style="--tc:${esc(t.col)};--tf:${t.fg}" data-ab="${esc(t.ab)}">
      <div class="hname">${logosOn() ? `<div class="hmark">${badge(t,'xl')}</div>` : ''}<div><h1>${esc(t.n)}</h1>
        <p class="sub">${t.w}-${t.l}${t.cw+t.cl?`, ${t.cw}-${t.cl} in the ${esc(t.c)}`:''}.${moved}</p></div></div>
      <div class="hnums"><div class="big"><b>No. ${t.rank}</b><span>of ${T.length} teams</span></div><div class="big"><b>${t.idx.toFixed(1)}</b><span>LTF Index, ${tier(t.rank).toLowerCase()}</span></div>
        ${COMP.map(c => `<div><b>${ord(t.rk[c.k])}</b><span>${c.col.toLowerCase()}</span></div>`).join('')}</div>
      <div class="hstrip">${strip(t.idx,true)}</div>
      ${nextUp ? `<p class="hnext">${nextUp}</p>` : ''}
      <p class="hmore">${[`${ord(t.tierRank)} in the ${t.tier==='P4'?'Power 4':'Group of 6'}`, t.c==='Independent' ? '' : `${ord(t.cRank)} in the ${esc(t.c)}`, M.apWeek == null ? '' : t.d.apr ? `No. ${t.d.apr} in the AP poll` : 'unranked by the AP'].filter(Boolean).join(', ')}.</p>
      <div class="acts">${shareBtn('team:' + t.slug, 'Share', 'sharebtn')}<button class="follow" type="button" data-follow="${t.slug}" aria-pressed="${fav}">${fav ? 'Following' : 'Follow this team'}</button>
        <a href="${L('compare', null, {a:t.slug, b:other.slug})}">Compare</a><a href="${confL(conf)}">${esc(conf.label)}</a></div>
    </div>
    <div class="facts">${fact(term('po'), pct(o.po), `<a class="txt" href="${L('odds')}">All season odds</a>`)}
      ${t.c==='Independent' ? '' : fact(term('ct', 'Win the ' + esc(t.c)), pct(o.cf), 'in simulated seasons')}
      ${fact(term('bowl', 'Bowl eligible'), pct(o.bowl), t.w >= 6 ? 'already there with six wins' : `needs ${6-t.w} more ${6-t.w===1?'win':'wins'}`)}
      ${fact(term('xw'), o.xw.toFixed(1), `of ${t.sched.length} regular-season games`)}</div>
    <div class="tbody">
    <p class="next why1">${whyMoved(t)}</p>
    ${st ? `<p class="next"><b>This week's stakes.</b> ${st.e.site==='A'?'At':'Against'} ${teamRef(st.e.opp)}, ${clamp(Math.round(st.p*100),1,99)}% to win. A win would put ${esc(t.n)} near No. ${st.win}. A loss would drop them to about No. ${st.lose}. <a class="txt" href="${gameL(st.e.game)}">Game preview</a></p>` : ''}
    <p class="next"><b>Best at:</b> ${list(sw.best)}. <b>Weakest at:</b> ${list(sw.worst)}.</p>
    ${t.luck == null ? '' : `<p class="next"><b>Luck and steadiness.</b> ${Math.abs(t.luck) < 1 ? 'Close to neutral luck' : `About ${Math.abs(t.luck).toFixed(1)} points a game of ${t.luck > 0 ? 'good' : 'bad'} luck`} from fumbles, interceptions and opponents' kicking (${ord(t.luckRank)} luckiest).${t.swing != null ? ` ${steadyWord(t) === 'Steady' ? 'A steady team: their level changes little from week to week.' : steadyWord(t) === 'Up and down' ? 'An up-and-down team: their level swings a lot from week to week.' : 'About as steady as most teams.'}` : ''} <a class="txt" href="${L('luck')}">Luck and steadiness</a></p>`}
    ${t.g.length ? (m => `<p class="next"><b>Momentum.</b> ${momLabel(m.score)}, ${fix1(m.score)} on a scale from minus 10 to plus 10 (${ord(m.rank)} of ${T.length}). ${momWhy(t)} Momentum is tracked for the story and is not part of the score. <a class="txt" href="${L('momentum')}">Momentum</a></p>`)(momentum(t)) : ''}
    ${teamBuySell(t)}
    ${t.h2h.length ? `<p class="next"><b>Ranked ahead of a team that beat them.</b> ${t.h2h.map(x => esc(h2hText(x))).join(' ')}</p>` : ''}
    <div class="dgrid">
      <div><h3>What makes up the score</h3><table class="parts"><tbody>${parts}</tbody></table>${statTable(t)}</div>
      <div><h3>Week by week</h3>${trend(t)}${range}
        <h3>Results</h3>${gameLog(t)}
        <h3>Still to play</h3>${remaining(t)}</div>
    </div></div></div>`;
  return {title:t.n, top: crumbs([['Teams', L('teams')], [esc(conf.label), confL(conf)], [esc(t.n)]]), body};
}

/* ================= conferences ================= */
function confNumbers(c){
  const out = c.teams.flatMap(t => t.g.filter(e => !e.fcs && byName[e.opp].c !== c.name));
  return {out, p4: out.filter(e => byName[e.opp].tier==='P4'), t25: c.teams.filter(t => t.rank<=25).length, t50: c.teams.filter(t => t.rank<=50).length};
}
function viewConferences(){
  const cs = CONFS.filter(c => c.tier).sort((a,b) => b.avg-a.avg);
  const bars = `<div class="bars" role="img" aria-label="Average LTF Index by conference">${cs.map(c => `<div class="br"><a href="${confL(c)}">${esc(c.name)}</a><span class="tr"><i class="${c.tier==='G6'?'g6':''}" style="width:${clamp(c.avg,0,100).toFixed(1)}%"></i></span><span class="num">${c.avg.toFixed(1)}</span></div>`).join('')}</div>
    <p class="hint">The line marks 50, an average FBS team. Orange bars are Group of 6 conferences. The others are Power 4. An average counts every team the same, so a league's weakest teams move it as much as the best ones do. Two leagues within two points of each other are about even. The table shows how many teams each has near the top.</p>`;
  const rows = cs.map(c => { const x = confNumbers(c);
    return `<tr><td class="num rk">${c.rank}</td><td class="cn"><a class="tlink" href="${confL(c)}">${esc(c.name)}</a> <span class="cf">${c.tier==='P4'?'Power 4':'Group of 6'}</span></td><td class="num">${c.prevRank == null ? '–' : `${c.prevRank}, ${moveWords(c.prevRank-c.rank)}`}</td><td class="num">${c.avg.toFixed(1)}${c.prevAvg == null ? '' : ` <span class="cf">${signed(c.avg-c.prevAvg)}</span>`}</td><td class="num">${x.t25}</td><td class="num wide">${x.t50}</td>
      <td class="wide">${tl(c.sorted[0])} <span class="cf">No. ${c.sorted[0].rank}</span></td><td class="num">${wl(x.out)}</td><td class="num wide">${wl(x.p4)}</td></tr>`; }).join('');
  const ind = confByName['Independent'];
  const g6c = cs.find(c => c.tier === 'G6');
  // two leagues within two points of each other are about one point apart on the scoreboard, so the page calls them even
  const near = (a, b) => a && b && Math.abs(a.avg - b.avg) < 2, av = c => c.avg.toFixed(1);
  const more = (a, b) => { const x = confNumbers(a).t25, y = confNumbers(b).t25; return x === y ? '' : `, and the ${esc((x > y ? a : b).name)} has more teams in the top 25, ${Math.max(x,y)} to ${Math.min(x,y)}`; };
  const [c1, c2, c3] = cs;
  const order = near(c1, c2) ? `The ${esc(c1.name)} (${av(c1)}) and the ${esc(c2.name)} (${av(c2)}) are about even at the top by average LTF Index${more(c1, c2)}.`
    : `The ${esc(c1.name)} has the highest average LTF Index, ${av(c1)}.` + (near(c2, c3) ? ` The ${esc(c2.name)} (${av(c2)}) and the ${esc(c3.name)} (${av(c3)}) are about even behind the ${esc(c1.name)}${more(c2, c3)}.` : ` The ${esc(c2.name)} is next at ${av(c2)}.`);
  return {title:'Conferences', card:'conferences', lead: `${order}${g6c ? ` The best of the Group of 6 is the ${esc(g6c.name)}, at ${g6c.avg.toFixed(1)}.` : ''}`,
    top: pageTop('Conferences', 'Every conference on the same scale: the average LTF Index across the league, and the record against everyone else.'),
    body: `<section class="sec"><h2>Average LTF Index</h2>${bars}</section>
    <section class="sec"><h2>Conference table</h2>
    <div class="scroll"><table class="grid"><thead><tr>${th('Rank','num')}${th('Conference')}${th('Last week','num','lw')}${th('Average LTF','num','index')}${th('Top 25','num')}${th('Top 50','num wide')}${th('Best team','wide')}${th('Outside the conference','num')}${th('Vs. Power 4','num wide')}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint after">Records leave out games against FCS teams. "Outside the conference" is the combined record against teams from other conferences.${ind ? ` Independents have no conference. <a class="txt" href="${confL(ind)}">See the independents</a>` : ''}</p>
    <p class="next"><a class="btn" href="${L('leagues')}">League strength: how the leagues have done against each other</a></p></section>`};
}
function viewConference(){
  const c = confBySlug[R.id]; if (!c) return viewNotFound();
  const x = confNumbers(c), s = sortState('idx');
  let rows = [...c.sorted];
  const val = t => s.key==='conf' ? (t.cw+t.cl ? t.cw/(t.cw+t.cl) : -1) + t.cw/100 : s.key==='rec' ? t.w/Math.max(1,t.w+t.l) : s.key==='off' ? -t.rk.off : s.key==='def' ? -t.rk.def : -t.rank;
  if (s.key==='team') rows.sort((a,b) => s.dir*-1*a.n.localeCompare(b.n)); else rows.sort((a,b) => s.dir*(val(a)-val(b)) || a.rank-b.rank);
  const body = rows.map(t => { const e = t.sched.find(q => !q.game.done);
    return `<tr><td class="num rk">${t.cRank}</td>${teamCell(t)}<td class="num">${t.cw}-${t.cl}</td><td class="num">${t.w}-${t.l}</td><td class="idx"><b>${t.idx.toFixed(1)}</b>${strip(t.idx)}</td>
      <td class="num">${t.rank}</td><td class="num wide">${lastWeek(t)}</td><td class="num wide">${t.rk.off}</td><td class="num wide">${t.rk.def}</td><td class="wide">${form(t)}</td><td class="wide">${e ? `<a class="txt" href="${gameL(e.game)}">${e.site==='A'?'at':'vs'} ${esc(e.opp)}</a>` : '–'}</td></tr>`; }).join('');
  const fut = FUTURE(), wk = fut.includes(+R.q.week) ? +R.q.week : M.next;
  const games = wk == null ? [] : G.filter(g => g.w === wk && [g.h, g.a].some(n => byName[n] && byName[n].c === c.name));
  const ld = c.sorted[0];
  return {title:c.label, card:'conference:' + c.slug,
    lead: c.tier ? `The ${esc(c.label)} is ${ord(c.rank)} of ${CONFS.filter(q => q.tier).length} conferences at ${c.avg.toFixed(1)}. ${tl(ld)} leads, No. ${ld.rank} nationally${x.t25 ? `, and ${x.t25 === 1 ? 'is the only team' : `${x.t25} teams are`} in the top 25` : ''}.`
                 : `${tl(ld)} leads the independents at ${ld.idx.toFixed(1)}, No. ${ld.rank} nationally.`,
    top: pageTop(esc(c.label), c.tier ? `${c.tier==='P4'?'Power 4':'Group of 6'} conference. Standings here go by the LTF Index, not by conference record.` : 'Teams that play without a conference.', [['Conferences', L('conferences')], [esc(c.label)]]),
    body: `<div class="facts">${fact('Average LTF Index', c.avg.toFixed(1), '50 is an average FBS team')}
      ${fact('Teams in the national top 25', x.t25, `${x.t50} in the top 50`)}
      ${fact('Record outside the conference', wl(x.out), 'FCS games left out')}
      ${fact('Against the Power 4', wl(x.p4), c.tier==='P4'?'other conferences only':'non-conference games')}</div>
    <section class="sec"><h2>Standings by LTF</h2>
    <div class="scroll"><table class="grid"><thead><tr>${th('Rank','num')}${sortTh('team','Team','','idx')}${sortTh('conf','Conf.','num','idx')}${sortTh('rec','Overall','num','idx','rec')}${sortTh('idx','LTF','','idx','index')}${th('National','num','nat')}${th('Last week','num wide','lw')}${sortTh('off','Offense','num wide','idx','off')}${sortTh('def','Defense','num wide','idx','def')}${th('Last 3','wide','form')}${th('Next game','wide')}</tr></thead><tbody>${body}</tbody></table></div></section>
    ${fut.length ? `<section class="sec"><h2>Games ahead</h2><p class="hint">Every game left on the schedule has an LTF line and a confidence score. Pick a week.</p>${weekTabs(fut, wk, M.next, w => w === M.next ? 'Next' : 'Ahead')}${games.length ? gameList(games) : '<p class="empty">No games for this conference that week.</p>'}</section>` : ''}`};
}
