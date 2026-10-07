/* ================= explanations and predictions ================= */
const BT = M.bt || {conf:[], ats:[], cal:[], gamma:.254};
/* how far one result moves a team's score. It is biggest early, when each game is a large share of what is known, so it is looked up by the week of the game. */
const gammaAt = wk => { const gw = BT.gw; if (!gw) return BT.gamma || .254; const ks = Object.keys(gw).map(Number); return gw[String(clamp(wk, Math.min(...ks), Math.max(...ks)))]; };
const PREV = HW.length > 1 ? HW[HW.length-2] : null;
/* plain words for a rank */
const lc = s => s.replace(/^[A-Z](?=[a-z])/, c => c.toLowerCase());     // lower-case a stat name without breaking "EPA"
const tier = rank => { const p = rank / T.length; return p <= .07 ? 'Elite' : p <= .18 ? 'Excellent' : p <= .36 ? 'Good' : p <= .64 ? 'Average' : p <= .84 ? 'Below average' : 'Poor'; };
/* Tiers put the 0 to 100 score into seven bands, eight points wide, and name each for the level of play. An average
   team is 50 and the spread between teams is about 14 points, so 78 is two of those spreads above average. The names
   describe how a team has played so far. They are not a forecast. */
const TIERS = [
  {k:'title',   min:78,  name:'Title contenders',   what:'78 and up'},
  {k:'playoff', min:70,  name:'Playoff caliber',    what:'70 to 78'},
  {k:'top25',   min:62,  name:'Top 25 caliber',     what:'62 to 70'},
  {k:'bowl',    min:54,  name:'Solid bowl teams',   what:'54 to 62'},
  {k:'mid',     min:46,  name:'Middle of the pack', what:'46 to 54'},
  {k:'below',   min:38,  name:'Below average',      what:'38 to 46'},
  {k:'low',     min:-1,  name:'Struggling',         what:'under 38'},
];
const tierOf = t => TIERS.find(x => t.idx >= x.min) || TIERS[TIERS.length - 1];
const tierTag = rank => `<span class="tier t${Math.min(5, ['Elite','Excellent','Good','Average','Below average','Poor'].indexOf(tier(rank)))}">${tier(rank)}</span>`;

/* last week's stat ranks, for trend arrows */
{
  const have = T.filter(t => t.pv);
  for (const s of STATS) for (const [f, low] of [[s.o, false], [s.d, !s.dHigh]]){
    if (!f || !have.length || have[0].pv[f] === undefined) continue;
    const r = ranks(have.map(t => low ? -t.pv[f] : t.pv[f])); have.forEach((t,i) => { (t.prk = t.prk || {})[f] = r[i]; });
  }
}
const trendArrow = (t, f) => { const p = t.prk && t.prk[f]; if (p == null) return ''; const mv = p - t.rk[f]; return Math.abs(mv) < 3 ? '' : `<span class="mv sm ${mv>0?'up':'down'}" title="Was ${ord(p)} last week">${mv>0?'up':'down'} ${Math.abs(mv)}</span>`; };

/* luck, steadiness and the market's opinion of each team */
T.forEach(t => { const k = t.d.lk; t.luck = k ? 4.5*(k.fum + k.int) + k.fg : null; const gs = t.g.map(e => gameScore0(t, e)); t.swing = gs.length >= 3 ? sdev(gs) : null; });
function gameScore0(t, e){ const o = byName[e.opp], opw = o ? o.d.pw : M.fcs, s = e.site==='H' ? 1 : e.site==='A' ? -1 : 0; return 50 + 14*(clamp(e.pf - e.pa, -38, 38) + opw - s*M.hfa)/M.k; }     // not capped at 0 and 100, so swings at the extremes still count
{
  const rk = (rows, val, key) => [...rows].sort((a,b) => val(b)-val(a)).forEach((t,i) => { t[key] = i+1; });
  rk(T.filter(t => t.luck != null), t => t.luck, 'luckRank');                    // 1 = luckiest
  rk(T.filter(t => t.swing != null), t => -t.swing, 'swingRank');                // 1 = steadiest
  rk(T.filter(t => t.d.mkt != null), t => t.d.mkt, 'mktRank');
}
const steadyWord = t => { if (t.swingRank == null) return null; const n = T.filter(x => x.swing != null).length; return t.swingRank <= n/3 ? 'Steady' : t.swingRank <= 2*n/3 ? 'Typical' : 'Up and down'; };
const idxPts = t => t.cz * slopeAt(M.through);                                  // LTF on a points scale, for comparing with the market

/* where an LTF line comes from, in points for the home team */
function lineParts(g){
  const h = byName[g.h], a = byName[g.a]; if (!h || !a) return null;
  const wk = g.done ? g.w - 1 : M.through, hh = h.hist[wk], ah = a.hist[wk];
  if (!hh || !ah || !WK[wk]) return null;
  const tot = COMP.reduce((s,c) => s + W[c.k], 0) || 1, k = slopeAt(wk) / WK[wk].sd;
  const parts = COMP.filter(c => W[c.k] > 0).map(c => ({k:c.k, name:c.name, pts: k*(W[c.k]/tot)*(hh.parts[c.k] - ah.parts[c.k])}));
  const hf = g.n ? 0 : M.hfa;
  return {parts, hf, m: parts.reduce((s,p) => s + p.pts, 0) + hf};
}

/* one performance on LTF scale */
function gameScore(t, e){
  const o = byName[e.opp], opw = o ? o.d.pw : M.fcs, s = e.site==='H' ? 1 : e.site==='A' ? -1 : 0;
  return clamp(50 + 14*(clamp(e.pf - e.pa, -38, 38) + opw - s*M.hfa)/M.k, 0, 100);
}
const gsCell = v => `<span class="gs g${v>=80?0:v>=62?1:v>=45?2:v>=30?3:4}">${Math.round(v)}</span>`;

/* confidence, from how LTF did in past seasons */
const confWin = p => { const v = Math.max(p, 1-p)*100; return BT.conf.find(c => v >= c.lo && (v < c.hi || c.hi === 100)) || null; };
const confAts = gap => { const v = Math.abs(gap); return BT.ats.find(c => v >= c.lo && v < c.hi) || null; };

/* projected score: the LTF line around a total built from points per drive and pace */
let _totK = null, _mAct = 52, _mMod = 52;
const TOT_SLOPE = 0.42;     // how much of the model's swing away from an average total held up when tested on games it had not seen
function totalFor(A, B){ const Lp = _lppd || (_lppd = mean(T.map(t => t.d.oppd))); return ((A.d.oppd + B.d.dppd - Lp) + (B.d.oppd + A.d.dppd - Lp)) * (A.d.dpg + B.d.dpg)/2; }
let _lppd = null;
function projScore(g){
  const h = byName[g.h], a = byName[g.a], x = gameLine(g); if (!h || !a || !x || g.done) return null;
  if (_totK == null){ const fin = G.filter(q => q.done && byName[q.h] && byName[q.a]); _totK = 1; if (fin.length){ _mAct = mean(fin.map(q => q.hp + q.ap)); _mMod = mean(fin.map(q => totalFor(byName[q.a], byName[q.h]))); } }
  const tot = clamp(_mAct + TOT_SLOPE*(totalFor(a, h) - _mMod), 24, 95);
  let hp = Math.round((tot + x.m)/2), ap = Math.round((tot - x.m)/2);
  if (hp === ap && Math.abs(x.m) >= 0.5){ if (x.m > 0) hp++; else ap++; }
  return {hp: Math.max(hp, 3), ap: Math.max(ap, 3), tot};
}

/* the rest of the season, played out many times */
const SIMS = 2500, TAU = 0.4, GSIG = 15.5, WINS = [6,7,8,9,10,11,12];
function simulate(asOf){
  if (_sim[asOf]) return _sim[asOf];
  const n = T.length, ix = new Map(T.map((t,i) => [t.n, i])), sl = slopeAt(asOf), fz = M.fcs/sl, gamLast = gammaAt(99);
  const z0 = T.map(t => (t.hist[asOf] || t.hist[M.through]).z);
  const w0 = new Float64Array(n), l0 = new Float64Array(n), cw0 = new Float64Array(n), cl0 = new Float64Array(n);
  const todo = [];
  for (const g of G){
    const h = ix.has(g.h) ? ix.get(g.h) : -1, a = ix.has(g.a) ? ix.get(g.a) : -1;
    if (g.done && g.w <= asOf){
      const hw = g.hp > g.ap;
      if (h >= 0){ if (hw) w0[h]++; else l0[h]++; if (g.c){ if (hw) cw0[h]++; else cl0[h]++; } }
      if (a >= 0){ if (!hw) w0[a]++; else l0[a]++; if (g.c){ if (!hw) cw0[a]++; else cl0[a]++; } }
    } else {
      const zh = h >= 0 ? z0[h] : fz, za = a >= 0 ? z0[a] : fz, hf = g.n ? 0 : M.hfa;
      todo.push({h, a, c:g.c, hf, gam: gammaAt(g.w), pe: phi((sl*(zh-za) + hf)/M.sigma)});
    }
  }
  const confs = CONFS.filter(c => c.tier).map(c => ({p4: c.tier==='P4', m: c.teams.map(t => ix.get(t.n))}));
  const nd = ix.has('Notre Dame') ? ix.get('Notre Dame') : -1;
  const isG6 = T.map(t => t.tier==='G6' && t.c !== 'Independent');
  let seed = (20260000 + asOf*7919) >>> 0;
  const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const norm = () => (rnd()+rnd()+rnd()+rnd()+rnd()+rnd() - 3) * Math.SQRT2;
  const po = new Float64Array(n), cf = new Float64Array(n), bowl = new Float64Array(n), out = new Float64Array(n), xw = new Float64Array(n);
  const ge = WINS.map(() => new Float64Array(n));      // seasons with at least 6, 7, ... 12 wins
  const zt = new Float64Array(n), zs = new Float64Array(n), w = new Float64Array(n), l = new Float64Array(n), cw = new Float64Array(n), cl = new Float64Array(n), perf = new Uint8Array(n), inF = new Uint8Array(n);
  const order = T.map((t,i) => i);
  for (let s = 0; s < SIMS; s++){
    for (let i = 0; i < n; i++){ zt[i] = z0[i] + TAU*norm(); zs[i] = z0[i]; w[i] = w0[i]; l[i] = l0[i]; cw[i] = cw0[i]; cl[i] = cl0[i]; perf[i] = 1; inF[i] = 0; }
    for (const g of todo){
      const zh = g.h >= 0 ? zt[g.h] : fz, za = g.a >= 0 ? zt[g.a] : fz;
      const hw = rnd() < phi((sl*(zh-za) + g.hf)/GSIG);
      if (g.h >= 0){ if (hw) w[g.h]++; else { l[g.h]++; perf[g.h] = 0; } if (g.c){ if (hw) cw[g.h]++; else cl[g.h]++; } zs[g.h] += g.gam*((hw?1:0) - g.pe); }
      if (g.a >= 0){ if (!hw) w[g.a]++; else { l[g.a]++; perf[g.a] = 0; } if (g.c){ if (!hw) cw[g.a]++; else cl[g.a]++; } zs[g.a] += g.gam*((hw?0:1) - (1-g.pe)); }
    }
    const champs = [];
    for (const c of confs){   // the top two by conference record meet for the title
      const key = i => (cw[i]+cl[i] ? cw[i]/(cw[i]+cl[i]) : 0)*100 + cw[i] + zs[i]*0.01 + rnd()*0.005;
      const m = [...c.m].sort((x,y) => key(y)-key(x)), a = m[0], b = m[1];
      const pe = phi(sl*(z0[a]-z0[b])/M.sigma), aw = rnd() < phi(sl*(zt[a]-zt[b])/GSIG), ch = aw ? a : b;
      zs[a] += gamLast*((aw?1:0) - pe); zs[b] += gamLast*((aw?0:1) - (1-pe));
      cf[ch]++; if (c.p4) champs.push(ch);
    }
    order.sort((x,y) => zs[y]-zs[x]);
    let count = 0;
    for (const c of champs){ if (!inF[c]){ inF[c] = 1; count++; } }
    for (const i of order){ if (isG6[i]){ if (!inF[i]){ inF[i] = 1; count++; } break; } }
    if (nd >= 0 && !inF[nd] && order.indexOf(nd) < 12){ inF[nd] = 1; count++; }
    for (const i of order){ if (count >= 12) break; if (!inF[i]){ inF[i] = 1; count++; } }
    for (let i = 0; i < n; i++){ if (inF[i]) po[i]++; if (w[i] >= 6) bowl[i]++; if (perf[i]) out[i]++; xw[i] += w[i]; for (let k = 0; k < WINS.length; k++) if (w[i] >= WINS[k]) ge[k][i]++; }
  }
  const res = {};
  T.forEach((t,i) => { res[t.n] = {po: po[i]/SIMS, cf: cf[i]/SIMS, bowl: bowl[i]/SIMS, out: out[i]/SIMS, xw: xw[i]/SIMS, ge: WINS.map((k,j) => ge[j][i]/SIMS)}; });
  return _sim[asOf] = res;
}
const odds = t => simulate(M.through)[t.n];
const pct = v => v >= .995 ? '>99%' : v < .005 ? '<1%' : Math.round(v*100) + '%';

/* what this week's game is worth */
function stakes(t){
  const e = t.sched.find(x => !x.game.done); if (!e) return null;
  const p = winProb(t, e), g = gammaAt(e.wk), rk = zv => 1 + T.filter(x => x !== t && x.cz > zv).length;
  return {e, p, win: rk(t.cz + g*(1-p)), lose: rk(t.cz - g*p)};
}

/* why a team moved */
function whyMoved(t){
  if (PREV == null || !t.hist[PREV]) return '';
  const a = t.hist[PREV], b = t.hist[M.through], mv = a.rank - b.rank;
  const gm = t.g.filter(e => e.wk === M.through).pop();
  const played = gm ? `${gm.pf>gm.pa?'Beat':'Lost to'} ${teamRef(gm.opp)} ${scoreTxt(gm)}${gm.site==='A'?' on the road':gm.site==='N'?' at a neutral site':''}, a game score of ${Math.round(gameScore(t, gm))}.` : 'Did not play, so any movement comes from other teams and from opponents\' results.';
  const tot = COMP.reduce((s,c) => s + W[c.k], 0) || 1;
  const ch = COMP.filter(c => W[c.k] > 0).map(c => ({c, d:(b.parts[c.k]-a.parts[c.k])*W[c.k]/tot, from:a.prk[c.k], to:b.prk[c.k]})).sort((x,y) => Math.abs(y.d)-Math.abs(x.d));
  const big = ch.filter(x => x.from !== x.to).slice(0,2).map(x => `${x.c.name.toLowerCase()} went from ${ord(x.from)} to ${ord(x.to)}`);
  const head = mv > 0 ? `Up ${mv} from No. ${a.rank}.` : mv < 0 ? `Down ${-mv} from No. ${a.rank}.` : `Held at No. ${b.rank}.`;
  return `<b>${head}</b> ${played}${big.length ? ` Biggest changes: ${list(big)}.` : ''}`;
}
const statProse = (s, allowed) => s.k === 'sdn' ? `success rate${allowed ? ' allowed' : ''} on standard downs` : s.k === 'pdn' ? `success rate${allowed ? ' allowed' : ''} on passing downs` : lc(s.n) + (allowed ? ' allowed' : '');     // a stat's name the way it reads in a sentence
function strengths(t){
  const all = [];
  for (const s of STATS){ if (s.o) all.push({n:statProse(s), r:t.rk[s.o], side:'offense'}); all.push({n:statProse(s, !s.dHigh), r:t.rk[s.d], side:'defense'}); }
  all.sort((a,b) => a.r - b.r);
  const f = x => `${x.n} (${ord(x.r)})`;
  return {best: all.slice(0,3).map(f), worst: all.slice(-3).reverse().map(f)};
}
const fbsGamesPlayed = t => t.g.filter(e => !e.fcs).length;

/* the matchup in sentences */
function mismatch(off, def){   // the stat where this offense has its biggest edge over that defense
  let best = null;
  for (const s of STATS){ if (!s.o || s.k === 'yds') continue; const gap = def.rk[s.d] - off.rk[s.o]; if (!best || gap > best.gap) best = {s, gap, or: off.rk[s.o], dr: def.rk[s.d]}; }
  return best;
}
function preview(g){
  const h = byName[g.h], a = byName[g.a], x = gameLine(g), lp = lineParts(g); if (!h || !a || !x || !lp) return '';
  const fav = x.fav, dog = fav === h ? a : h, sign = fav === h ? 1 : -1, p = Math.max(x.pHome, 1-x.pHome), cw = confWin(p), out = [];
  if (x.pts === 0) out.push(`LTF has this as a pick 'em, with nothing between the two teams once home field is counted.`);
  else out.push(`LTF makes ${esc(fav.n)} ${anA(x.pts)} ${x.pts}-point favorite${g.n ? ' at a neutral site' : fav === h ? ' at home' : ' on the road'} and gives them a ${clamp(Math.round(p*100),50,99)}% chance to win.${cw ? ` In past seasons, favorites at this level won ${cw.act}% of the time.` : ''}`);
  const drivers = lp.parts.map(q => ({name:q.name.toLowerCase(), pts:q.pts*sign})).sort((q,r) => r.pts-q.pts);
  const forFav = drivers.filter(q => q.pts >= 0.75).slice(0,2), against = drivers.filter(q => q.pts <= -0.75);
  if (forFav.length) out.push(`Most of that comes from ${list(forFav.map(q => `${q.name} (${q.pts.toFixed(1)} points)`))}${!g.n && fav === h ? `, plus ${M.hfa} for home field` : ''}.${against.length ? ` ${esc(dog.n)} has the better ${list(against.map(q => q.name))}, which pulls the line back by ${Math.abs(against.reduce((s,q) => s+q.pts, 0)).toFixed(1)}.` : ''}`);
  const m1 = mismatch(fav, dog), m2 = mismatch(dog, fav);
  const unit = (s, t) => s.k === 'ru' ? [`${esc(t.n)}'s run game`, 'run defense'] : s.k === 'pa' ? [`${esc(t.n)}'s passing game`, 'pass defense'] : [`${esc(t.n)}'s offense`, 'defense'];
  if (m1 && m1.gap >= 15){ const [o, d] = unit(m1.s, fav); out.push(`The biggest mismatch favors ${o}: they are ${ord(m1.or)} in ${statProse(m1.s)}, and ${esc(dog.n)}'s ${d} is ${ord(m1.dr)}.`); }
  if (m2 && m2.gap >= 15){ const [o, d] = unit(m2.s, dog); out.push(`${o} gives them a shot: they are ${ord(m2.or)} in ${statProse(m2.s)}, and ${esc(fav.n)}'s ${d} is ${ord(m2.dr)}.`); }
  else if (m2) out.push(`${esc(dog.n)} has no clear edge when they have the ball. Their best matchup is ${statProse(m2.s)}, where they are ${ord(m2.or)} and ${esc(fav.n)}'s defense is ${ord(m2.dr)}.`);
  return out.map(sn => `<p>${sn}</p>`).join('');
}
/* the LTF Edge: the gap between the LTF line and the market line, and which team it points to */
function edgeOf(g){
  const x = gameLine(g); if (!x || g.hs == null) return null;
  const gap = x.m + g.hs, pts = half(gap), t = byName[gap > 0 ? g.h : g.a];
  return {gap, pts, t, none: pts < 1, band: confAts(gap)};
}
const edgeTxt = (e, ab) => !e ? '–' : e.none ? '<span class="cf">None</span>' : `<b class="edge">${esc(ab ? e.t.ab : e.t.n)} +${e.pts}</b>`;
function edgeReasons(g){   // why LTF and the market might differ, when they do
  const h = byName[g.h], a = byName[g.a], e = edgeOf(g); if (!h || !a || !e) return [];
  const side = e.t, other = side === h ? a : h, why = [];
  const field = t => (W.res*t.z.res + W.off*t.z.off + W.def*t.z.def)/((W.res+W.off+W.def) || 1);
  const lift = (field(side) - side.z.cmp) - (field(other) - other.z.cmp);
  if (lift > 0.5) why.push(`LTF is going on this season. ${esc(side.n)} has played better than their long-run ratings, or ${esc(other.n)} worse, and the market tends to trust the longer history.`);
  for (const t of [side, other]) if (fbsGamesPlayed(t) <= 2) why.push(`${esc(t.n)} has faced only ${fbsGamesPlayed(t)} FBS ${fbsGamesPlayed(t)===1?'opponent':'opponents'}, so their numbers rest on thin evidence.`);
  const scores = side.g.map(q => gameScore(side, q)).sort((p,q) => q-p);
  if (scores.length >= 3 && scores[0] - scores[1] >= 22) why.push(`${esc(side.n)}'s rating leans on one big game. Their best game score is ${Math.round(scores[0])} and their next best is ${Math.round(scores[1])}.`);
  if (side.luck != null && side.luck >= 3) why.push(`${esc(side.n)} has had about ${side.luck.toFixed(1)} points a game of good luck, which flatters their numbers.`);
  why.push(`LTF cannot see injuries, suspensions or a change at quarterback. The market can.`);
  return why;
}
function disagreement(g){
  const e = edgeOf(g); if (!e || e.pts < 3) return '';
  return `<section class="sec"><h2>The LTF Edge</h2><p class="pdek"><b>${esc(e.t.n)} +${e.pts}.</b> LTF rates ${esc(e.t.n)} ${e.pts} points better than the market does.${e.band ? ` In past seasons the LTF side beat the spread ${e.band.hit}% of the time at this size of gap, across ${e.band.n.toLocaleString()} games. A coin flip is 50%, and a bettor needs about 52.4% to break even.` : ''}</p>
    <h3>Why the two might differ</h3><ul class="why">${edgeReasons(g).map(q => `<li>${q}</li>`).join('')}</ul></section>`;
}

/* confidence: the chance the LTF pick wins. With a market line it blends both lines the way five past seasons say to. */
const CFD = M.cfd || {cf:{b0:.0775, bm:.0084, bk:.0976}, mk:{agree:{act:74.9, pred:72}, split:{act:43.7, n:252}}, hz:[], steady:{pred:70.9, act:74.2, n:733}};
const confLabel = s => s < 45 ? 'Contested' : s < 60 ? 'Toss-up' : s < 75 ? 'Lean' : s < 90 ? 'Likely' : 'Very likely';
function confidence(g){
  const x = gameLine(g), h = byName[g.h], a = byName[g.a]; if (!x || !h || !a || g.done) return null;
  const pick = x.m >= 0 ? h : a, other = pick === h ? a : h, m = Math.abs(x.m), pL = phi(m/M.sigma), lp = lineParts(g);
  const ahead = M.next == null ? 0 : g.w - M.next, why = [];
  let p = pL, mk = null;
  if (g.hs != null){ mk = pick === h ? -g.hs : g.hs; const c = CFD.cf; p = 1/(1 + Math.exp(-(c.b0 + c.bm*m + c.bk*mk))); }
  const score = clamp(Math.round(p*100), 1, 99), ltfPct = clamp(Math.round(pL*100), 50, 99);
  why.push({d:0, t: x.pts === 0 ? `LTF has the two teams dead even once home field is counted.` : `LTF has ${esc(pick.n)} by ${x.pts}, which on its own is a ${ltfPct}% chance to win.`});
  if (mk == null) why.push({d:0, t: ahead > 0 ? `No market line is posted yet, so this rests on LTF alone.` : `No market line is posted, so this rests on LTF alone.`});
  else if (mk > 0 && score <= ltfPct - 3) why.push({d:-1, t:`The market also picks ${esc(pick.n)}, but by only ${half(mk)}. Past seasons say the market's number is the better guide, so the score comes down.`});
  else if (mk > 0 && score >= ltfPct + 3) why.push({d:1, t:`The market likes ${esc(pick.n)} even more and has them by ${half(mk)}. That lifts the score.`});
  else if (mk > 0) why.push({d:1, t:`The market agrees and has ${esc(pick.n)} by ${half(mk)}.`});
  else if (mk < 0) why.push({d:-1, t:`The market disagrees and has ${esc(other.n)} by ${half(mk)}. When that happened in past seasons, the LTF pick won only ${CFD.mk.split.act}% of the time.`});
  else why.push({d:0, t:`The market has this game as a pick 'em.`});
  if (ahead >= 1){ const hz = (CFD.hz || []).find(q => ahead+1 >= q.lo && ahead+1 <= q.hi); why.push({d:0, t:`The game is ${NUMW[ahead+1] || ahead+1} weeks away and both teams will change by then.${hz ? ` Picks made ${hz.lab} were right ${hz.act}% of the time, against ${CFD.hz[0].act}% for next week's games.` : ''}`}); }
  if (lp){
    const sign = pick === h ? 1 : -1, rows = [...lp.parts.map(q => ({n:q.name.toLowerCase(), v:q.pts*sign})), ...(lp.hf ? [{n:'home field', v:lp.hf*sign}] : [])];
    const forP = rows.filter(q => q.v >= 0.75).sort((q,r) => r.v-q.v).slice(0,2), ag = rows.filter(q => q.v <= -0.75).sort((q,r) => q.v-r.v).slice(0,2);
    if (forP.length) why.push({d:0, t:`Where the line comes from: ${list(forP.map(q => `${q.n} (+${q.v.toFixed(1)})`))}${ag.length ? `. Working against it: ${list(ag.map(q => `${q.n} (−${Math.abs(q.v).toFixed(1)})`))}` : ''}.`});
    if (!g.n && pick === h && m <= M.hfa && x.pts > 0) why.push({d:-1, t:`Take away home field and ${esc(other.n)} would be the pick.`});
  }
  for (const t of [pick, other]) if (fbsGamesPlayed(t) <= 2) why.push({d:-1, t:`${esc(t.n)} has faced only ${fbsGamesPlayed(t)} FBS ${fbsGamesPlayed(t)===1?'opponent':'opponents'}, so their numbers are thin.`});
  for (const t of [pick, other]){ const sp = MOM && momentum(t).spot; if (sp && sp.k === 'bounce' && ahead <= 0) why.push({d:0, t:`${esc(t.n)} lost as ${favTxt(sp.e)} last time out. In past seasons LTF was about ${Math.abs(MOM.upL.ltf).toFixed(0)} points too low on teams in that spot the next week.`}); }
  if (steadyWord(pick) === 'Steady' && score >= 55) why.push({d:1, t:`${esc(pick.n)} has played to the same level every week. Steady favorites won ${CFD.steady.act}% of the time when LTF expected ${CFD.steady.pred}%.`});
  else if (steadyWord(pick) === 'Up and down') why.push({d:0, t:`${esc(pick.n)} has swung a lot from week to week, so a surprise either way is more likely.`});
  return {pick, other, p, score, label: confLabel(score), ltfPct, mk, why};
}
const confMeter = c => `<span class="cm c${c.score < 45 ? 0 : c.score < 60 ? 1 : c.score < 75 ? 2 : c.score < 90 ? 3 : 4}" role="img" aria-label="Confidence ${c.score} out of 100, ${c.label.toLowerCase()}"><i></i><i></i><i></i><i></i><i></i></span>`;
const confCell = c => !c ? '–' : `<span class="cfs"><b>${c.score}</b>${confMeter(c)}<span class="cf">${c.label}</span></span>`;
const whyList = (c, n) => !c ? '' : `<ul class="wl">${c.why.slice(0, n || 99).map(w => `<li class="${w.d > 0 ? 'u' : w.d < 0 ? 'dn' : ''}">${w.t}</li>`).join('')}</ul>`;

function breakdown(g){   // bars showing where the line comes from
  const lp = lineParts(g), x = gameLine(g); if (!lp || !x) return '';
  const h = byName[g.h], a = byName[g.a], rows = [...lp.parts.map(p => ({n:p.name, v:p.pts})), ...(lp.hf ? [{n:'Home field', v:lp.hf}] : [])];
  const mx = Math.max(4, ...rows.map(r => Math.abs(r.v)));
  const bar = r => { const w = Math.abs(r.v)/mx*50, to = r.v >= 0 ? h : a;
    return `<div class="bd"><span class="bn">${r.n}</span><span class="bt"><i style="${r.v>=0?'left:50%':'right:50%'};width:${w.toFixed(1)}%;background:${esc(to.col)}"></i></span><span class="bv">${Math.abs(r.v) < 0.05 ? 'Even' : `${esc(to.ab)} +${Math.abs(r.v).toFixed(1)}`}</span></div>`; };
  return `<div class="bdw"><div class="bdh"><span>${esc(a.ab)}</span><span>${esc(h.ab)}</span></div>${rows.map(bar).join('')}
    <div class="bd tot"><span class="bn">LTF line</span><span class="bt"></span><span class="bv">${lineTxt(x, true)}</span></div></div>`;
}
const form = t => t.g.slice(-3).map(e => `<span class="fm ${e.pf>e.pa?'w':'l'}" title="${e.pf>e.pa?'Beat':'Lost to'} ${esc(e.opp)} ${scoreTxt(e)}${e.cm == null ? '' : e.cm>0 ? ', covered' : e.cm<0 ? ', did not cover' : ', push'}">${e.pf>e.pa?'W':'L'}${e.cm > 0 ? '<i></i>' : ''}</span>`).join('');
const moveWords = mv => !mv ? '<span class="mv same">same</span>' : `<span class="mv ${mv>0?'up':'down'}">${mv>0?'up':'down'} ${Math.abs(mv)}</span>`;
const lastWeek = t => t.prevRank == null ? '\u2013' : `${t.prevRank}, ${moveWords(t.move)}`;
function suRecord(){   // how LTF's favorite has done straight up this season, where it had a line before kickoff
  let w = 0, n = 0;
  for (const g of G){ if (!g.done) continue; const x = gameLine(g); if (!x || x.pts === 0) continue; n++; if ((x.m > 0) === (g.hp > g.ap)) w++; }
  return {w, n};
}
