/* ================= share cards ================= */
/* One picture per team, game or list, drawn on a canvas so it can be saved, sent, or used as the preview when a link
   is posted. Wide cards are 1200 by 630, the shape link previews use. Tall cards are 1080 by 1350, for lists that need
   the room. Every card carries the site's name and the week it describes, so a screenshot says where it came from.
   Text is always fitted to its box, so a long team name shrinks instead of running off the edge. */
const CARD_SIZE = {wide: [1200, 630], tall: [1080, 1350]};
const CK = {ink:'#15171A', paper:'#FFFFFF', alt:'#F2F3F5', line:'#D8DBE0', muted:'#5A616B', bar:'#000000', barMuted:'#AEB4BD',
            pylon:'#F2580A', turf:'#1E6A4C', lit:'#43A575', good:'#0B7F45', bad:'#C62828', goodLit:'#3ED18B', badLit:'#FF6B62'};
const SITE_ADDR = SITE && SITE.url ? SITE.url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '') : '';
const cfont = (px, wt, o = {}) => `${o.it ? 'italic ' : ''}${wt || 700} ${o.w || 'normal'} ${px}px Archivo, system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
function cText(c, str, x, y, o){   // one line of text. o.max is the widest it may be; it shrinks to fit.
  const s = o.caps ? String(str).toUpperCase() : String(str); let px = o.px;
  c.font = cfont(px, o.wt, o);
  if (o.max){ const w = c.measureText(s).width; if (w > o.max){ px = Math.max(o.min || 12, Math.floor(px * o.max / w)); c.font = cfont(px, o.wt, o); } }
  c.fillStyle = o.color || '#fff'; c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'alphabetic';
  if (o.alpha != null){ c.save(); c.globalAlpha = o.alpha; c.fillText(s, x, y); c.restore(); } else c.fillText(s, x, y);
  return c.measureText(s).width;
}
function cWrap(c, str, x, y, maxW, lineH, o, maxLines = 3){   // a short paragraph, broken at spaces. Returns the y after the last line.
  c.font = cfont(o.px, o.wt, o);
  const words = String(str).split(/\s+/), lines = []; let cur = '';
  for (const w of words){ const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  if (lines.length > maxLines){ lines.length = maxLines; lines[maxLines-1] = lines[maxLines-1].replace(/[\s,.]+\S*$/, '') + '…'; }
  lines.forEach((ln, i) => cText(c, ln, x, y + i*lineH, {...o, max: maxW}));
  return y + lines.length*lineH;
}
function cSlab(c, x, y, w, h, fill, lean){   // a bar that leans forward, the way the logo mark does
  const d = lean == null ? h * 7/24 : lean;
  c.beginPath(); c.moveTo(x + d, y); c.lineTo(x + w + d, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); c.fillStyle = fill; c.fill();
}
function cMark(c, x, y, h){   // the logo mark, h tall
  const k = h/24; cSlab(c, x, y, 23*k, h, CK.pylon, 7*k);
  c.strokeStyle = '#fff'; c.lineWidth = 2.2*k; c.beginPath();
  for (const sx of [12.5, 17.5, 22.5]){ c.moveTo(x + sx*k, y + 5*k); c.lineTo(x + (sx - 4.1)*k, y + 19*k); }
  c.stroke();
}
function cWordmark(c, x, y, px, color){   // LEVEL the FIELD, as in the header. Returns where it ends.
  for (const [w, wt, a] of [['LEVEL', 900, 1], [' THE ', 500, .85], ['FIELD', 900, 1]]) x += cText(c, w, x, y, {px, wt, it:true, w:'condensed', color, alpha:a, base:'middle'});
  return x;
}
function cStrip(c, x, y, w, h, pct){   // the field: the lit part runs to the team's score, and the pylon marks it
  const at = x + w*clamp(pct, 0, 100)/100;
  c.fillStyle = CK.turf; c.fillRect(x, y, w, h); c.fillStyle = CK.lit; c.fillRect(x, y, at - x, h);
  c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 1; i < 10; i++) c.fillRect(x + w*i/10 - 1, y, 2, h);
  c.fillStyle = CK.pylon; c.fillRect(at - h*0.11, y - h*0.22, h*0.22, h*1.44);
}
const _logoImg = {};
function cardLogo(t){   // the team's logo as a picture, when the site has its own copy. Otherwise nothing, and the card draws the team's colors.
  if (!t || !t.lg || !LOCAL.has(t.lg) || t.noLocal || !logosOn()) return Promise.resolve(null);
  return _logoImg[t.n] || (_logoImg[t.n] = new Promise(res => {
    const im = new Image(); let done = false; const end = v => { if (!done){ done = true; res(v); } };
    im.onload = () => end(im); im.onerror = () => end(null); setTimeout(() => end(null), 6000); im.src = logoSrc(t, false);
  }));
}
function cBadge(c, t, im, x, y, s, plate){   // a team's mark in a square s wide: the logo, or the abbreviation on the team's color
  if (plate){ cSlab(c, x - s*0.06, y - s*0.08, s*1.12, s*1.16, '#fff', s*0.2); }
  if (im){ const r = Math.min(s/im.width, s/im.height), w = im.width*r, h = im.height*r, off = plate ? s*0.1 : 0; c.drawImage(im, x + (s - w)/2 + off, y + (s - h)/2, w, h); return; }
  if (!t){ cSlab(c, x, y + s*0.2, s*0.86, s*0.6, CK.muted, s*0.14); cText(c, 'FCS', x + s*0.5, y + s*0.52, {px:s*0.3, wt:800, w:'condensed', color:'#fff', align:'center', base:'middle', max:s*0.7}); return; }
  if (plate){ cText(c, t.ab, x + s*0.6, y + s*0.52, {px:s*0.44, wt:900, it:true, w:'condensed', color: t.fg === '#FFFFFF' ? t.col : CK.ink, align:'center', base:'middle', max:s*0.86}); return; }
  cSlab(c, x, y + s*0.16, s*0.86, s*0.68, t.col, s*0.14);
  cText(c, t.ab, x + s*0.5, y + s*0.52, {px:s*0.32, wt:800, w:'condensed', color:t.fg, align:'center', base:'middle', max:s*0.7});
}
function cFoot(c, W, H, h, note){   // the black strip along the bottom of every card: the site's name, what the card shows, and the address
  c.fillStyle = CK.bar; c.fillRect(0, H - h, W, h);
  const mh = h*0.4, pad = W*0.047, y = H - h/2;
  cMark(c, pad, y - mh/2, mh);
  const end = cWordmark(c, pad + mh*30/24 + h*0.16, y + h*0.02, h*0.36, '#fff');
  const right = [note, SITE_ADDR].filter(Boolean);
  if (right.length === 2){
    cText(c, right[0], W - pad, y - h*0.13, {px:h*0.25, wt:600, color:CK.barMuted, align:'right', base:'middle', max:W - pad*2 - end - 40});
    cText(c, right[1], W - pad, y + h*0.2, {px:h*0.25, wt:700, color:'#fff', align:'right', base:'middle', max:W - pad*2 - end - 40});
  } else if (right.length) cText(c, right[0], W - pad, y + h*0.02, {px:h*0.29, wt:600, color:CK.barMuted, align:'right', base:'middle', max:W - pad*2 - end - 40});
}
const weekNote = () => `LTF Index after week ${M.through}`;
const etTime = g => { const d = new Date(g.d); if (isNaN(d)) return '';
  const day = d.toLocaleDateString('en-US', {timeZone:'America/New_York', weekday:'short', month:'short', day:'numeric'});
  return g.tbd ? day : `${day}, ${d.toLocaleTimeString('en-US', {timeZone:'America/New_York', hour:'numeric', minute:'2-digit'})} ET`; };
const plain = s => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const moveTxt = mv => mv == null ? '' : mv > 0 ? `up ${mv}` : mv < 0 ? `down ${-mv}` : 'same';

/* ---------- one team ---------- */
async function cardTeam(c, W, H, t){
  const im = await cardLogo(t), fg = t.fg, P = 56, foot = 84, soft = fg === '#FFFFFF' ? 'rgba(255,255,255,.82)' : 'rgba(16,17,20,.74)';
  c.fillStyle = t.col; c.fillRect(0, 0, W, H);
  c.save(); c.beginPath(); c.rect(0, 0, W, H - foot); c.clip();      // the abbreviation, huge and faint, the way the team page does it
  cText(c, t.ab, W + 30, 330, {px:520, wt:900, it:true, w:'extra-condensed', color:fg, alpha:.08, align:'right', base:'middle'});
  c.restore();
  cBadge(c, t, im, P + 8, P + 6, 118, true);
  cText(c, t.n, P + 176, P + 62, {px:76, wt:900, w:'condensed', color:fg, max:W - P*2 - 190});
  const conf = t.c === 'Independent' ? '' : `, ${t.cw}-${t.cl} in the ${t.c}`;
  const mv = t.move == null ? '' : t.move > 0 ? ` Up ${t.move} since last week.` : t.move < 0 ? ` Down ${-t.move} since last week.` : ' Same spot as last week.';
  cText(c, `${t.w}-${t.l}${conf}.${mv}`, P + 178, P + 110, {px:30, wt:600, color:soft, max:W - P*2 - 190});
  // the numbers: rank and score large, then the four parts of the score
  const y1 = 322, cols = [[`No. ${t.rank}`, `of ${T.length} teams`, t.rank > 99 ? 2.25 : 1.9], [t.idx.toFixed(1), 'LTF Index', 1.55], ...COMP.map(k => [ord(t.rk[k.k]), k.col.toLowerCase(), 1])];
  const unit = (W - P*2) / cols.reduce((s, q) => s + q[2], 0); let x = P;
  cols.forEach(([big, small, w], i) => {
    cText(c, big, x, y1, {px: i < 2 ? 104 : 64, wt:900, it:true, w:'condensed', color:fg, max:unit*w - (i < 2 ? 40 : 22)});
    cText(c, small, x + 2, y1 + 40, {px:26, wt:600, color:soft, max:unit*w - 16});
    x += unit*w;
  });
  cStrip(c, P, 400, W - P*2, 22, t.idx);
  const e = t.sched.find(q => !q.game.done);
  let next = 'Regular season complete.';
  if (e){ const o = byName[e.opp], x2 = gameLine(e.game), fav = x2 ? (x2.pts === 0 ? "a pick 'em" : `${x2.fav.n} by ${x2.pts}`) : null;
    next = `Next: ${e.site === 'A' ? 'at' : 'vs'} ${o ? `No. ${o.rank} ` : ''}${e.opp}${e.site === 'N' ? ' at a neutral site' : ''}, ${etTime(e.game)}.${fav ? ` LTF line: ${fav}.` : ''}`; }
  cText(c, next, P, 478, {px:32, wt:700, color:fg, max:W - P*2});
  cFoot(c, W, H, foot, weekNote());
}

/* ---------- one game ---------- */
async function cardGame(c, W, H, g){
  const a = byName[g.a], h = byName[g.h], [ia, ih] = await Promise.all([cardLogo(a), cardLogo(h)]), foot = 84, top = 318, mid = W/2;
  const side = (t, name, x0, x1, im, pts, won) => {
    const col = t ? t.col : '#3A3F47', fg = t ? t.fg : '#FFFFFF', soft = fg === '#FFFFFF' ? 'rgba(255,255,255,.82)' : 'rgba(16,17,20,.74)', left = x0 === 0, cx = left ? 56 : W - 56, al = left ? 'left' : 'right';
    c.fillStyle = col; c.fillRect(x0, 0, x1 - x0, top);
    c.save(); c.beginPath(); c.rect(x0, 0, x1 - x0, top); c.clip();
    if (pts == null) cText(c, t ? t.ab : 'FCS', left ? x0 - 20 : x1 + 20, 120, {px:300, wt:900, it:true, w:'extra-condensed', color:fg, alpha:.09, align: left ? 'left' : 'right', base:'middle'});
    c.restore();
    cBadge(c, t, im, left ? 62 : W - 62 - 104, 40, 104, true);
    cText(c, name, cx, 222, {px:58, wt:900, w:'condensed', color:fg, align:al, max:mid - 150});
    cText(c, t ? `No. ${t.rank}, ${t.w}-${t.l}` : 'FCS team', cx, 264, {px:28, wt:600, color:soft, align:al, max:mid - 150});
    if (pts != null) cText(c, pts, left ? mid - 136 : mid + 136, 118, {px:168, wt:900, it:true, w:'condensed', color:fg, alpha: won ? 1 : .55, align: left ? 'right' : 'left', base:'middle', max:210});
  };
  side(a, g.a, 0, mid, ia, g.done ? g.ap : null, g.done && g.ap > g.hp); side(h, g.h, mid, W, ih, g.done ? g.hp : null, g.done && g.hp > g.ap);
  const nearBlack = t => { const m = t && /^#?([0-9a-f]{6})$/i.exec(t.col || ''), n = m ? parseInt(m[1], 16) : 0x888888; return (n >> 16) + ((n >> 8) & 255) + (n & 255) < 96; };
  c.beginPath(); c.moveTo(mid - 16, 0); c.lineTo(mid + 108, 0); c.lineTo(mid + 16, top); c.lineTo(mid - 108, top); c.closePath(); c.fillStyle = nearBlack(a) || nearBlack(h) ? '#2E3138' : '#000'; c.fill();      // the dark band between them, lifted a shade when a team's own color is black
  cText(c, g.done ? 'Final' : g.n ? 'vs' : 'at', mid, top/2 - 16, {px:40, wt:900, it:true, w:'condensed', color:'#fff', align:'center', base:'middle'});
  const when = etTime(g).split(', ');
  cText(c, when.slice(0, 2).join(', '), mid, top/2 + 22, {px:21, wt:600, color:CK.barMuted, align:'center', base:'middle', max:150});
  if (!g.done && when[2]) cText(c, when[2], mid, top/2 + 50, {px:21, wt:600, color:CK.barMuted, align:'center', base:'middle', max:130});
  // what LTF says, on paper below the banner
  c.fillStyle = CK.paper; c.fillRect(0, top, W, H - top - foot);
  const x = gameLine(g), tiles = [];
  if (g.done){
    const o = outcome(g);
    tiles.push(['LTF line, before kickoff', x ? plain(lineTxt(x)) : 'No line yet', x && x.pts !== 0 ? ((x.m > 0) === (g.hp > g.ap) ? 'LTF had the winner' : 'LTF missed the winner') : '']);
    tiles.push(['Market line', g.hs == null ? 'None posted' : plain(marketTxt(g)), g.ou != null ? `Total ${g.ou}` : '']);
    tiles.push(['Against the spread', o.cover === undefined ? 'No line' : o.cover === null ? 'Push' : `${o.cover} covered`, o.cover ? `by ${o.coverBy} points` : '']);
  } else {
    const e = edgeOf(g), cf = confidence(g);
    tiles.push(['LTF line', x ? plain(lineTxt(x)) : 'No line yet', x ? `${x.fav.n} wins ${Math.round(100*Math.max(x.pHome, 1 - x.pHome))}% of the time` : '']);
    tiles.push(['Market line', g.hs == null ? 'Not posted yet' : plain(marketTxt(g)), g.ou != null ? `Total ${g.ou}` : '']);
    if (e && !e.none) tiles.push(['LTF Edge', `${e.t.n} +${e.pts}`, 'LTF rates them higher than the market does']);
    else if (cf) tiles.push(['Confidence', `${cf.score} of 100`, cf.label]);
    if (cf && e && !e.none) tiles[2][2] = `Confidence ${cf.score}, ${cf.label.toLowerCase()}`;
  }
  const tw = (W - 112)/tiles.length;
  tiles.forEach(([lab, val, sub], i) => { const tx = 56 + i*tw;
    if (i){ c.fillStyle = CK.line; c.fillRect(tx - 18, top + 34, 2, H - top - foot - 68); }
    cText(c, lab, tx, top + 58, {px:24, wt:600, color:CK.muted, max:tw - 40});
    cText(c, val, tx, top + 118, {px:50, wt:900, w:'condensed', color:CK.ink, max:tw - 40});
    if (sub) cText(c, sub, tx, top + 160, {px:23, wt:500, color:CK.muted, max:tw - 40}); });
  cFoot(c, W, H, foot, `Week ${g.w}, ${M.season}`);
}

/* ---------- lists ---------- */
function cHead(c, W, P, title, sub, y = 0){   // the heading of a list card: a slanted black tab, the way sections start on the site
  c.fillStyle = CK.paper; c.fillRect(0, 0, W, 9999);
  c.fillStyle = CK.ink; c.fillRect(P, y + 54, W - P*2, 5);
  c.font = cfont(58, 900, {it:true, w:'condensed'}); const tw = Math.min(c.measureText(title).width, W - P*2 - 80);
  c.beginPath(); c.moveTo(P, y + 54); c.lineTo(P + tw + 78, y + 54); c.lineTo(P + tw + 52, y + 138); c.lineTo(P, y + 138); c.closePath(); c.fillStyle = CK.ink; c.fill();
  cText(c, title, P + 22, y + 98, {px:58, wt:900, it:true, w:'condensed', color:'#fff', base:'middle', max:tw});
  if (sub) cText(c, sub, P, y + 186, {px:30, wt:500, color:CK.muted, max:W - P*2});
  return y + (sub ? 214 : 160);
}
async function cRows(c, rows, x, y, w, rowH, o = {}){   // team rows: rank, mark, name, a small note, and a value on the right
  const ims = await Promise.all(rows.map(r => cardLogo(r.t)));
  const k = Math.min(rowH, o.cap || 84);      // type and marks are sized from this, never from a taller row
  rows.forEach((r, i) => { const ry = y + i*rowH, my = ry + rowH/2, s = k*0.64, rkW = o.rank === false ? 0 : k*0.92;
    c.fillStyle = CK.line; c.fillRect(x, ry + rowH - 1, w, 1);
    if (rkW) cText(c, r.rank, x + rkW - 14, my + 2, {px:k*0.5, wt:900, it:true, w:'condensed', color:CK.ink, align:'right', base:'middle', max:rkW - 16});
    cBadge(c, r.t, ims[i], x + rkW, my - s/2, s);
    const vx = x + w, vw = r.val != null ? (o.valW || k*1.45) : 0, nx = x + rkW + s + k*0.2, nw = w - (nx - x) - vw - 10;
    if (r.note){ cText(c, r.name, nx, my - k*0.11, {px:k*0.4, wt:750, color:CK.ink, base:'middle', max:nw}); cText(c, r.note, nx, my + k*0.26, {px:k*0.27, wt:500, color:r.noteColor || CK.muted, base:'middle', max:nw}); }
    else cText(c, r.name, nx, my + 2, {px:k*0.42, wt:750, color:CK.ink, base:'middle', max:nw});
    if (r.val != null) cText(c, r.val, vx, my + 2, {px:k*0.48, wt:900, it:true, w:'condensed', color:r.valColor || CK.ink, align:'right', base:'middle', max:vw}); });
}
const rankRow = t => ({t, rank:t.rank, name:t.n, note:`${t.w}-${t.l}${t.move ? `, ${moveTxt(t.move)}` : ''}`, noteColor: t.move > 0 ? CK.good : t.move < 0 ? CK.bad : CK.muted, val:t.idx.toFixed(1)});
async function cardTop(c, W, H, n){   // the top 25 on a tall card, or the top 10 on a wide one
  const tall = H > W, P = tall ? 56 : 56, foot = tall ? 104 : 84, br = byRank().slice(0, n);
  let y = cHead(c, W, P, `LTF Top ${n}`, tall ? `Every FBS team on one scale. After week ${M.through}, ${M.season}.` : null);
  const half = Math.ceil(n/2), gap = 44, cw = (W - P*2 - gap)/2, rowH = Math.floor((H - foot - y - (tall ? 20 : 16))/half);
  await cRows(c, br.slice(0, half).map(rankRow), P, y, cw, rowH); await cRows(c, br.slice(half).map(rankRow), P + cw + gap, y, cw, rowH);
  cFoot(c, W, H, foot, weekNote());
}
async function cardConference(c, W, H, conf){   // one conference, every team in order
  const tall = H > W, P = 56, foot = tall ? 104 : 84, ts = tall ? conf.sorted : conf.sorted.slice(0, 10);
  let y = cHead(c, W, P, `${conf.label}`, tall ? `Ranked by the LTF Index after week ${M.through}. National rank on the left.` : null);
  const two = ts.length > (tall ? 11 : 5), half = two ? Math.ceil(ts.length/2) : ts.length, gap = 44, cw = two ? (W - P*2 - gap)/2 : W - P*2;
  const rowH = Math.min(tall ? 122 : 84, Math.floor((H - foot - y - 18)/half));
  const row = t => ({t, rank:t.rank, name:t.n, note:`${t.w}-${t.l}, ${t.cw}-${t.cl} in conference`, val:t.idx.toFixed(1)});
  await cRows(c, ts.slice(0, half).map(row), P, y, cw, rowH); if (two) await cRows(c, ts.slice(half).map(row), P + cw + gap, y, cw, rowH);
  cFoot(c, W, H, foot, weekNote());
}

/* ---------- tiers: every team in its band ---------- */
async function cardTiers(c, W, H){
  const P = 56, foot = 104, br = byRank(), ims = await Promise.all(br.map(cardLogo)), imOf = new Map(br.map((t, i) => [t, ims[i]]));
  let y = cHead(c, W, P, 'LTF tiers', `Every FBS team by level of play so far. After week ${M.through}, ${M.season}.`) - 6;
  const labW = 238, gx = P + labW, gw = W - P - gx, groups = TIERS.map(tr => [tr, br.filter(t => tierOf(t) === tr)]).filter(q => q[1].length);
  // pick the largest mark size that lets every band fit above the footer
  let cell = 74, per = 1, rowsOf = n => Math.ceil(n/per);
  const need = s => { per = Math.floor(gw/s); return groups.reduce((sum, [, ts]) => sum + Math.max(Math.ceil(ts.length/per)*s, 62) + 16, 0); };
  while (cell > 34 && need(cell) > H - foot - y - 8) cell -= 2;
  per = Math.floor(gw/cell);
  for (const [tr, ts] of groups){
    const h = Math.max(rowsOf(ts.length)*cell, 62);
    c.fillStyle = CK.ink; c.fillRect(P, y, W - P*2, 3);
    cText(c, tr.name, P, y + 34, {px:30, wt:900, it:true, w:'condensed', color:CK.ink, max:labW - 18});
    cText(c, `${tr.what}, ${ts.length} ${ts.length === 1 ? 'team' : 'teams'}`, P, y + 60, {px:19, wt:500, color:CK.muted, max:labW - 18});
    ts.forEach((t, i) => cBadge(c, t, imOf.get(t), gx + (i % per)*cell + cell*0.09, y + 10 + Math.floor(i/per)*cell + cell*0.02, cell*0.82));
    y += h + 16;
  }
  cFoot(c, W, H, foot, weekNote());
}

/* ---------- LTF next to the AP poll ---------- */
const pollGaps = () => { if (M.apWeek == null) return null;
  const br = byRank(), up = [...br.filter(t => !t.d.apr && t.rank <= 25), ...br.filter(t => t.d.apr && t.d.apr - t.rank >= 3).sort((a,b) => (b.d.apr - b.rank) - (a.d.apr - a.rank))].slice(0, 5);
  const down = br.filter(t => t.d.apr && t.rank - t.d.apr >= 3).sort((a,b) => (b.rank - b.d.apr) - (a.rank - a.d.apr)).slice(0, 5);
  return up.length + down.length ? {up, down} : null; };
async function cardPolls(c, W, H, gaps){
  const P = 56, foot = 84, gap = 52, cw = (W - P*2 - gap)/2;
  let y = cHead(c, W, P, 'LTF vs the AP poll', null);
  const col = async (title, ts, x) => {
    cText(c, title, x, y + 14, {px:30, wt:850, w:'semi-condensed', color:CK.ink, max:cw - 150});
    cText(c, 'LTF', x + cw - 96, y + 14, {px:21, wt:700, color:CK.muted, align:'right'}); cText(c, 'AP', x + cw, y + 14, {px:21, wt:700, color:CK.muted, align:'right'});
    c.fillStyle = CK.ink; c.fillRect(x, y + 28, cw, 3);
    const rowH = Math.floor((H - foot - y - 46)/5), ims = await Promise.all(ts.map(cardLogo));
    ts.forEach((t, i) => { const ry = y + 31 + i*rowH, my = ry + rowH/2, s = rowH*0.66;
      c.fillStyle = CK.line; c.fillRect(x, ry + rowH - 1, cw, 1);
      cBadge(c, t, ims[i], x, my - s/2, s);
      cText(c, t.n, x + s + 16, my + 2, {px:32, wt:750, color:CK.ink, base:'middle', max:cw - s - 16 - 200});
      cText(c, t.rank, x + cw - 96, my + 2, {px:38, wt:900, it:true, w:'condensed', color:CK.ink, align:'right', base:'middle'});
      cText(c, t.d.apr || 'NR', x + cw, my + 2, {px:38, wt:900, it:true, w:'condensed', color:CK.muted, align:'right', base:'middle'}); });
    if (!ts.length) cText(c, 'No team this week.', x, y + 80, {px:26, wt:500, color:CK.muted});
  };
  await col('LTF has them higher', gaps.up, P); await col('The AP has them higher', gaps.down, P + cw + gap);
  cFoot(c, W, H, foot, `AP poll, week ${M.apWeek}. ${weekNote()}`);
}

/* ---------- conferences, strongest first ---------- */
async function cardConferences(c, W, H){
  const P = 56, foot = 84, cs = CONFS.filter(q => q.tier).sort((a,b) => b.avg - a.avg);
  let y = cHead(c, W, P, 'Conference power rankings', null);
  const rowH = Math.floor((H - foot - y - 14)/cs.length), nameW = 290, bx = P + 64 + nameW, bw = W - P - bx - 96, lo = 20, hi = 80, at = v => bx + bw*clamp((v - lo)/(hi - lo), 0, 1);
  cs.forEach((q, i) => { const my = y + i*rowH + rowH/2;
    cText(c, i + 1, P + 40, my + 2, {px:rowH*0.7, wt:900, it:true, w:'condensed', color:CK.ink, align:'right', base:'middle'});
    cText(c, q.name, P + 64, my + 2, {px:rowH*0.62, wt:750, color:CK.ink, base:'middle', max:nameW - 18});
    c.fillStyle = CK.alt; c.fillRect(bx, my - rowH*0.27, bw, rowH*0.54);
    c.fillStyle = q.tier === 'G6' ? CK.pylon : CK.ink; c.fillRect(bx, my - rowH*0.27, at(q.avg) - bx, rowH*0.54);
    cText(c, q.avg.toFixed(1), W - P, my + 2, {px:rowH*0.72, wt:900, it:true, w:'condensed', color:CK.ink, align:'right', base:'middle'}); });
  c.fillStyle = CK.muted; c.fillRect(at(50) - 1, y + 2, 2, rowH*cs.length - 4);      // 50 is an average team
  cFoot(c, W, H, foot, `Average LTF Index after week ${M.through}. Orange is Group of 6.`);
}

/* ---------- receipts: how the picks did ---------- */
function receipts(wk){   // one week's graded record and the season's, counted the way the scorecard counts them
  const rows = scoreRows(), week = +wk || (rows.some(r => r.g.w === M.through) ? M.through : Math.max(0, ...rows.map(r => r.g.w))), wr = rows.filter(r => r.g.w === week);      // the last full week, unless asked for another
  if (!wr.length) return null;
  const tw = scoreTally(wr), ts = scoreTally(rows), tr = trackRecord().rows.filter(r => r.g.w === week);
  return {week, w: tw.ltf, m: tw.mkt, s: ts.ltf, sm: ts.mkt, ats: {w: tr.filter(r => r.right === true).length, l: tr.filter(r => r.right === false).length, p: tr.filter(r => r.right === null).length}};
}
async function cardReceipts(c, W, H, r){
  const P = 56, foot = 84, top = H - foot;
  c.fillStyle = CK.turf; c.fillRect(0, 0, W, top);                                      // the field, with its yard lines
  c.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 1; i < 10; i++) c.fillRect(W*i/10 - 1, 0, 2, top);
  c.fillStyle = CK.pylon; c.fillRect(0, 0, W, 8);
  cText(c, `LTF picks, week ${r.week}`, P, 92, {px:44, wt:900, it:true, w:'condensed', color:'#fff'});
  cText(c, 'Every pick graded, misses included.', P, 132, {px:26, wt:500, color:'rgba(255,255,255,.82)'});
  cText(c, `${r.w.w}-${r.w.l}`, P - 6, 352, {px:236, wt:900, it:true, w:'condensed', color:'#fff', max:W*0.5 - P});
  cText(c, `picking winners, ${Math.round(100*r.w.pct)}%`, P, 402, {px:32, wt:700, color:'#fff'});
  cText(c, `The betting line went ${r.m.w}-${r.m.l}.`, P, 444, {px:26, wt:500, color:'rgba(255,255,255,.82)'});
  const x = W*0.56, rows = [
    r.ats.w + r.ats.l ? [`${r.ats.w}-${r.ats.l}${r.ats.p ? '-' + r.ats.p : ''}`, 'LTF side against the spread'] : null,
    [`${r.w.avg.toFixed(1)}`, `points off per game. The line: ${r.m.avg.toFixed(1)}`],
    [`${r.s.w}-${r.s.l}`, `this season, ${Math.round(100*r.s.pct)}%. The line: ${Math.round(100*r.sm.pct)}%`],
  ].filter(Boolean);
  rows.forEach(([big, small], i) => { const y = 88 + i*132;
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x, y - 36, W - P - x, 2);
    cText(c, big, x, y + 44, {px:76, wt:900, it:true, w:'condensed', color:'#fff'});
    cText(c, small, x, y + 80, {px:24, wt:500, color:'rgba(255,255,255,.86)', max:W - P - x}); });
  cFoot(c, W, H, foot, `Games with a betting line, ${M.season}`);
}

/* ---------- draw any card ---------- */
const CARDS = {
  team:       {shape:'wide', get: id => bySlug[id], draw: cardTeam, name: t => t.n},
  game:       {shape:'wide', get: id => gameById[id], draw: cardGame, name: g => `${g.a} ${g.n ? 'vs' : 'at'} ${g.h}`},
  conference: {shape:'tall', get: id => confBySlug[id], draw: cardConference, name: x => x.label},
  top25:      {shape:'tall', get: () => 25, draw: cardTop, name: () => 'LTF Top 25'},
  top10:      {shape:'wide', get: () => 10, draw: cardTop, name: () => 'LTF Top 10'},
  tiers:      {shape:'tall', get: () => true, draw: cardTiers, name: () => 'LTF tiers'},
  polls:      {shape:'wide', get: () => pollGaps(), draw: cardPolls, name: () => 'LTF vs the AP poll'},
  conferences:{shape:'wide', get: () => true, draw: cardConferences, name: () => 'Conference power rankings'},
  receipts:   {shape:'wide', get: id => receipts(id), draw: cardReceipts, name: r => `LTF picks, week ${r.week}`},
};
async function drawCard(kind, id, shape){   // returns a canvas, or null if there is no such card
  const k = CARDS[kind], what = k && k.get(id); if (!what) return null;
  const [W, H] = CARD_SIZE[shape || k.shape], cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  try { await Promise.race([Promise.all(['italic 900 40px Archivo', '700 40px Archivo', '500 40px Archivo'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 3000))]); } catch(e){}
  const c = cv.getContext('2d'); await k.draw(c, W, H, what);
  return cv;
}

/* ---------- the share panel ---------- */
/* A Share button names a card ("team:alabama"). The panel draws it and offers what this browser can do with a picture:
   hand it to another app, save it, or copy the page's address. In a preview nothing can be saved by a button, so the
   panel says how to save it by hand instead. */
const shareBtn = (spec, label, cls, alts) => `<button type="button" class="${cls || 'btn sharebtn'}" data-card="${esc(spec)}"${alts ? ` data-alts="${esc(alts.map(a => a.join('=')).join('|'))}"` : ''}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13V2.5M5.5 6.5L10 2l4.5 4.5M3 11v6h14v-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg>${label || 'Share'}</button>`;
const sheet = {opener: null, url: null, blob: null, name: '', spec: ''};
function closeSheet(){
  const el = document.getElementById('sheet'); if (!el || el.hidden) return;
  el.hidden = true; document.body.classList.remove('sheet-open');
  if (sheet.url){ try { URL.revokeObjectURL(sheet.url); } catch(e){} } sheet.url = sheet.blob = null;
  if (sheet.opener && document.contains(sheet.opener)) sheet.opener.focus(); sheet.opener = null;
}
async function openSheet(spec, opener, alts){
  const [kind, ...rest] = String(spec).split(':'), id = rest.join(':'), k = CARDS[kind], what = k && k.get(id); if (!what) return;
  const el = document.getElementById('sheet'), pic = document.getElementById('sheetPic'), acts = document.getElementById('sheetActs'), hint = document.getElementById('sheetHint'), seg = document.getElementById('sheetAlts');
  if (opener) sheet.opener = opener;
  if (alts) sheet.alts = alts; else if (el.hidden) sheet.alts = null;
  sheet.spec = spec; sheet.name = k.name(what);
  document.getElementById('sheetTitle').textContent = 'Share: ' + sheet.name;
  seg.hidden = !sheet.alts; seg.innerHTML = sheet.alts ? sheet.alts.map(([sp, lab]) => `<a href="#" data-alt="${esc(sp)}" aria-current="${sp === spec}">${esc(lab)}</a>`).join('') : '';
  pic.className = 'sheet-pic is-' + k.shape; pic.innerHTML = '<p class="hint">Drawing the picture.</p>'; acts.innerHTML = ''; hint.textContent = '';
  el.hidden = false; document.body.classList.add('sheet-open'); document.getElementById('sheetClose').focus();
  let cv = null, blob = null;
  try { cv = await drawCard(kind, id); blob = await new Promise(res => cv.toBlob(res, 'image/png')); } catch(e){}
  if (sheet.spec !== spec || el.hidden) return;                      // closed, or switched to another picture, while this one was drawing
  if (!blob){ pic.innerHTML = '<p class="hint">This browser could not draw the picture. A screenshot of the page works too.</p>'; return; }
  if (sheet.url){ try { URL.revokeObjectURL(sheet.url); } catch(e){} }
  sheet.blob = blob; sheet.url = URL.createObjectURL(blob);
  const fname = `ltf-${slug(sheet.name)}-week-${M.through}.png`;
  pic.innerHTML = `<img src="${sheet.url}" width="${cv.width}" height="${cv.height}" alt="${esc(sheet.name)}, as a picture to share">`;
  let canSend = false; try { canSend = !!SITE && !!navigator.canShare && navigator.canShare({files: [new File([blob], fname, {type: 'image/png'})]}); } catch(e){}
  acts.innerHTML = (canSend ? `<button type="button" class="btn go" data-sheet="send" data-name="${esc(fname)}">Send picture</button>` : '')
    + (SITE ? `<a class="btn${canSend ? ' outline' : ' go'}" href="${sheet.url}" download="${esc(fname)}">Save picture</a><button type="button" class="btn outline" data-sheet="copy">Copy link</button>` : '');
  hint.textContent = SITE ? 'The picture carries the site\'s name and the week, so it explains itself wherever it lands.' : 'To save the picture here, press and hold it, or right-click it on a computer. On the published site this panel also has Save and Send buttons.';
  if (!SITE && window.claude && window.claude.use) window.claude.use('downloads').then(dl => {
    if (!dl || sheet.spec !== spec || el.hidden || acts.querySelector('[data-sheet="keep"]')) return;
    sheet.dl = dl; acts.innerHTML = `<button type="button" class="btn go" data-sheet="keep" data-name="${esc(fname)}">Save picture</button>`;
    hint.textContent = 'On the published site this panel also sends the picture straight to another app and copies the page\'s link.';
  }, () => {});
  countEvent('share-' + kind);
}
function sheetClick(b){   // a button inside the panel
  const said = msg => { const old = b.textContent; b.textContent = msg; setTimeout(() => { b.textContent = old; }, 1700); };
  if (b.dataset.sheet === 'keep' && sheet.blob && sheet.dl){
    sheet.dl.save({filename: b.dataset.name, data: sheet.blob}).then(() => said('Saved'), e => { if (!e || e.code !== 'declined') said('Could not save here'); });
  } else if (b.dataset.sheet === 'send' && sheet.blob){
    try { navigator.share({files: [new File([sheet.blob], b.dataset.name, {type: 'image/png'})], title: `${sheet.name} | ${BRAND}`}).catch(() => {}); } catch(e){ said('Use Save picture'); }
  } else if (b.dataset.sheet === 'copy'){
    let url = ''; try { url = location.href; } catch(e){}
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => said('Link copied'), () => said('Copy the address bar')); else said('Copy the address bar');
  }
}

/* ---------- pictures for link previews ---------- */
/* During the daily update a browser opens the site with #!cards=team/alabama,game/123,... after the address. Instead of
   drawing a page, the site draws those cards and leaves them in the document for the update to collect. */
const CARD_FILES = {'list/top10': ['top10', ''], 'list/top25': ['top25', ''], 'list/tiers': ['tiers', ''], 'list/polls': ['polls', ''], 'list/conferences': ['conferences', ''], 'list/receipts': ['receipts', '']};
async function exportCards(list){
  const out = {};
  for (const name of list){
    const [dir, id] = name.split('/'), spec = CARD_FILES[name] || [dir, id], k = CARDS[spec[0]];
    if (!k) continue;
    if (k.shape !== 'wide' && spec[0] !== 'conference') continue;                       // link previews are wide. Tall cards are for sharing by hand.
    try { const cv = await drawCard(spec[0], spec[1], 'wide'); if (cv) out[name] = cv.toDataURL('image/png'); } catch(e){}
  }
  const s = document.createElement('script'); s.type = 'application/json'; s.id = 'cards-out'; s.textContent = JSON.stringify(out);
  document.body.appendChild(s); document.documentElement.setAttribute('data-cards', String(Object.keys(out).length));
}
