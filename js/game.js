// 遊戲主程式：回合制、物理、武器、敵人 AI、介面
(function () {
  'use strict';
  const SW = window.SW, T = SW.T, A = SW.art, WEAPONS = SW.WEAPONS, MENU = SW.MENU, LEVELS = SW.LEVELS;
  const VW = 960, VH = 600, GRAV = 1400, WALK = 120, JUMP = 520, HW = 11, UH = 36, TURN_TIME = 30;
  const ENEMY_HP = 50, ENEMY_DMG = 0.4;      // 敵人數量多，所以血比較少、打人比較不痛
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo');          // ?demo 讓電腦代打我方，測試用

  const save = { unlocked: 1, weapons: ['shell'] };
  try {
    const s = JSON.parse(localStorage.getItem('stonewar_save'));
    if (s && s.unlocked && Array.isArray(s.weapons)) { save.unlocked = s.unlocked; save.weapons = s.weapons; }
  } catch (e) { /* 沒有存檔或無法讀取，用預設值 */ }
  function persist() { try { localStorage.setItem('stonewar_save', JSON.stringify(save)); } catch (e) { /* 忽略 */ } }
  function unlock(w) { if (w && save.weapons.indexOf(w) < 0) { save.weapons.push(w); persist(); } }

  let scene = 'title', L = null, selIdx = 0, tipIdx = 0, ui = [], paused = false, menuOpen = false, time = 0, scale = 1;
  const keys = {}, held = {};
  const CTL = [{ id: 'left', x: 90, y: 536, r: 38 }, { id: 'right', x: 200, y: 536, r: 38 }, { id: 'fire', x: 735, y: 536, r: 42 }, { id: 'jump', x: 870, y: 536, r: 38 }];

  // ---------- 音效(WebAudio 合成) ----------
  let AC = null, muted = false;
  function initAudio() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try { const C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } catch (e) { AC = null; }
  }
  function tone(type, f0, f1, dur, vol) {
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol, cutoff) {
    const n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(AC.destination); s.start();
  }
  function sfx(n) {
    if (muted || !AC) return;
    try {
      if (n === 'boom') { noise(0.5, 0.5, 700); tone('sine', 120, 35, 0.4, 0.4); }
      else if (n === 'shoot') tone('triangle', 520, 140, 0.18, 0.2);
      else if (n === 'hit') tone('square', 240, 90, 0.12, 0.12);
      else if (n === 'pick') { tone('sine', 660, 990, 0.09, 0.16); tone('sine', 990, 1320, 0.16, 0.12); }
      else if (n === 'jump') tone('sine', 280, 520, 0.12, 0.1);
      else if (n === 'zap') tone('sawtooth', 900, 200, 0.3, 0.12);
      else if (n === 'win') { tone('triangle', 523, 523, 0.15, 0.2); tone('triangle', 784, 1046, 0.5, 0.2); }
      else if (n === 'lose') tone('sawtooth', 300, 70, 0.7, 0.15);
    } catch (e) { /* 音效失敗不影響遊戲 */ }
  }

  // ---------- 關卡 ----------
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return h >>> 8; }
  const BLOCK = { '#': ['stone', 2], r: ['rubble', 1], g: ['grass', 2], G: ['gold', 4] };

  function loadLevel(idx) {
    const def = LEVELS[idx], rows = def.map, H = rows.length, W = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    L = {
      idx: idx, def: def, W: W, H: H, grid: [], units: [], shots: [], worms: [], nails: [], pickups: [], fx: [], texts: [],
      cam: { x: 0, y: 0 }, camBase: { x: 0, y: 0 }, camOff: { x: 0, y: 0 }, focus: null, shake: 0,
      phase: 'intro', introT: 0, active: null, next: null, turnTeam: 1, ptr: [-1, -1], timer: TURN_TIME,
      settle: 0, resolveT: 0, endT: 0, money: 150, weapon: 'shell', lastFree: 'shell', turns: 0, toast: null, aiming: false, newWeaponT: 0,
      bg: A.background(def.theme)
    };
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        const ch = rows[y][x] || '.', b = BLOCK[ch];
        row.push(b ? { t: b[0], hp: b[1], v: hash(x, y) } : null);
        const px = (x + 0.5) * T, py = (y + 1) * T;
        if (ch === 'P' || ch === 'E') {
          const team = ch === 'P' ? 0 : 1;
          L.units.push({ team: team, x: px, y: py, vx: 0, vy: 0, hp: team ? ENEMY_HP : 100, max: team ? ENEMY_HP : 100, face: team ? -1 : 1, onGround: false, walk: 0, dead: false, gone: false, hurtT: 0, ai: null, aim: { ang: team ? Math.PI + 0.7 : -0.7, pow: 0.5 } });
        } else if (ch === 'o') L.pickups.push({ kind: 'pebble', x: px, y: py, vy: 0 });
        else if (ch === 'W') L.pickups.push({ kind: 'weapon', x: px, y: py, vy: 0 });
      }
      L.grid.push(row);
    }
    (def.grants || []).forEach(unlock);
    const p = aliveOf(0)[0], e = aliveOf(1)[0];
    L.introFrom = camFor(e || p); L.introTo = camFor(p);
    L.camBase.x = L.introFrom.x; L.camBase.y = L.introFrom.y;
    menuOpen = false; paused = false;
  }
  function aliveOf(team) { return L.units.filter(function (u) { return u.team === team && !u.dead; }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function camFor(f) {
    return { x: clamp(f.x - VW / 2, 0, Math.max(0, L.W * T - VW)), y: clamp(f.y - VH * 0.55, 0, Math.max(0, L.H * T - VH)) };
  }

  function tileSolid(tx, ty) { if (tx < 0 || tx >= L.W) return true; if (ty < 0 || ty >= L.H) return false; return !!L.grid[ty][tx]; }
  function solidAt(x, y) { return tileSolid(Math.floor(x / T), Math.floor(y / T)); }
  function boxSolid(x, y, hw, h) {
    const x0 = Math.floor((x - hw) / T), x1 = Math.floor((x + hw - 0.01) / T), y0 = Math.floor((y - h) / T), y1 = Math.floor((y - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileSolid(tx, ty)) return true;
    return false;
  }
  // 共用的角色 / 蟲物理：b 的 x,y 是腳底中心
  function stepBody(b, dt, move, hw, h) {
    const dx = (b.vx + move * WALK) * dt;
    if (dx) { if (!boxSolid(b.x + dx, b.y, hw, h)) b.x += dx; else b.vx = 0; }
    b.vy = Math.min(b.vy + GRAV * dt, 1000);
    const ny = b.y + b.vy * dt;
    if (boxSolid(b.x, ny, hw, h)) {
      if (b.vy > 0) { b.y = Math.floor(ny / T) * T; b.onGround = true; }
      b.vy = 0;
    } else { b.y = ny; b.onGround = false; }
    b.vx *= Math.pow(b.onGround ? 0.002 : 0.4, dt);
    if (Math.abs(b.vx) < 3) b.vx = 0;
  }

  // ---------- 回合 ----------
  function startTurn() {
    if (checkEnd()) return;
    let team = 1 - L.turnTeam;
    if (!aliveOf(team).length) team = L.turnTeam;
    L.turnTeam = team;
    const mine = aliveOf(team), other = aliveOf(1 - team);
    L.ptr[team] = (L.ptr[team] + 1) % mine.length;
    L.active = mine[L.ptr[team]];
    L.next = other.length ? other[(L.ptr[1 - team] + 1) % other.length] : null;
    L.phase = 'turn'; L.timer = TURN_TIME; L.turns++; L.aiming = false;
    L.active.ai = (team === 1 || DEMO) ? { state: 'think', wait: 0.6 + Math.random() * 0.6, moved: 0, weapon: 'shell' } : null;
    menuOpen = false;
    for (const k in held) if (held[k] === 'aim') delete held[k];
  }
  function toResolve() { L.phase = 'resolve'; L.settle = 0; L.resolveT = 0; L.aiming = false; menuOpen = false; }
  function checkEnd() {
    if (L.phase === 'won' || L.phase === 'lost') return true;
    if (!aliveOf(0).length) { L.phase = 'lost'; L.endT = 0; sfx('lose'); return true; }
    if (!aliveOf(1).length && !L.pickups.some(function (p) { return p.kind === 'weapon'; })) {
      L.phase = 'won'; L.endT = 0; sfx('win');
      save.unlocked = Math.min(LEVELS.length, Math.max(save.unlocked, L.idx + 2)); persist();
      return true;
    }
    return false;
  }
  function busy() {
    return L.shots.length > 0 || L.worms.length > 0 || L.units.some(function (u) { return !u.gone && (!u.onGround || Math.abs(u.vx) > 5); });
  }

  // ---------- 傷害與爆炸 ----------
  function addText(x, y, txt, color) { L.texts.push({ x: x, y: y, txt: txt, color: color, t: 0 }); }
  function toast(txt) { L.toast = { txt: txt, t: 2.2 }; }
  function kill(u) {
    u.hp = 0; u.dead = true;
    if (u.team === 1) { L.money += 50; addText(u.x, u.y - UH - 34, '+$50', '#ffe36a'); }
  }
  function hurt(u, n) {
    if (u.dead) return;
    u.hp -= n; u.hurtT = 0.4; addText(u.x, u.y - UH - 16, '-' + n, '#ff5a4a'); sfx('hit');
    if (u.hp <= 0) kill(u);
  }
  function heal(u, n) { u.hp = Math.min(u.max, u.hp + n); addText(u.x, u.y - UH - 16, '+' + n, '#7dff6a'); sfx('pick'); }
  function debris(x, y, color, n) {
    for (let i = 0; i < n; i++) L.fx.push({ type: 'p', x: x, y: y, vx: (Math.random() - 0.5) * 420, vy: -Math.random() * 380, t: 0, dur: 0.5 + Math.random() * 0.5, color: color, size: 3 + Math.random() * 4 });
  }
  const DEBRIS = { stone: '#6f85ab', rubble: '#b0a890', grass: '#b39d74', gold: '#e0a514', brick: '#c9a36b' };
  function damageBlock(tx, ty, n) {
    if (tx < 0 || tx >= L.W || ty < 0 || ty >= L.H) return;
    const b = L.grid[ty][tx]; if (!b) return;
    b.hp -= n;
    if (b.hp <= 0) {
      L.grid[ty][tx] = null; debris((tx + 0.5) * T, (ty + 0.5) * T, DEBRIS[b.t], 6);
      if (b.t === 'gold') L.pickups.push({ kind: 'pebble', x: (tx + 0.5) * T, y: (ty + 0.5) * T, vy: -150 });
    }
  }
  function explode(x, y, r, dmg, team) {
    if (team === 1) dmg *= ENEMY_DMG;
    sfx('boom'); L.shake = Math.min(16, r / 5);
    L.fx.push({ type: 'boom', x: x, y: y, r: r, t: 0, dur: 0.45 });
    debris(x, y, '#ffb347', 10);
    for (const u of L.units) {
      if (u.gone) continue;
      const dx = u.x - x, dy = (u.y - UH / 2) - y, d = Math.hypot(dx, dy) || 1, R = r + 16;
      if (d >= R) continue;
      const f = 1 - d / R;
      hurt(u, Math.max(4, Math.round(dmg * (0.3 + 0.7 * f))));
      u.vx += dx / d * 300 * f; u.vy = Math.min(u.vy, 0) - (120 + 260 * f); u.onGround = false;
    }
    const c = Math.ceil(r / T) + 1, cx = Math.floor(x / T), cy = Math.floor(y / T);
    for (let ty = cy - c; ty <= cy + c; ty++) for (let tx = cx - c; tx <= cx + c; tx++) {
      const d = Math.hypot((tx + 0.5) * T - x, (ty + 0.5) * T - y);
      if (d < r * 0.5) damageBlock(tx, ty, 2); else if (d < r * 0.9) damageBlock(tx, ty, 1);
    }
  }

  // ---------- 武器 ----------
  function launchSpeed(pow) { return 300 + pow * 950; }
  function muzzle(u) { const a = u.aim.ang; return { x: u.x + Math.cos(a) * 20, y: u.y - 24 + Math.sin(a) * 20 }; }
  function overUnit(s, u, r) { return Math.abs(s.x - u.x) < HW + r && s.y > u.y - UH - r && s.y < u.y + r; }

  function scatterNails(s, px, py) {
    for (let i = -2; i <= 2; i++) {
      let x = px + i * 15; if (solidAt(x, py - 6)) x = px;
      L.nails.push({ x: x, y: py - 6, vy: -120 - Math.random() * 80, t: 0 });
    }
  }
  function spawnWorms(s, px, py) {
    for (let i = 0; i < 4; i++) L.worms.push({ x: px, y: py - 2, vx: (i - 1.5) * 70, vy: -200 - Math.random() * 100, team: s.team, life: 7, face: 1, onGround: false });
  }
  // skip: 被河豚直接砸中的人只吃爆炸，不再被同一批尖刺重複命中
  function burstPuffer(s, skip) {
    explode(s.x, s.y, 46, 25, s.team);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + 0.26;
      L.shots.push({ kind: 'spike', x: s.x, y: s.y - 4, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, owner: null, skip: skip || null, team: s.team, t: 0 });
    }
  }
  function splitBanana(s, px, py) {
    explode(s.x, s.y, 46, 28, s.team);
    [-170, 0, 170].forEach(function (vx) {
      L.shots.push({ kind: 'mini', x: px, y: py - 6, vx: vx, vy: -400 - Math.random() * 60, owner: s.owner, team: s.team, t: 0 });
    });
  }
  // r: 碰撞半徑  grav: 重力倍率  bounce: 彈性  fuse: 引信秒數  land(s,px,py): 碰到東西時  回傳 true 代表這顆消失
  const SHOT = {
    shell: { r: 5, grav: 1, land: function (s) { explode(s.x, s.y, 62, 45, s.team); return true; } },
    melon: { r: 8, grav: 1, bounce: 0.45, fuse: 3, land: function (s) { explode(s.x, s.y, 88, 60, s.team); return true; } },
    toucan: { r: 8, grav: 0, fuse: 2.4, land: function (s) { explode(s.x, s.y, 58, 40, s.team); return true; } },
    puffer: { r: 8, grav: 1, land: function (s, px, py, unit) { if (unit) { burstPuffer(s, unit); return true; } s.x = px; s.y = py; s.vx = s.vy = 0; s.stuck = 1.1; return false; } },
    nailbag: { r: 6, grav: 1, land: function (s, px, py) { scatterNails(s, px, py); return true; } },
    banana: { r: 7, grav: 1, land: function (s, px, py) { splitBanana(s, px, py); return true; } },
    mini: { r: 5, grav: 1, land: function (s) { explode(s.x, s.y, 40, 20, s.team); return true; } },
    cocoon: { r: 7, grav: 1, bounce: 0.4, fuse: 1.6, land: function (s, px, py) { spawnWorms(s, px, py); debris(px, py, '#e0a62a', 8); return true; } },
    spike: { r: 3, grav: 0.3, fuse: 0.8, land: function (s, px, py, unit) { if (unit) hurt(unit, 14); return true; } }
  };
  function stepShot(s, h) {
    const D = SHOT[s.kind];
    s.t += h;
    if (s.stuck) { s.stuck -= h; if (s.stuck <= 0) { burstPuffer(s); return true; } return false; }
    if (D.fuse && s.t >= D.fuse) return D.land(s, s.x, s.y, null) || true;
    s.vy += GRAV * D.grav * h;
    const px = s.x, py = s.y;
    s.x += s.vx * h; s.y += s.vy * h;
    if (s.x < -200 || s.x > L.W * T + 200 || s.y > L.H * T + 200 || s.y < -3000) return true;
    for (const u of L.units) {
      if (u.dead || u === s.skip || (u === s.owner && s.t < 0.25)) continue;
      if (overUnit(s, u, D.r)) return D.land(s, px, py, u);
    }
    if (!solidAt(s.x, s.y)) return false;
    if (!D.bounce) return D.land(s, px, py, null);
    const hx = solidAt(s.x, py), hy = solidAt(px, s.y);
    if (hx || !hy) s.vx = -s.vx * D.bounce;
    if (hy || !hx) { s.vy = -s.vy * D.bounce; s.vx *= 0.85; }
    s.x = px; s.y = py;
    return false;
  }
  function rayAttack(u, range, width, dmgFn, color) {
    const a = u.aim.ang, m = muzzle(u), done = [];
    let x = m.x, y = m.y;
    for (let d = 0; d < range; d += 4) {
      x = m.x + Math.cos(a) * d; y = m.y + Math.sin(a) * d;
      if (solidAt(x, y)) break;
      for (const t of L.units) {
        if (t.dead || t === u || done.indexOf(t) >= 0) continue;
        if (Math.abs(x - t.x) < HW + width && y > t.y - UH - width && y < t.y + width) { done.push(t); hurt(t, dmgFn(t, y)); }
      }
    }
    L.fx.push({ type: 'beam', x0: m.x, y0: m.y, x1: x, y1: y, t: 0, dur: 0.4, color: color, w: width * 2 + 3 });
  }
  function placeBricks(u) {
    const a = u.aim.ang, tx0 = Math.floor(u.x / T), ty0 = Math.floor((u.y - 1) / T), f = Math.cos(a) >= 0 ? 1 : -1;
    const cells = Math.sin(a) < -0.85 ? [[tx0 - 1, ty0 - 1], [tx0, ty0 - 1], [tx0 + 1, ty0 - 1]] : [[tx0 + f, ty0], [tx0 + f, ty0 - 1], [tx0 + f, ty0 - 2]];
    let n = 0;
    cells.forEach(function (c) {
      const tx = c[0], ty = c[1];
      if (tx < 0 || tx >= L.W || ty < 0 || ty >= L.H || L.grid[ty][tx]) return;
      const blocked = L.units.some(function (o) { return !o.gone && o.x + HW > tx * T && o.x - HW < (tx + 1) * T && o.y > ty * T && o.y - UH < (ty + 1) * T; });
      if (blocked) return;
      L.grid[ty][tx] = { t: 'brick', hp: 1, v: 0 }; n++;
      debris((tx + 0.5) * T, (ty + 0.5) * T, '#fff3c4', 4);
    });
    return n > 0;
  }
  function fire(u, wid) {
    const w = WEAPONS[wid], pay = (u.team === 0 && !u.ai) ? (w.cost || 0) : 0;
    if (pay > L.money) { toast('石頭不夠，需要 $' + pay); return false; }
    const a = u.aim.ang, sp = launchSpeed(u.aim.pow), m = muzzle(u);
    const shoot = function (kind, speed) {
      const v = speed || sp;
      L.shots.push({ kind: kind, x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, owner: u, team: u.team, t: 0 });
      sfx('shoot');
    };
    switch (wid) {
      case 'shell': shoot('shell'); break;
      case 'melon': shoot('melon'); break;
      case 'toucan': shoot('toucan', 520); break;
      case 'puffer': shoot('puffer'); break;
      case 'nails': shoot('nailbag'); break;
      case 'banana': shoot('banana'); break;
      case 'worms': shoot('cocoon'); break;
      case 'gun': sfx('shoot'); rayAttack(u, 1100, 2, function (t, y) { const k = (t.y - y) / UH; return k > 0.7 ? 50 : k > 0.3 ? 30 : 20; }, '#fff3b0'); break;
      case 'qigong': sfx('zap'); rayAttack(u, 560, 12, function () { return 35; }, '#7fe9ff'); break;
      case 'brick': if (!placeBricks(u)) { toast('這裡放不下磚塊'); return false; } sfx('pick'); break;
      case 'meat': heal(u, 30); break;
      case 'vampire': {
        let best = null, bd = 320;
        for (const t of L.units) { if (t.dead || t.team === u.team) continue; const d = Math.hypot(t.x - u.x, t.y - u.y); if (d < bd) { bd = d; best = t; } }
        if (!best) { toast('附近沒有敵人可以吸血'); return false; }
        const n = Math.min(50, best.hp);
        L.fx.push({ type: 'beam', x0: best.x, y0: best.y - 20, x1: u.x, y1: u.y - 20, t: 0, dur: 0.6, color: '#ff3b5c', w: 6 });
        sfx('zap'); hurt(best, n); heal(u, n);
        break;
      }
    }
    L.money -= pay;
    if (!w.cost) L.lastFree = wid; else if (!u.ai) L.weapon = L.lastFree;
    L.focus = { x: u.x, y: u.y - 20 };
    toResolve();
    return true;
  }
  function tryFire() {
    if (scene !== 'play' || paused || menuOpen || L.phase !== 'turn' || !L.active || L.active.ai || L.active.dead) return;
    fire(L.active, L.weapon);
  }
  function toggleMenu() {
    if (L.phase === 'turn' && L.active && !L.active.ai) { menuOpen = !menuOpen; L.newWeaponT = 0; }
  }

  // ---------- 電腦 AI ----------
  function simShot(x, y, vx, vy, tgt) {
    const h = 1 / 60;
    for (let i = 0; i < 400; i++) {
      vy += GRAV * h; x += vx * h; y += vy * h;
      if (x < 0 || x > L.W * T || y > L.H * T) return null;
      if (Math.abs(x - tgt.x) < HW + 5 && y > tgt.y - UH - 5 && y < tgt.y + 5) return { x: tgt.x, y: tgt.y - UH / 2 };
      if (y > 0 && solidAt(x, y)) return { x: x, y: y };
    }
    return null;
  }
  function bestShot(u, tgt) {
    const dir = tgt.x >= u.x ? 1 : -1, tx = tgt.x, ty = tgt.y - UH / 2;
    let best = { score: 1e9, ang: dir > 0 ? -0.8 : Math.PI + 0.8, pow: 0.6 };
    for (let deg = -80; deg <= 30; deg += 5) {
      const el = deg * Math.PI / 180, ang = dir > 0 ? el : Math.PI - el, c = Math.cos(ang), s = Math.sin(ang);
      const mx = u.x + c * 20, my = u.y - 24 + s * 20;
      if (solidAt(mx, my)) continue;
      for (let p = 0.15; p <= 1.001; p += 0.05) {
        const sp = launchSpeed(p), hit = simShot(mx, my, c * sp, s * sp, tgt);
        if (!hit) continue;
        let sc = Math.hypot(hit.x - tx, hit.y - ty);
        if (Math.hypot(hit.x - u.x, hit.y - (u.y - 18)) < 85) sc += 500;
        for (const f of L.units) if (!f.dead && f !== u && f.team === u.team && Math.hypot(hit.x - f.x, hit.y - (f.y - 18)) < 60) sc += 200;
        if (sc < best.score) best = { score: sc, ang: ang, pow: p };
      }
    }
    return best;
  }
  function lineClear(u, t) {
    const x0 = u.x, y0 = u.y - 24, x1 = t.x, y1 = t.y - 18, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
    for (let i = 2; i < n; i++) if (solidAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  }
  function groundAhead(u, dir, depth) {
    const tx = Math.floor((u.x + dir * 18) / T), ty0 = Math.floor((u.y - 1) / T);
    for (let ty = ty0; ty <= ty0 + depth; ty++) if (tileSolid(tx, ty)) return true;
    return false;
  }
  function nearest(u, list) {
    let best = null, bd = 1e9;
    for (const t of list) { const d = Math.hypot(t.x - u.x, t.y - u.y); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  function aiWalk(u, dir, out, depth) {
    if (!groundAhead(u, dir, depth || 12)) return;
    out.move = dir;
    if (u.onGround && boxSolid(u.x + dir * 6, u.y, HW, UH)) out.jump = true;
  }
  function aiUpdate(u, dt) {
    const a = u.ai, out = { move: 0, jump: false }, foes = aliveOf(1 - u.team);
    if (!foes.length) {                                  // 只剩撿武器
      const wp = L.pickups.filter(function (p) { return p.kind === 'weapon'; })[0];
      if (wp && Math.abs(wp.x - u.x) > 4) aiWalk(u, wp.x > u.x ? 1 : -1, out, 99);
      return out;
    }
    const tgt = nearest(u, foes);
    if (a.state === 'think') {
      a.wait -= dt;
      if (a.wait > 0) return out;
      const plan = bestShot(u, tgt);
      if (plan.score > 120 && a.moved < 4) {
        a.state = 'move'; a.moveT = 1.0 + Math.random() * 1.2; a.dir = tgt.x >= u.x ? 1 : -1; a.moved++;
      } else {
        const err = u.team === 0 ? 0.05 : 0.18, r = Math.random();
        a.weapon = 'shell';
        if (L.idx >= 3 && r < 0.3 && lineClear(u, tgt)) {
          a.weapon = 'toucan'; plan.ang = Math.atan2(tgt.y - 18 - (u.y - 24), tgt.x - u.x); plan.pow = 0.6;
        } else if (L.idx >= 2 && r > 0.75) a.weapon = 'melon';
        a.goal = { ang: plan.ang + (Math.random() - 0.5) * 2 * err, pow: clamp(plan.pow * (1 + (Math.random() - 0.5) * 1.2 * err), 0.1, 1) };
        a.state = 'aim'; a.aimT = 0;
      }
    } else if (a.state === 'move') {
      a.moveT -= dt; aiWalk(u, a.dir, out);
      if (a.moveT <= 0) { a.state = 'think'; a.wait = 0.25; }
    } else if (a.state === 'aim') {
      a.aimT += dt;
      u.aim.ang = a.goal.ang; u.aim.pow = a.goal.pow * Math.min(1, a.aimT / 0.9); u.face = Math.cos(a.goal.ang) >= 0 ? 1 : -1;
      if (a.aimT > 1.15) { u.aim.pow = a.goal.pow; fire(u, a.weapon); }
    }
    return out;
  }

  // ---------- 每幀更新 ----------
  function ctl(name) { for (const k in held) if (held[k] === name) return true; return false; }
  function collect(p, u) {
    if (p.kind === 'pebble') { L.money += 30; addText(p.x, p.y - 20, '+$30', '#ffe36a'); sfx('pick'); return; }
    const w = L.def.pickup; unlock(w); L.weapon = w; L.lastFree = w; L.newWeaponT = 5; sfx('win');
    addText(p.x, p.y - 30, '獲得 ' + WEAPONS[w].name + '!', '#fff');
  }
  function updatePlay(dt) {
    if (L.toast && (L.toast.t -= dt) <= 0) L.toast = null;
    if (L.newWeaponT > 0) L.newWeaponT -= dt;
    if (L.shake > 0) L.shake = Math.max(0, L.shake - dt * 40);
    if (L.phase === 'intro') { L.introT += dt; if (L.introT > 2.6) startTurn(); }

    for (const u of L.units) {
      if (u.gone) continue;
      let move = 0, jump = false;
      if (u.hurtT > 0) u.hurtT -= dt;
      if (L.phase === 'turn' && u === L.active && !u.dead) {
        if (u.ai) { const o = aiUpdate(u, dt); move = o.move; jump = o.jump; }
        else if (!menuOpen) {
          move = ((keys.ArrowRight || keys.KeyD || ctl('right')) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA || ctl('left')) ? 1 : 0);
          jump = !!(keys.ArrowUp || keys.KeyW || ctl('jump'));
        }
        if (move) {
          u.walk += dt * 11;
          if (!L.aiming && u.face !== move) { u.face = move; if ((Math.cos(u.aim.ang) >= 0 ? 1 : -1) !== move) u.aim.ang = Math.PI - u.aim.ang; }
        }
        if (jump && u.onGround) { u.vy = -JUMP; u.onGround = false; sfx('jump'); }
      }
      stepBody(u, dt, move, HW, UH);
      if (u.y > L.H * T + 120) { u.gone = true; if (!u.dead) kill(u); }
    }

    for (let i = L.pickups.length - 1; i >= 0; i--) {
      const p = L.pickups[i];
      if (p.vy < 0 || !solidAt(p.x, p.y + 1)) {
        p.vy = Math.min(p.vy + GRAV * dt, 900); p.y += p.vy * dt;
        if (p.vy > 0 && solidAt(p.x, p.y)) { p.y = Math.floor(p.y / T) * T; p.vy = 0; }
      }
      if (p.y > L.H * T + 100 && p.kind === 'pebble') { L.pickups.splice(i, 1); continue; }
      if (p.kind === 'weapon' && p.y > L.H * T - 2) p.y = L.H * T - T;      // 武器不能掉出地圖，否則過不了關
      for (const u of L.units) {
        if (u.dead || u.team !== 0) continue;
        if (Math.abs(u.x - p.x) < HW + 14 && p.y > u.y - UH - 8 && p.y < u.y + 10) { L.pickups.splice(i, 1); collect(p, u); break; }
      }
    }

    for (let i = L.nails.length - 1; i >= 0; i--) {
      const n = L.nails[i]; n.t += dt;
      if (n.vy < 0 || !solidAt(n.x, n.y + 1)) {
        n.vy = Math.min(n.vy + GRAV * dt, 900); n.y += n.vy * dt;
        if (n.vy > 0 && solidAt(n.x, n.y)) { n.y = Math.floor(n.y / T) * T; n.vy = 0; }
      }
      if (n.y > L.H * T + 100) { L.nails.splice(i, 1); continue; }
      if (n.t < 0.6) continue;
      for (const u of L.units) {
        if (u.dead) continue;
        if (Math.abs(u.x - n.x) < HW + 5 && Math.abs(u.y - n.y) < 12) { L.nails.splice(i, 1); hurt(u, 15); break; }
      }
    }

    const sub = 4, h = dt / sub;
    for (let k = 0; k < sub; k++) for (let i = L.shots.length - 1; i >= 0; i--) {
      const s = L.shots[i];
      if (stepShot(s, h)) L.shots.splice(L.shots.indexOf(s), 1);
    }
    if (L.shots.length) {
      const s = L.shots[L.shots.length - 1]; L.focus = { x: s.x, y: s.y };
      if (s.kind === 'shell' || s.kind === 'toucan') L.fx.push({ type: 'smoke', x: s.x, y: s.y, t: 0, dur: 0.4 });
    }

    for (let i = L.worms.length - 1; i >= 0; i--) {
      const w = L.worms[i]; w.life -= dt;
      const t = nearest(w, L.units.filter(function (u) { return !u.dead && u.team !== w.team; }));
      stepBody(w, dt, 0, 4, 6);
      if (t) {
        w.face = t.x >= w.x ? 1 : -1;
        const dx = w.face * 80 * dt;
        if (!boxSolid(w.x + dx, w.y, 4, 6)) w.x += dx;
        else if (w.onGround && !boxSolid(w.x + dx, w.y - T, 4, 6)) { w.vy = -370; w.onGround = false; }
        if (Math.abs(w.x - t.x) < HW + 5 && w.y > t.y - UH && w.y < t.y + 8) { hurt(t, 12); w.life = 0; }
      }
      if (w.life <= 0 || w.y > L.H * T + 100) { debris(w.x, w.y - 4, '#d98a2b', 3); L.worms.splice(i, 1); }
      else L.focus = { x: w.x, y: w.y };
    }

    for (let i = L.fx.length - 1; i >= 0; i--) {
      const f = L.fx[i]; f.t += dt;
      if (f.type === 'p') { f.vy += GRAV * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
      if (f.t >= f.dur) L.fx.splice(i, 1);
    }
    for (let i = L.texts.length - 1; i >= 0; i--) { const t = L.texts[i]; t.t += dt; t.y -= 34 * dt; if (t.t > 1.2) L.texts.splice(i, 1); }

    if (L.phase === 'turn') {
      if (!L.active || L.active.dead) toResolve();
      else if (!checkEnd()) {
        if (aliveOf(1).length || L.active.ai) L.timer -= dt;
        if (L.timer <= 0) startTurn();
      }
    } else if (L.phase === 'resolve') {
      L.resolveT += dt;
      if (busy()) L.settle = 0; else L.settle += dt;
      if (L.settle > 0.8 || L.resolveT > 14) startTurn();
    } else if (L.phase === 'won' || L.phase === 'lost') {
      L.endT += dt;
      if (L.endT > 1.6) scene = 'result';
    }
    updateCam(dt);
  }
  function updateCam(dt) {
    let tgt, off = { x: 0, y: 0 };
    if (L.phase === 'intro') {
      const k = clamp((L.introT - 0.5) / 1.8, 0, 1), e = k * k * (3 - 2 * k);
      L.camBase.x = L.introFrom.x + (L.introTo.x - L.introFrom.x) * e;
      L.camBase.y = L.introFrom.y + (L.introTo.y - L.introFrom.y) * e;
    } else {
      const u = L.active;
      if (L.phase === 'turn' && u) {
        tgt = camFor({ x: u.x, y: u.y - 20 });
        if (L.aiming || (u.ai && u.ai.state === 'aim')) off = { x: Math.cos(u.aim.ang) * u.aim.pow * 170, y: Math.sin(u.aim.ang) * u.aim.pow * 80 };
      } else if (L.focus) tgt = camFor(L.focus);
      if (tgt) {
        const k = Math.min(1, dt * 5);
        L.camBase.x += (tgt.x - L.camBase.x) * k; L.camBase.y += (tgt.y - L.camBase.y) * k;
      }
    }
    const k2 = Math.min(1, dt * 4);
    L.camOff.x += (off.x - L.camOff.x) * k2; L.camOff.y += (off.y - L.camOff.y) * k2;
    let cx = L.camBase.x + L.camOff.x, cy = L.camBase.y + L.camOff.y;
    const a = L.active;
    if (L.phase === 'turn' && a) {          // 瞄準時鏡頭會往前探，但不能把自己的角色推出畫面
      cx = clamp(cx, a.x - (VW - 150), a.x - 150); cy = clamp(cy, a.y - (VH - 140), a.y - 170);
    }
    L.cam.x = clamp(cx, 0, Math.max(0, L.W * T - VW));
    L.cam.y = clamp(cy, 0, Math.max(0, L.H * T - VH));
  }

  // ---------- 繪圖 ----------
  function button(x, y, w, h, label, cb, size) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; A.rr(ctx, x + 2, y + 4, w, h, 12); ctx.fill();
    ctx.fillStyle = '#d9d4c7'; A.rr(ctx, x, y, w, h, 12); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; A.rr(ctx, x + 4, y + 3, w - 8, h * 0.35, 8); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#4b463c'; A.rr(ctx, x, y, w, h, 12); ctx.stroke();
    A.text(ctx, label, x + w / 2, y + h / 2 + 1, size || 20, '#fff', 'center', '#3a352c');
    ui.push({ x: x, y: y, w: w, h: h, cb: cb });
  }
  function drawArrow(x, y, ang, len, hollow) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const n = len - 20;
    ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(n, -8); ctx.lineTo(n, -16); ctx.lineTo(len, 0); ctx.lineTo(n, 16); ctx.lineTo(n, 8); ctx.lineTo(10, 3); ctx.closePath();
    if (hollow) { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#1d2a3a'; ctx.stroke(); }
    else {
      const g = ctx.createLinearGradient(10, 0, len, 0);
      g.addColorStop(0, '#35c22e'); g.addColorStop(0.55, '#f2e21d'); g.addColorStop(1, '#e6361c');
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#3a2a10'; ctx.stroke();
    }
    ctx.restore();
  }
  function hintBox(lines, x, y) {
    ctx.font = 'bold 16px "Microsoft JhengHei", sans-serif';
    let w = 0; lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    const bw = w + 24, bh = lines.length * 24 + 14;
    x = clamp(x, 8, VW - bw - 8); y = clamp(y, 100, VH - bh - 90);
    ctx.fillStyle = 'rgba(22,48,78,.93)'; A.rr(ctx, x, y, bw, bh, 6); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#9fc3e6'; ctx.stroke();
    lines.forEach(function (l, i) { A.text(ctx, l, x + 12, y + 20 + i * 24, 16, '#fff', 'left', null); });
  }
  function drawShot(s) {
    ctx.save(); ctx.translate(s.x, s.y);
    switch (s.kind) {
      case 'shell': ctx.fillStyle = '#3b3b3b'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.arc(-2, -2, 2, 0, 7); ctx.fill(); break;
      case 'melon': ctx.rotate(s.t * 8); A.icon(ctx, 'melon', 0, 0, 20); break;
      case 'toucan': if (s.vx < 0) ctx.scale(-1, 1); A.icon(ctx, 'toucan', 0, 0, 30); break;
      case 'puffer': { const k = s.stuck ? 1 + (1.1 - s.stuck) * 1.1 : 1; A.icon(ctx, 'puffer', 0, -6 * (k - 1), 20 * k); break; }
      case 'nailbag': ctx.rotate(s.t * 9); A.icon(ctx, 'nails', 0, 0, 22); break;
      case 'banana': ctx.rotate(s.t * 12); A.icon(ctx, 'banana', 0, 4, 24); break;
      case 'mini': ctx.rotate(s.t * 14); A.icon(ctx, 'banana', 0, 3, 15); break;
      case 'cocoon': ctx.rotate(s.t * 7); A.icon(ctx, 'worms', 0, 0, 24); break;
      case 'spike': ctx.rotate(Math.atan2(s.vy, s.vx)); ctx.strokeStyle = '#2f6f96'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke(); break;
    }
    ctx.restore();
  }
  function drawFx(f) {
    const k = f.t / f.dur;
    if (f.type === 'boom') {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.35 + 0.65 * k), 0, 7); ctx.fill();
      ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.2 + 0.5 * k), 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.3 * (1 - k), 0, 7); ctx.fill();
    } else if (f.type === 'p') {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color; ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    } else if (f.type === 'smoke') {
      ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * 6, 0, 7); ctx.fill();
    } else if (f.type === 'beam') {
      ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
      ctx.strokeStyle = f.color; ctx.lineWidth = f.w; ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, f.w * 0.3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawWorld() {
    const cx = Math.round(L.cam.x), cy = Math.round(L.cam.y);
    ctx.drawImage(L.bg, -cx * 0.3, -cy * 0.3 - 10);
    ctx.save();
    ctx.translate(-cx + (Math.random() - 0.5) * L.shake, -cy + (Math.random() - 0.5) * L.shake);
    const x0 = Math.max(0, Math.floor(cx / T) - 1), x1 = Math.min(L.W - 1, Math.floor((cx + VW) / T) + 1);
    const y0 = Math.max(0, Math.floor(cy / T) - 1), y1 = Math.min(L.H - 1, Math.floor((cy + VH) / T) + 1);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const b = L.grid[ty][tx];
      if (b) ctx.drawImage(A.tile(b), tx * T, ty * T, T + 0.6, T + 0.6);
    }
    for (const p of L.pickups) {
      if (p.kind === 'pebble') A.icon(ctx, 'pebble', p.x, p.y - 6, 15);
      else {
        const bob = Math.sin(time * 4) * 3;
        ctx.fillStyle = 'rgba(255,230,120,' + (0.35 + 0.15 * Math.sin(time * 5)) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y - 26 + bob, 22, 0, 7); ctx.fill();
        ctx.fillStyle = '#e0a514'; ctx.fillRect(p.x - 14, p.y - 8, 28, 8); ctx.fillRect(p.x - 5, p.y - 12, 10, 5);
        A.icon(ctx, L.def.pickup, p.x, p.y - 28 + bob, 30);
      }
    }
    for (const n of L.nails) A.icon(ctx, 'nails', n.x, n.y - 5, 14);

    const act = L.phase === 'turn' ? L.active : null;
    for (const u of L.units) if (u.dead && !u.gone) A.unit(ctx, u, null);
    for (const u of L.units) {
      if (u.dead) continue;
      A.unit(ctx, u, u === act ? (u.ai ? u.ai.weapon : L.weapon) : null);
      const bx = u.x - 14, by = u.y - UH - 13;
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(bx - 1, by - 1, 30, 7);
      ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, 28, 5);
      ctx.fillStyle = u.team ? '#e2362a' : '#3fc83a'; ctx.fillRect(bx, by, 28 * u.hp / u.max, 5);
    }
    if (act && !act.dead) {
      const bob = Math.sin(time * 6) * 3, mx = act.x, my = act.y - UH - 24 + bob;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx - 9, my - 9); ctx.lineTo(mx + 9, my - 9); ctx.lineTo(mx, my); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (L.next && !L.next.dead) A.text(ctx, 'NEXT', L.next.x, L.next.y - UH - 26, 12, '#fff', 'center', '#16324f');
    }
    for (const w of L.worms) { ctx.save(); ctx.translate(w.x, w.y - 4 - Math.abs(Math.sin(time * 14)) * 2); ctx.scale(w.face, 1); A.icon(ctx, 'worm', 0, 0, 14); ctx.restore(); }
    for (const s of L.shots) drawShot(s);
    for (const f of L.fx) drawFx(f);
    if (act && !act.dead) {
      const ax = act.x, ay = act.y - 24;
      if (!act.ai) {
        if (L.aiming) { ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, 195, 0, 7); ctx.fill(); ctx.stroke(); }
        drawArrow(ax, ay, act.aim.ang, 50 + act.aim.pow * 110, false);
      } else if (act.ai.state === 'aim') drawArrow(ax, ay, act.aim.ang, 50 + act.aim.pow * 110, act.team === 1);
    }
    for (const t of L.texts) { ctx.globalAlpha = clamp(1.6 - t.t * 1.4, 0, 1); A.text(ctx, t.txt, t.x, t.y, 17, t.color, 'center'); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function ctlButton(c) {
    const on = ctl(c.id) || (c.id === 'left' && (keys.ArrowLeft || keys.KeyA)) || (c.id === 'right' && (keys.ArrowRight || keys.KeyD)) || (c.id === 'jump' && (keys.ArrowUp || keys.KeyW));
    ctx.fillStyle = on ? 'rgba(90,110,135,.9)' : 'rgba(60,72,90,.72)'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(205,215,228,.9)'; ctx.stroke();
    ctx.save(); ctx.translate(c.x, c.y); ctx.fillStyle = '#e8edf3';
    if (c.id === 'fire') {
      ctx.beginPath();
      for (let i = 0; i < 28; i++) { const a = i * Math.PI / 14, d = i % 2 ? 31 : 25; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d * 0.8); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#39485c'; ctx.beginPath(); ctx.ellipse(0, 0, 19, 14, 0, 0, 7); ctx.fill();
    } else {
      ctx.rotate(c.id === 'left' ? Math.PI : c.id === 'jump' ? -Math.PI / 2 : 0);
      ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(0, -8); ctx.lineTo(0, -19); ctx.lineTo(20, 0); ctx.lineTo(0, 19); ctx.lineTo(0, 8); ctx.lineTo(-18, 8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function drawMenu() {
    for (let r = 0; r < MENU.length; r++) for (let c = 0; c < 3; c++) {
      const id = MENU[r][c], x = 8 + c * 66, y = 8 + r * 66, has = id && save.weapons.indexOf(id) >= 0;
      ctx.fillStyle = '#262628'; ctx.fillRect(x, y, 64, 64);
      ctx.lineWidth = 2; ctx.strokeStyle = (has && id === L.weapon) ? '#4fb3ff' : '#55565a'; ctx.strokeRect(x + 1, y + 1, 62, 62);
      if (!has) continue;
      A.icon(ctx, id, x + 32, y + 30, 46);
      const cost = WEAPONS[id].cost;
      if (cost) A.text(ctx, String(cost), x + 60, y + 52, 16, L.money >= cost ? '#fff' : '#ff7b6b', 'right', '#16324f');
      ui.push({ x: x, y: y, w: 64, h: 64, cb: (function (w) { return function () { L.weapon = w; menuOpen = false; }; })(id) });
    }
    const w = WEAPONS[L.weapon];
    hintBox([w.name + (w.cost ? '($' + w.cost + ')' : '')], 214, 100);
  }
  function drawHUD() {
    const human = L.phase === 'turn' && L.active && !L.active.ai && !L.active.dead;
    if (menuOpen) drawMenu();
    else {
      ctx.fillStyle = 'rgba(52,62,78,.85)'; ctx.beginPath(); ctx.arc(50, 50, 38, 0, 7); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = human ? '#cfd8e3' : '#7c8794'; ctx.stroke();
      A.icon(ctx, L.weapon, 50, 50, 52);
      if (WEAPONS[L.weapon].cost) A.text(ctx, '$' + WEAPONS[L.weapon].cost, 50, 80, 15, '#fff', 'center', '#16324f');
      ui.push({ x: 8, y: 8, w: 86, h: 86, cb: toggleMenu });
    }
    // 沙漏與倒數
    ctx.save(); ctx.translate(318, 38);
    ctx.fillStyle = '#f2e3b3'; ctx.beginPath(); ctx.moveTo(-12, -18); ctx.lineTo(12, -18); ctx.lineTo(2, 0); ctx.lineTo(12, 18); ctx.lineTo(-12, 18); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#6b5326'; ctx.stroke();
    ctx.fillStyle = '#e8a63a'; ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(8, 16); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8b6a2b'; ctx.fillRect(-15, -22, 30, 5); ctx.fillRect(-15, 17, 30, 5);
    ctx.restore();
    if (L.phase === 'turn' && (aliveOf(1).length || L.active.ai)) A.text(ctx, String(Math.max(0, Math.ceil(L.timer))), 290, 40, 28, L.timer < 6 ? '#ff5a4a' : '#fff', 'right', '#16324f');
    A.face(ctx, 0, 388, 36, 2.3); A.text(ctx, '×' + aliveOf(0).length, 402, 58, 22, '#fff', 'left', '#1e6b1e'); A.text(ctx, '$' + L.money, 394, 84, 17, '#fff', 'center', '#2b2b2b');
    A.face(ctx, 1, 486, 36, 2.3); A.text(ctx, '×' + aliveOf(1).length, 500, 58, 22, '#fff', 'left', '#8a1d14');
    ctx.fillStyle = 'rgba(52,62,78,.85)'; A.rr(ctx, 908, 12, 40, 34, 5); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#cfd8e3'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(920, 20, 6, 18); ctx.fillRect(931, 20, 6, 18);
    ui.push({ x: 902, y: 6, w: 52, h: 46, cb: function () { paused = true; } });

    if (human) CTL.forEach(ctlButton);
    if (human && !menuOpen) {
      const sx = L.active.x - L.cam.x, sy = L.active.y - L.cam.y;
      const noFoes = !aliveOf(1).length;
      if (noFoes) hintBox(['撿起新武器就過關！'], sx + 40, sy - 110);
      else if (L.newWeaponT > 0) hintBox(['獲得新武器！', '點左上角的圖示選擇武器'], 100, 100);
      else if (L.def.tutorial) {
        if (L.turns === 1) hintBox(['在畫面上拖曳來瞄準，', '拉得越遠力道越大。', '按右下的發射鍵(或空白鍵)開火'], sx + 60, sy - 120);
        else if (L.turns === 3) hintBox(['撿石頭可以用來買', '食物和特殊武器'], sx + 60, sy - 110);
        else if (L.turns === 5) hintBox(['消滅所有敵人！'], sx + 60, sy - 100);
      }
    }
    if (L.phase === 'intro') A.text(ctx, '第 ' + (L.idx + 1) + ' 關  ' + L.def.name, VW / 2, 300, 40, '#fff', 'center');
    if (L.toast) { ctx.globalAlpha = clamp(L.toast.t * 2, 0, 1); A.text(ctx, L.toast.txt, VW / 2, 150, 22, '#ffe36a', 'center'); ctx.globalAlpha = 1; }
    if (DEMO) A.text(ctx, 'DEMO', 940, 70, 14, '#ffe36a', 'right');
  }
  function drawPause() {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, VW, VH);
    ui = [];
    A.text(ctx, '暫停', VW / 2, 150, 44, '#fff', 'center');
    button(370, 215, 220, 54, '繼續', function () { paused = false; });
    button(370, 285, 220, 54, '重新開始', function () { loadLevel(L.idx); });
    button(370, 355, 220, 54, muted ? '音效：關' : '音效：開', function () { muted = !muted; });
    button(370, 425, 220, 54, '回到選關', function () { paused = false; scene = 'select'; });
  }
  function drawTitle() {
    ctx.drawImage(A.background('beach'), -200, -10);
    for (let x = 0; x < VW; x += T) { ctx.drawImage(A.tile({ t: 'grass', hp: 2, v: x / T }), x, 480); ctx.drawImage(A.tile({ t: 'stone', hp: 2, v: x / T * 7 }), x, 520); ctx.drawImage(A.tile({ t: 'stone', hp: 2, v: x / T * 3 + 1 }), x, 560); }
    const bob = Math.sin(time * 3) * 2;
    ctx.save(); ctx.translate(250, 480); ctx.scale(2.4, 2.4); A.unit(ctx, { x: 0, y: 0, team: 0, face: 1, walk: 0, dead: false, hurtT: 0, aim: { ang: -0.6 + bob * 0.03, pow: 1 } }, 'shell'); ctx.restore();
    ctx.save(); ctx.translate(710, 480); ctx.scale(2.4, 2.4); A.unit(ctx, { x: 0, y: 0, team: 1, face: -1, walk: 0, dead: false, hurtT: 0, aim: { ang: Math.PI + 0.6 - bob * 0.03, pow: 1 } }, 'melon'); ctx.restore();
    A.text(ctx, 'STONE WARS', VW / 2, 120, 84, '#f2c230', 'center', '#3a240d');
    A.text(ctx, '石器戰爭', VW / 2, 198, 38, '#fff', 'center', '#3a240d');
    button(370, 270, 220, 60, '開始遊戲', function () { selIdx = Math.min(save.unlocked, LEVELS.length) - 1; scene = 'select'; }, 24);
    A.text(ctx, '移動 A / D 或 ← →   跳躍 W 或 ↑   滑鼠拖曳瞄準   空白鍵發射   Q 選武器', VW / 2, 352, 15, '#fff', 'center', '#16324f');
  }
  function drawSelect() {
    const def = LEVELS[selIdx], locked = selIdx >= save.unlocked && !DEMO;
    ctx.drawImage(A.background(def.theme), -150, -10);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, VW, VH);
    A.text(ctx, '選擇關卡', VW / 2, 70, 40, '#fff', 'center');
    const pv = A.preview(def), pw = 560, ph = Math.min(280, pw * pv.height / pv.width), px = (VW - pw) / 2, py = 120;
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(px - 6, py - 6, pw + 12, ph + 12);
    ctx.drawImage(pv, px, py, pw, ph);
    if (locked) { ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(px, py, pw, ph); A.text(ctx, '尚未解鎖', VW / 2, py + ph / 2, 34, '#ddd', 'center'); }
    A.text(ctx, '第 ' + (selIdx + 1) + ' 關  ' + def.name, VW / 2, py + ph + 44, 30, '#fff', 'center');
    if (selIdx > 0) button(90, py + ph / 2 - 30, 70, 60, '◀', function () { selIdx--; }, 26);
    if (selIdx < LEVELS.length - 1) button(800, py + ph / 2 - 30, 70, 60, '▶', function () { selIdx++; }, 26);
    button(250, 510, 180, 56, '返回', function () { scene = 'title'; });
    if (!locked) button(530, 510, 180, 56, '開始', function () { tipIdx = selIdx; scene = 'tip'; });
  }
  function drawTip() {
    const def = LEVELS[tipIdx], w = WEAPONS[def.tip];
    A.panel(ctx, VW, VH);
    A.text(ctx, '第 ' + (tipIdx + 1) + ' 關  ' + def.name, VW / 2, 80, 36, '#fff', 'center');
    ctx.fillStyle = '#262628'; ctx.fillRect(150, 160, 130, 130); ctx.lineWidth = 3; ctx.strokeStyle = '#d23b2a'; ctx.strokeRect(150, 160, 130, 130);
    A.icon(ctx, def.tip, 215, 225, 96);
    A.text(ctx, w.name + ':', 320, 190, 30, '#fff', 'left');
    A.wrap(ctx, w.desc, 320, 240, 480, 34, 22, '#fff');
    if (def.tutorial) {
      A.wrap(ctx, '操作：A / D 或 ← → 移動，W 或 ↑ 跳躍；在畫面上拖曳瞄準，空白鍵或發射鍵開火；Q 或左上角圖示切換武器。', 150, 350, 660, 30, 18, '#cfe3ff');
    }
    const blink = 0.55 + 0.45 * Math.sin(time * 5);
    ctx.globalAlpha = blink; A.text(ctx, '點一下開始', VW / 2, 520, 26, '#8dff6a', 'center'); ctx.globalAlpha = 1;
    ui.push({ x: 0, y: 0, w: VW, h: VH, cb: beginPlay });
  }
  function drawResult() {
    const won = L.phase === 'won';
    A.panel(ctx, VW, VH);
    A.text(ctx, won ? 'You win' : 'You lose', VW / 2, 90, 44, '#fff', 'center');
    for (let i = 0; i < 9; i++) { ctx.drawImage(A.tile({ t: 'grass', hp: 2, v: i }), 300 + i * T, 330); }
    const a = { x: 430, y: 330, team: won ? 0 : 1, face: 1, walk: Math.sin(time * 6) > 0 ? 1 : 0, dead: false, hurtT: 0, aim: { ang: -1.2, pow: 1 } };
    const b = { x: 540, y: 330, team: won ? 1 : 0, face: -1, walk: 0, dead: true, hurtT: 0, aim: { ang: 0, pow: 0 } };
    ctx.save(); ctx.translate(a.x, a.y - Math.abs(Math.sin(time * 6)) * 10); ctx.scale(1.8, 1.8); a.x = 0; a.y = 0; A.unit(ctx, a, null); ctx.restore();
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1.8, 1.8); b.x = 0; b.y = 0; A.unit(ctx, b, null); ctx.restore();
    if (won && L.idx === LEVELS.length - 1) A.text(ctx, '恭喜！你統一了所有部落', VW / 2, 150, 24, '#ffe36a', 'center');
    button(260, 430, 190, 58, '回到選關', function () { selIdx = L.idx; scene = 'select'; });
    if (won && L.idx < LEVELS.length - 1) button(510, 430, 190, 58, '下一關', function () { tipIdx = L.idx + 1; scene = 'tip'; });
    else button(510, 430, 190, 58, '再玩一次', function () { tipIdx = L.idx; scene = 'tip'; });
  }
  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ui = [];
    if (scene === 'title') drawTitle();
    else if (scene === 'select') drawSelect();
    else if (scene === 'tip') drawTip();
    else if (scene === 'result') drawResult();
    else { drawWorld(); drawHUD(); if (paused) drawPause(); }
  }
  function beginPlay() { loadLevel(tipIdx); scene = 'play'; }

  // ---------- 輸入 ----------
  function vpos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * VW / r.width, y: (e.clientY - r.top) * VH / r.height }; }
  function aimAt(p) {
    const u = L.active; if (!u || u.ai || L.phase !== 'turn') return;
    const dx = p.x - (u.x - L.camBase.x), dy = p.y - (u.y - 24 - L.camBase.y), d = Math.hypot(dx, dy);
    if (d < 10) return;
    u.aim.ang = Math.atan2(dy, dx); u.aim.pow = clamp((d - 25) / 170, 0.1, 1); u.face = dx >= 0 ? 1 : -1;
  }
  function down(id, p) {
    for (let i = ui.length - 1; i >= 0; i--) {
      const b = ui[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { b.cb(); return; }
    }
    if (scene !== 'play' || paused) return;
    if (menuOpen) { menuOpen = false; return; }
    if (L.phase === 'intro') { L.introT = 2.6; return; }
    if (L.phase !== 'turn' || !L.active || L.active.ai) return;
    for (const c of CTL) {
      if (Math.hypot(p.x - c.x, p.y - c.y) <= c.r + 6) { if (c.id === 'fire') tryFire(); else held[id] = c.id; return; }
    }
    held[id] = 'aim'; L.aiming = true; aimAt(p);
  }
  function release(e) { if (held[e.pointerId] === 'aim' && L) L.aiming = false; delete held[e.pointerId]; }
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault(); initAudio();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 舊瀏覽器沒有 pointer capture */ }
    down(e.pointerId, vpos(e));
  });
  cv.addEventListener('pointermove', function (e) { if (held[e.pointerId] === 'aim' && L) aimAt(vpos(e)); });
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', function (e) {
    initAudio();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
    keys[e.code] = true;
    if (e.repeat) return;
    const go = e.code === 'Space' || e.code === 'Enter';
    if (scene === 'play') {
      if (e.code === 'Escape' || e.code === 'KeyP') paused = !paused;
      else if (paused) return;
      else if (go || e.code === 'KeyF') { if (L.phase === 'intro') L.introT = 2.6; else tryFire(); }
      else if (e.code === 'KeyQ' || e.code === 'Tab') toggleMenu();
    } else if (scene === 'tip' && go) beginPlay();
    else if (scene === 'title' && go) { selIdx = Math.min(save.unlocked, LEVELS.length) - 1; scene = 'select'; }
    else if (scene === 'select') {
      if (e.code === 'ArrowLeft' && selIdx > 0) selIdx--;
      else if (e.code === 'ArrowRight' && selIdx < LEVELS.length - 1) selIdx++;
      else if (go && (selIdx < save.unlocked || DEMO)) { tipIdx = selIdx; scene = 'tip'; }
    }
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { for (const k in keys) keys[k] = false; });

  function resize() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    scale = clamp((r.width || VW) * dpr / VW, 0.5, 3);
    cv.width = Math.round(VW * scale); cv.height = Math.round(VH * scale);
  }
  window.addEventListener('resize', resize);
  resize();

  function tick(dt) {
    time += dt;
    if (scene === 'play' && !paused) updatePlay(dt);
    draw();
  }
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0); last = ts;
    tick(dt);
    requestAnimationFrame(frame);
  }
  if (params.has('level')) { tipIdx = clamp(parseInt(params.get('level'), 10) - 1 || 0, 0, LEVELS.length - 1); beginPlay(); }
  SW.debug = { tick: tick, state: function () { return { scene: scene, L: L }; }, begin: function (i) { tipIdx = i; beginPlay(); }, fire: tryFire, setWeapon: function (w) { L.weapon = w; } };
  requestAnimationFrame(frame);
})();
