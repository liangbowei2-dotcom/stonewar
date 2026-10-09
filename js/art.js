// 所有圖像都在這裡用 Canvas 程式繪製，沒有外部圖檔
(function () {
  'use strict';
  const SW = window.SW = window.SW || {};
  const T = SW.T = 40;
  const A = SW.art = {};
  const FONT = '"Arial Black", "Microsoft JhengHei", "PingFang TC", sans-serif';

  function rng(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  A.rr = rr;

  A.text = function (g, s, x, y, size, fill, align, stroke) {
    g.font = 'bold ' + size + 'px ' + FONT;
    g.textAlign = align || 'left'; g.textBaseline = 'middle';
    if (stroke !== null) {
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, size / 5); g.strokeStyle = stroke || '#1b1b1b';
      g.strokeText(s, x, y);
    }
    g.fillStyle = fill || '#fff'; g.fillText(s, x, y);
  };
  // 逐字換行，中英文都適用
  A.wrap = function (g, s, x, y, maxW, lineH, size, fill) {
    g.font = 'bold ' + size + 'px ' + FONT;
    let line = '', yy = y;
    for (const ch of s) {
      if (g.measureText(line + ch).width > maxW && line) { A.text(g, line, x, yy, size, fill, 'left'); line = ''; yy += lineH; }
      line += ch;
    }
    if (line) A.text(g, line, x, yy, size, fill, 'left');
    return yy + lineH;
  };

  // ---------- 方塊 ----------
  function bevel(g, light, dark) {
    g.fillStyle = light; g.fillRect(0, 0, T, 3); g.fillRect(0, 0, 3, T);
    g.fillStyle = dark; g.fillRect(0, T - 3, T, 3); g.fillRect(T - 3, 0, 3, T);
  }
  function speckle(g, r, n, a, b) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = r() < 0.5 ? a : b;
      g.fillRect(r() * T | 0, r() * T | 0, 2 + r() * 5, 1 + r() * 2);
    }
  }
  function stoneTile(seed, glyph) {
    const c = mk(T, T), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = '#6f85ab'; g.fillRect(0, 0, T, T);
    speckle(g, r, 70, 'rgba(255,255,255,.08)', 'rgba(20,30,70,.12)');
    bevel(g, 'rgba(255,255,255,.24)', 'rgba(15,25,60,.38)');
    if (glyph) {
      const path = function () {
        g.beginPath();
        if (glyph === 1) { for (let a = 0; a < 12; a += 0.3) { const d = 2 + a * 1.1; g.lineTo(20 + Math.cos(a) * d, 20 + Math.sin(a) * d); } }
        else if (glyph === 2) { for (let k = 0; k < 3; k++) { g.moveTo(8, 12 + k * 8); g.lineTo(14, 8 + k * 8); g.lineTo(20, 12 + k * 8); g.lineTo(26, 8 + k * 8); g.lineTo(32, 12 + k * 8); } }
        else if (glyph === 3) { g.rect(9, 9, 22, 22); g.rect(15, 15, 10, 10); }
        else { g.ellipse(20, 20, 12, 7, 0, 0, 7); g.moveTo(23, 20); g.arc(20, 20, 3, 0, 7); }
      };
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 2.5;
      g.save(); g.translate(1, 1); g.strokeStyle = 'rgba(255,255,255,.22)'; path(); g.stroke(); g.restore();
      g.strokeStyle = 'rgba(28,42,86,.8)'; path(); g.stroke();
    }
    return c;
  }
  function rubbleTile(seed) {
    const c = mk(T, T), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = '#8f8a7c'; g.fillRect(0, 0, T, T);
    for (let i = 0; i < 26; i++) {
      const x = r() * T, y = r() * T, s = 3 + r() * 5, v = 150 + r() * 70 | 0;
      g.fillStyle = 'rgb(' + v + ',' + (v - 6) + ',' + (v - 26) + ')';
      g.beginPath(); g.ellipse(x, y, s, s * 0.75, r() * 3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(60,55,45,.5)'; g.lineWidth = 1; g.stroke();
    }
    bevel(g, 'rgba(255,255,255,.15)', 'rgba(40,35,25,.3)');
    return c;
  }
  function goldTile(cracked) {
    const c = mk(T, T), g = c.getContext('2d');
    g.fillStyle = '#e0a514'; g.fillRect(0, 0, T, T);
    bevel(g, 'rgba(255,245,170,.7)', 'rgba(110,60,0,.55)');
    g.fillStyle = '#7a4700';
    g.fillRect(7, 9, 11, 3); g.fillRect(22, 9, 11, 3);       // 眉
    g.fillRect(9, 14, 7, 6); g.fillRect(24, 14, 7, 6);       // 眼
    g.fillRect(18, 17, 4, 8);                                // 鼻
    g.fillRect(9, 27, 22, 7);                                // 嘴
    g.fillStyle = '#ffe07a';
    for (let i = 0; i < 4; i++) g.fillRect(11 + i * 5, 29, 3, 3);
    g.fillRect(11, 15, 2, 2); g.fillRect(26, 15, 2, 2);
    if (cracked) {
      g.strokeStyle = 'rgba(60,30,0,.85)'; g.lineWidth = 2; g.beginPath();
      g.moveTo(3, 5); g.lineTo(15, 16); g.lineTo(11, 26); g.lineTo(22, 37);
      g.moveTo(37, 8); g.lineTo(27, 20); g.lineTo(33, 30); g.stroke();
    }
    return c;
  }
  function grassTile(seed) {
    const c = mk(T, T), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = '#b39d74'; g.fillRect(0, 0, T, T);
    for (let i = 0; i < 16; i++) {
      const v = 150 + r() * 50 | 0;
      g.fillStyle = 'rgb(' + (v + 20) + ',' + v + ',' + (v - 40) + ')';
      g.beginPath(); g.ellipse(r() * T, 12 + r() * 28, 4 + r() * 5, 3 + r() * 3, r() * 3, 0, 7); g.fill();
    }
    bevel(g, 'rgba(255,255,255,.12)', 'rgba(60,40,10,.3)');
    g.fillStyle = '#4f8f2a'; g.fillRect(0, 0, T, 9);
    g.fillStyle = '#6fb53a'; g.fillRect(0, 0, T, 4);
    g.fillStyle = '#4f8f2a';
    for (let x = 0; x < T; x += 5) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 2.5, 12 + r() * 5); g.lineTo(x + 5, 8); g.fill(); }
    return c;
  }
  function brickTile() {
    const c = mk(T, T), g = c.getContext('2d'), r = rng(77);
    g.fillStyle = '#c9a36b'; g.fillRect(0, 0, T, T);
    speckle(g, r, 50, 'rgba(255,240,200,.18)', 'rgba(90,55,10,.15)');
    bevel(g, 'rgba(255,245,215,.5)', 'rgba(80,50,10,.45)');
    g.strokeStyle = 'rgba(95,60,15,.5)'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(3, 14); g.lineTo(37, 14); g.moveTo(3, 27); g.lineTo(37, 27);
    g.moveTo(20, 3); g.lineTo(20, 14); g.moveTo(11, 14); g.lineTo(11, 27); g.moveTo(29, 14); g.lineTo(29, 27); g.moveTo(20, 27); g.lineTo(20, 37);
    g.stroke();
    return c;
  }
  let TILES = null;
  function buildTiles() {
    TILES = { stone: [], rubble: [], grass: [], gold: [goldTile(false), goldTile(true)], brick: brickTile() };
    for (let i = 0; i < 10; i++) TILES.stone.push(stoneTile(100 + i * 7, i < 7 ? 0 : i - 6));
    for (let i = 0; i < 3; i++) { TILES.rubble.push(rubbleTile(300 + i)); TILES.grass.push(grassTile(500 + i)); }
  }
  A.tile = function (b) {
    if (!TILES) buildTiles();
    if (b.t === 'gold') return TILES.gold[b.hp <= 2 ? 1 : 0];
    if (b.t === 'brick') return TILES.brick;
    if (b.t === 'rubble' || b.hp < 2) return TILES.rubble[b.v % 3];
    if (b.t === 'grass') return TILES.grass[b.v % 3];
    return TILES.stone[b.v % 10];
  };
  A.goldTile = function () { if (!TILES) buildTiles(); return TILES.gold[0]; };

  // ---------- 背景 ----------
  const BW = 1600, BH = 660;
  function cloud(g, x, y, s) {
    g.fillStyle = 'rgba(255,255,255,.8)';
    [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.7], [0.4, -0.35, 0.7], [1.7, 0.3, 0.5]].forEach(function (p) {
      g.beginPath(); g.ellipse(x + p[0] * s, y + p[1] * s, s * p[2], s * p[2] * 0.6, 0, 0, 7); g.fill();
    });
  }
  function mesa(g, x, y, w, h) {
    g.fillStyle = '#d6bd88'; g.beginPath();
    g.moveTo(x, y + h); g.lineTo(x + w * 0.12, y + h * 0.35); g.lineTo(x + w * 0.04, y);
    g.lineTo(x + w * 0.96, y); g.lineTo(x + w * 0.86, y + h * 0.35); g.lineTo(x + w, y + h); g.fill();
    g.fillStyle = 'rgba(120,90,40,.25)'; g.fillRect(x + w * 0.12, y + h * 0.35, w * 0.74, 3);
    g.fillStyle = '#5a9a34'; rr(g, x + w * 0.02, y - 5, w * 0.96, 10, 5); g.fill();
  }
  function skyAndSea(g, r, top, mid, seaA, seaB, horizon) {
    let gr = g.createLinearGradient(0, 0, 0, horizon);
    gr.addColorStop(0, top); gr.addColorStop(1, mid);
    g.fillStyle = gr; g.fillRect(0, 0, BW, horizon);
    gr = g.createLinearGradient(0, horizon, 0, horizon + 150);
    gr.addColorStop(0, seaA); gr.addColorStop(1, seaB);
    g.fillStyle = gr; g.fillRect(0, horizon, BW, BH - horizon);
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 60; i++) g.fillRect(r() * BW, horizon + 6 + r() * 130, 12 + r() * 40, 1.5);
  }
  function beach(g, r) {
    skyAndSea(g, r, '#3a97e2', '#c6e9f8', '#1b86bd', '#4fc4da', 280);
    for (let i = 0; i < 9; i++) cloud(g, r() * BW, 40 + r() * 170, 26 + r() * 30);
    for (let i = 0; i < 6; i++) mesa(g, 60 + i * 270 + r() * 80, 330 + r() * 30, 150 + r() * 90, 60 + r() * 30);
    const gr = g.createLinearGradient(0, 420, 0, BH);
    gr.addColorStop(0, '#74ad3e'); gr.addColorStop(1, '#3d7a22');
    g.fillStyle = gr; g.fillRect(0, 420, BW, BH - 420);
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 300; i++) g.fillRect(r() * BW, 425 + r() * 230, 2, 5);
  }
  function jungle(g, r) {
    skyAndSea(g, r, '#3a97e2', '#c6e9f8', '#1b86bd', '#4fc4da', 300);
    for (let i = 0; i < 7; i++) cloud(g, r() * BW, 40 + r() * 150, 24 + r() * 28);
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = ['#2f6f2a', '#3b8a30', '#2a6124'][layer];
      for (let i = 0; i < 60; i++) {
        g.beginPath(); g.arc(r() * BW, 330 + layer * 50 + r() * 70, 26 + r() * 36, 0, 7); g.fill();
      }
    }
    for (let i = 0; i < 5; i++) {         // 高腳屋
      const x = 120 + i * 300 + r() * 100, y = 470 + r() * 40;
      g.fillStyle = '#5a3d20'; g.fillRect(x + 6, y, 5, 80); g.fillRect(x + 50, y, 5, 80);
      g.fillStyle = '#8a6535'; g.fillRect(x, y - 34, 62, 36);
      g.fillStyle = '#3a2512'; g.fillRect(x + 24, y - 20, 14, 22);
      g.fillStyle = '#b08a48'; g.beginPath(); g.moveTo(x - 12, y - 32); g.lineTo(x + 31, y - 70); g.lineTo(x + 74, y - 32); g.fill();
    }
    g.fillStyle = '#2a5a20'; g.fillRect(0, 560, BW, 100);
  }
  function sunset(g, r) {
    let gr = g.createLinearGradient(0, 0, 0, 340);
    gr.addColorStop(0, '#3c2b5e'); gr.addColorStop(0.55, '#c8556a'); gr.addColorStop(1, '#f8b869');
    g.fillStyle = gr; g.fillRect(0, 0, BW, 340);
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(1050, 330, 60, 0, 7); g.fill();
    g.fillStyle = 'rgba(70,40,80,.55)';
    for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(r() * BW, 150 + r() * 150, 80 + r() * 120, 7 + r() * 8, 0, 0, 7); g.fill(); }
    gr = g.createLinearGradient(0, 340, 0, 470);
    gr.addColorStop(0, '#e98a5c'); gr.addColorStop(1, '#5b3a66');
    g.fillStyle = gr; g.fillRect(0, 340, BW, 130);
    g.fillStyle = 'rgba(255,220,150,.4)';
    for (let i = 0; i < 40; i++) g.fillRect(900 + r() * 300, 345 + r() * 110, 20 + r() * 50, 2);
    g.fillStyle = '#2f3a2a'; g.fillRect(0, 470, BW, BH - 470);
    for (let i = 0; i < 9; i++) {         // 石柱剪影
      const x = 80 + i * 175 + r() * 60, h = 70 + r() * 60, w = 26 + r() * 12;
      g.fillStyle = '#2b2440'; rr(g, x, 475 - h, w, h, 9); g.fill();
      g.fillRect(x - 4, 475 - h + 12, w + 8, 7);
    }
  }
  function cave(g, r) {
    let gr = g.createLinearGradient(0, 0, 0, BH);
    gr.addColorStop(0, '#6a5237'); gr.addColorStop(1, '#2c2015');
    g.fillStyle = gr; g.fillRect(0, 0, BW, BH);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.10)' : 'rgba(255,220,160,.05)';
      g.beginPath(); g.ellipse(r() * BW, r() * BH, 40 + r() * 120, 20 + r() * 60, r() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 6; i++) {         // 洞口
      const x = 100 + i * 260 + r() * 120;
      g.fillStyle = '#17110b'; g.beginPath(); g.ellipse(x, 430, 34 + r() * 20, 60 + r() * 20, 0, Math.PI, 0); g.lineTo(x + 54, 440); g.lineTo(x - 54, 440); g.fill();
    }
    g.fillStyle = 'rgba(45,100,108,.8)'; g.fillRect(0, 430, BW, BH - 430);
    g.fillStyle = 'rgba(140,200,200,.25)'; g.fillRect(0, 430, BW, 3);
    for (let i = 0; i < 16; i++) {        // 石柱與鐘乳石
      const x = r() * BW, w = 30 + r() * 50;
      g.fillStyle = '#4a3826'; g.beginPath();
      g.moveTo(x - w, 0); g.quadraticCurveTo(x - w * 0.2, 150, x - w * 0.3, 330); g.quadraticCurveTo(x - w * 0.3, 520, x - w * 1.1, BH);
      g.lineTo(x + w * 1.1, BH); g.quadraticCurveTo(x + w * 0.3, 520, x + w * 0.3, 330); g.quadraticCurveTo(x + w * 0.2, 150, x + w, 0); g.fill();
      g.fillStyle = 'rgba(255,220,170,.07)'; g.fillRect(x - w * 0.15, 0, 6, BH);
    }
    g.fillStyle = '#3a2b1c';
    for (let i = 0; i < 40; i++) { const x = r() * BW, h = 20 + r() * 70; g.beginPath(); g.moveTo(x - 10, 0); g.lineTo(x, h); g.lineTo(x + 10, 0); g.fill(); }
  }
  const BG = {};
  A.background = function (theme) {
    if (BG[theme]) return BG[theme];
    const c = mk(BW, BH), g = c.getContext('2d');
    ({ beach: beach, jungle: jungle, sunset: sunset, cave: cave })[theme](g, rng(theme.length * 97 + 5));
    return BG[theme] = c;
  };

  // ---------- 武器 / 道具圖示(以 0,0 為中心，s 為直徑) ----------
  A.icon = function (g, id, x, y, s) {
    g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round';
    const u = s / 2;
    switch (id) {
      case 'shell':
        g.rotate(-0.5);
        g.fillStyle = '#a8743a'; rr(g, -u * 0.9, -u * 0.36, u * 1.7, u * 0.72, u * 0.2); g.fill();
        g.strokeStyle = '#5d3b17'; g.lineWidth = u * 0.1; g.stroke();
        g.beginPath(); g.moveTo(-u * 0.3, -u * 0.36); g.lineTo(-u * 0.3, u * 0.36); g.moveTo(u * 0.25, -u * 0.36); g.lineTo(u * 0.25, u * 0.36); g.stroke();
        g.fillStyle = '#3a240d'; g.beginPath(); g.ellipse(u * 0.8, 0, u * 0.16, u * 0.3, 0, 0, 7); g.fill();
        g.fillStyle = '#5fae3a'; g.beginPath(); g.ellipse(-u * 0.1, -u * 0.55, u * 0.3, u * 0.14, -0.6, 0, 7); g.fill();
        break;
      case 'melon':
        g.fillStyle = '#3f9b3a'; g.beginPath(); g.arc(0, 0, u * 0.8, 0, 7); g.fill();
        g.strokeStyle = '#1f5f22'; g.lineWidth = u * 0.14;
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(i * u * 0.3, 0, u * 0.14, u * 0.72, 0, 0, 7); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-u * 0.3, -u * 0.4, u * 0.2, u * 0.1, -0.6, 0, 7); g.fill();
        break;
      case 'toucan':
        g.fillStyle = '#1c1c22'; g.beginPath(); g.ellipse(-u * 0.25, u * 0.15, u * 0.5, u * 0.62, 0.3, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-u * 0.02, u * 0.02, u * 0.24, u * 0.34, 0.3, 0, 7); g.fill();
        g.fillStyle = '#f6a21a'; g.beginPath(); g.moveTo(0, -u * 0.45); g.quadraticCurveTo(u * 0.9, -u * 0.6, u * 0.95, u * 0.15); g.quadraticCurveTo(u * 0.5, -u * 0.05, 0, -u * 0.05); g.fill();
        g.fillStyle = '#d8402a'; g.beginPath(); g.arc(u * 0.86, 0, u * 0.12, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(-u * 0.12, -u * 0.36, u * 0.11, 0, 7); g.fill();
        g.fillStyle = '#000'; g.beginPath(); g.arc(-u * 0.1, -u * 0.36, u * 0.05, 0, 7); g.fill();
        break;
      case 'gun':
        g.rotate(-0.25);
        g.fillStyle = '#9c7442'; g.strokeStyle = '#4e3516'; g.lineWidth = u * 0.09;
        rr(g, -u * 0.8, -u * 0.34, u * 1.6, u * 0.3, u * 0.08); g.fill(); g.stroke();
        rr(g, -u * 0.62, -u * 0.1, u * 0.3, u * 0.75, u * 0.08); g.fill(); g.stroke();
        g.fillStyle = '#4e3516'; g.fillRect(u * 0.62, -u * 0.44, u * 0.1, u * 0.14);
        break;
      case 'brick':
        g.fillStyle = '#c9a36b'; g.fillRect(-u * 0.6, -u * 0.3, u * 1.0, u * 0.95);
        g.fillStyle = '#e6c894'; g.beginPath(); g.moveTo(-u * 0.6, -u * 0.3); g.lineTo(-u * 0.25, -u * 0.65); g.lineTo(u * 0.75, -u * 0.65); g.lineTo(u * 0.4, -u * 0.3); g.fill();
        g.fillStyle = '#9b7741'; g.beginPath(); g.moveTo(u * 0.4, -u * 0.3); g.lineTo(u * 0.75, -u * 0.65); g.lineTo(u * 0.75, u * 0.3); g.lineTo(u * 0.4, u * 0.65); g.fill();
        break;
      case 'puffer':
        g.strokeStyle = '#3d7fa8'; g.lineWidth = u * 0.1;
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(Math.cos(a) * u * 0.55, Math.sin(a) * u * 0.55); g.lineTo(Math.cos(a) * u * 0.92, Math.sin(a) * u * 0.92); g.stroke(); }
        g.fillStyle = '#7fc4e8'; g.beginPath(); g.arc(0, 0, u * 0.66, 0, 7); g.fill();
        g.fillStyle = '#f4fbff'; g.beginPath(); g.ellipse(0, u * 0.26, u * 0.52, u * 0.36, 0, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(u * 0.22, -u * 0.2, u * 0.2, 0, 7); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(u * 0.27, -u * 0.2, u * 0.09, 0, 7); g.fill();
        break;
      case 'nails':
        [[-0.4, 0.2, 0.42], [0.35, -0.25, 0.5], [0.3, 0.45, 0.32]].forEach(function (p) {
          g.fillStyle = '#e2507f'; g.beginPath();
          for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, d = (i % 2 ? 0.4 : 1) * p[2] * u; g.lineTo(p[0] * u + Math.cos(a) * d, p[1] * u + Math.sin(a) * d); }
          g.fill();
        });
        break;
      case 'banana':
        g.fillStyle = '#f5d21f'; g.beginPath(); g.arc(0, -u * 0.25, u * 0.9, 0.3, Math.PI - 0.3); g.arc(0, -u * 0.75, u * 0.95, Math.PI - 0.75, 0.75, true); g.fill();
        g.fillStyle = '#6b4a12'; g.beginPath(); g.arc(-u * 0.82, 0, u * 0.09, 0, 7); g.arc(u * 0.82, 0, u * 0.09, 0, 7); g.fill();
        break;
      case 'worms':
        g.fillStyle = '#e0a62a'; g.beginPath(); g.moveTo(-u * 0.8, u * 0.5); g.quadraticCurveTo(-u * 0.6, -u * 0.7, u * 0.5, -u * 0.6);
        g.quadraticCurveTo(u * 0.95, -u * 0.3, u * 0.6, u * 0.2); g.quadraticCurveTo(0, u * 0.1, -u * 0.8, u * 0.5); g.fill();
        g.strokeStyle = '#8b5f0c'; g.lineWidth = u * 0.08;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-u * 0.45 + i * u * 0.3, -u * 0.5 + i * u * 0.02); g.lineTo(-u * 0.35 + i * u * 0.3, u * 0.2 - i * u * 0.05); g.stroke(); }
        break;
      case 'meat':
        g.strokeStyle = '#f3ead6'; g.lineWidth = u * 0.22; g.beginPath(); g.moveTo(-u * 0.2, u * 0.2); g.lineTo(-u * 0.75, u * 0.75); g.stroke();
        g.fillStyle = '#b5542a'; g.beginPath(); g.ellipse(u * 0.15, -u * 0.15, u * 0.62, u * 0.5, -0.7, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,200,150,.5)'; g.beginPath(); g.ellipse(u * 0.02, -u * 0.38, u * 0.2, u * 0.1, -0.7, 0, 7); g.fill();
        break;
      case 'qigong': {
        const gr = g.createRadialGradient(u * 0.2, 0, 1, u * 0.2, 0, u * 0.7);
        gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, '#7fe9ff'); gr.addColorStop(1, 'rgba(60,160,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(u * 0.2, 0, u * 0.7, 0, 7); g.fill();
        g.strokeStyle = '#7fe9ff'; g.lineWidth = u * 0.1;
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-u * 0.9, i * u * 0.28); g.lineTo(-u * 0.2, i * u * 0.2); g.stroke(); }
        break;
      }
      case 'vampire':
        g.fillStyle = '#2a1830'; g.beginPath(); g.moveTo(0, -u * 0.2);
        g.quadraticCurveTo(u * 0.5, -u * 0.9, u * 0.95, -u * 0.3); g.lineTo(u * 0.7, u * 0.1); g.lineTo(u * 0.45, -u * 0.1); g.lineTo(u * 0.25, u * 0.35); g.lineTo(0, u * 0.1);
        g.lineTo(-u * 0.25, u * 0.35); g.lineTo(-u * 0.45, -u * 0.1); g.lineTo(-u * 0.7, u * 0.1); g.lineTo(-u * 0.95, -u * 0.3); g.quadraticCurveTo(-u * 0.5, -u * 0.9, 0, -u * 0.2); g.fill();
        g.beginPath(); g.arc(0, -u * 0.05, u * 0.26, 0, 7); g.fill();
        g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(-u * 0.1, -u * 0.08, u * 0.06, 0, 7); g.arc(u * 0.1, -u * 0.08, u * 0.06, 0, 7); g.fill();
        break;
      case 'pebble':
        g.fillStyle = '#e9e6dc'; g.beginPath(); g.ellipse(0, 0, u * 0.75, u * 0.55, 0.3, 0, 7); g.fill();
        g.strokeStyle = '#8b8778'; g.lineWidth = u * 0.12; g.stroke();
        break;
      case 'worm':
        g.strokeStyle = '#d98a2b'; g.lineWidth = u * 0.5; g.beginPath(); g.moveTo(-u * 0.7, 0); g.quadraticCurveTo(0, -u * 0.8, u * 0.7, 0); g.stroke();
        g.fillStyle = '#111'; g.beginPath(); g.arc(u * 0.7, -u * 0.05, u * 0.12, 0, 7); g.fill();
        break;
    }
    g.restore();
  };

  // ---------- 原始人(原創造型) ----------
  const SKIN = '#e3a271', SKIN_D = '#b97848';
  function headgear(g, team) {
    if (team === 0) {                       // 綠葉帽
      g.fillStyle = '#3f9e3c'; g.beginPath(); g.arc(1, -36, 10, Math.PI, 0); g.fill();
      g.beginPath(); g.ellipse(9, -37, 9, 3.2, 0.1, 0, 7); g.fill();
      g.strokeStyle = '#256b25'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-6, -40); g.lineTo(8, -40); g.stroke();
    } else {                                // 紅刺髮 + 骨頭
      g.fillStyle = '#d23b2a'; g.beginPath(); g.moveTo(-9, -36);
      g.lineTo(-10, -47); g.lineTo(-4, -42); g.lineTo(-1, -50); g.lineTo(3, -43); g.lineTo(8, -48); g.lineTo(10, -38); g.closePath(); g.fill();
      g.strokeStyle = '#f3ead6'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-8, -40); g.lineTo(9, -38); g.stroke();
    }
  }
  function figure(g, team, walk, armAng, held, dead) {
    const sw = Math.sin(walk) * 4;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = SKIN_D; g.lineWidth = 6;                                  // 腿
    g.beginPath(); g.moveTo(-4, -11); g.lineTo(-5 - sw, -2); g.moveTo(4, -11); g.lineTo(5 + sw, -2); g.stroke();
    g.fillStyle = SKIN; g.beginPath(); g.ellipse(0, -19, 11, 11, 0, 0, 7); g.fill();   // 身體
    g.fillStyle = team === 0 ? '#8a5a2b' : '#6e4a2e';                         // 獸皮
    g.beginPath(); g.moveTo(-11, -21); g.lineTo(4, -29); g.lineTo(11, -20); g.lineTo(11, -11);
    g.lineTo(7, -7); g.lineTo(4, -11); g.lineTo(0, -6); g.lineTo(-4, -11); g.lineTo(-8, -7); g.lineTo(-11, -12); g.closePath(); g.fill();
    g.fillStyle = 'rgba(30,15,0,.45)';
    g.beginPath(); g.arc(-4, -16, 1.8, 0, 7); g.arc(4, -14, 1.5, 0, 7); g.arc(1, -21, 1.4, 0, 7); g.fill();
    g.fillStyle = SKIN; g.beginPath(); g.arc(1, -34, 9, 0, 7); g.fill();       // 頭
    g.fillStyle = '#d98c66'; g.beginPath(); g.arc(9.5, -32.5, 3.6, 0, 7); g.fill();     // 鼻
    if (dead) {
      g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath();
      g.moveTo(3, -38); g.lineTo(7, -34); g.moveTo(7, -38); g.lineTo(3, -34); g.stroke();
    } else {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(5, -36, 2.4, 0, 7); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(5.8, -36, 1.1, 0, 7); g.fill();
      g.strokeStyle = '#3a2412'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(2, -39.5); g.lineTo(8, -38.5); g.stroke();
    }
    g.strokeStyle = '#7a3d24'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(3, -29); g.lineTo(8, -28.5); g.stroke();
    headgear(g, team);
    g.save(); g.translate(1, -24); g.rotate(armAng);                          // 手臂
    g.strokeStyle = SKIN; g.lineWidth = 5.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(12, 0); g.stroke();
    if (held) { g.translate(15, 0); A.icon(g, held, 0, 0, 22); }
    g.restore();
  }
  // u: {x,y,team,face,walk,dead,aim,hurtT}
  A.unit = function (g, u, held) {
    g.save();
    g.translate(u.x + (u.hurtT > 0 ? Math.sin(u.hurtT * 80) * 2 : 0), u.y);
    if (u.dead) {
      g.translate(0, -9); g.rotate(-u.face * Math.PI / 2); g.translate(0, 18); g.scale(u.face, 1);
      figure(g, u.team, 0, 1.2, null, true);
    } else {
      g.scale(u.face, 1);
      let a = 1.1;
      if (held) { a = u.aim.ang; if (u.face < 0) a = Math.PI - a; if (held === 'shell') a += 0.5; }
      figure(g, u.team, u.walk, a, held, false);
    }
    g.restore();
  };
  A.face = function (g, team, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); g.translate(-1, 36);
    g.fillStyle = SKIN; g.beginPath(); g.arc(1, -34, 9, 0, 7); g.fill();
    g.fillStyle = '#d98c66'; g.beginPath(); g.arc(9.5, -32.5, 3.6, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(5, -36, 2.4, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(5.8, -36, 1.1, 0, 7); g.fill();
    headgear(g, team);
    g.restore();
  };

  // 石頭質感的深色面板(載入 / 結算畫面)
  let PANEL = null;
  A.panel = function (g, W, H) {
    if (!PANEL) {
      PANEL = mk(W, H); const p = PANEL.getContext('2d'), r = rng(9);
      p.fillStyle = '#3a3a3c'; p.fillRect(0, 0, W, H);
      for (let i = 0; i < 5000; i++) { p.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.07)'; p.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }
      const gt = A.goldTile();
      for (let y = 0; y < H; y += T) { p.drawImage(gt, 0, y); p.drawImage(gt, W - T, y); }
    }
    g.drawImage(PANEL, 0, 0);
  };

  A.preview = function (def) {
    if (def._pv) return def._pv;
    const rows = def.map, h = rows.length, w = Math.max.apply(null, rows.map(function (r) { return r.length; })), S = 6;
    const c = mk(w * S, h * S), g = c.getContext('2d');
    g.drawImage(A.background(def.theme), 0, 0, 960, 600, 0, 0, w * S, h * S);
    const col = { '#': '#6f85ab', r: '#b0a890', g: '#5a9a34', G: '#e0a514' };
    for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
      const k = col[rows[y][x]]; if (k) { g.fillStyle = k; g.fillRect(x * S, y * S, S, S); }
    }
    return def._pv = c;
  };
})();
