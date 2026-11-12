/* ===== CORE: состояние игры, правила, отрисовка, ввод, анимации ===== */
(function (G) {
  'use strict';

  const L = () => G.Levels;

  // 12 хорошо различимых цветов
  const PALETTE = [
    '#ff4d4d', '#3d8bff', '#33cc66', '#ffd23f', '#b05cff', '#ff8c1a',
    '#22d3ee', '#ff5fb7', '#a0522d', '#a3e635', '#f1f5f9', '#8a94a6'
  ];

  const MOVE_DUR = 330;     // мс на перелёт одного шарика
  const MOVE_STAGGER = 70;  // задержка между шариками одной серии

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(h, k) {
    const c = hexToRgb(h).map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
    return 'rgb(' + c.join(',') + ')';
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const Core = {
    canvas: null, ctx: null, dpr: 1, W: 0, H: 0,
    state: null,
    layout: [], d: 40,
    selected: -1,
    anims: [], pendingIn: [], afterAnims: [],
    particles: [],
    highlight: null,
    shake: null,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
      const loop = (now) => {
        this.update(now);
        this.draw(now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.canvas.width = Math.round(this.W * this.dpr);
      this.canvas.height = Math.round(this.H * this.dpr);
      this.canvas.style.width = this.W + 'px';
      this.canvas.style.height = this.H + 'px';
      this.layoutCalc();
    },

    /* ---------- Уровень ---------- */
    startLevel(n) {
      const lv = L().generate(n);
      this.state = {
        level: n,
        tubes: lv.tubes,
        cap: lv.cap,
        colors: lv.colors,
        history: [],
        moves: 0,
        undoLeft: 3,
        extraUsed: false,
        won: false
      };
      this.selected = -1;
      this.anims = [];
      this.afterAnims = [];
      this.pendingIn = [];
      this.particles = [];
      this.highlight = null;
      this.layoutCalc();
      G.UI.onLevelStart(n);
      G.SDK.gameplayStart();
    },

    restart() {
      if (!this.state) return;
      this.startLevel(this.state.level);
    },

    /* ---------- Раскладка колб под любой экран ---------- */
    layoutCalc() {
      if (!this.state) return;
      const n = this.state.tubes.length;
      const cap = this.state.cap;
      const hud = document.getElementById('hud');
      const bar = document.getElementById('toolbar');
      const top = (hud ? hud.offsetHeight : 60) + 34;
      const bottom = (bar ? bar.offsetHeight : 84) + 10;
      const aw = this.W - 20;
      const ah = Math.max(120, this.H - top - bottom);

      let best = null;
      for (let rows = 1; rows <= 3; rows++) {
        const per = Math.ceil(n / rows);
        if ((rows - 1) * per >= n) continue;
        const d = Math.min(aw / (per * 1.56), ah / (rows * (cap + 2.1)), 62);
        if (!best || d > best.d + 0.5) best = { rows: rows, per: per, d: d };
      }
      const d = best.d;
      const tw = d * 1.24;
      const th = cap * d + d * 0.42;
      const gap = d * 0.32;
      const rowH = th + d * 1.68;
      const y0 = top + (ah - best.rows * rowH) / 2 + d * 1.35;

      const layout = [];
      for (let r = 0; r < best.rows; r++) {
        const start = r * best.per;
        const cnt = Math.min(best.per, n - start);
        if (cnt <= 0) break;
        const rowW = cnt * tw + (cnt - 1) * gap;
        const x0 = (this.W - rowW) / 2;
        const y = y0 + r * rowH;
        for (let i = 0; i < cnt; i++) layout.push({ x: x0 + i * (tw + gap), y: y, w: tw, h: th, gap: gap });
      }
      this.layout = layout;
      this.d = d;
    },

    ballPos(i, k) {
      const t = this.layout[i];
      if (!t) return { x: 0, y: 0 };
      return { x: t.x + t.w / 2, y: t.y + t.h - this.d * 0.21 - this.d / 2 - k * this.d };
    },

    liftPos(i) {
      const t = this.layout[i];
      if (!t) return { x: 0, y: 0 };
      return { x: t.x + t.w / 2, y: t.y - this.d * 0.72 };
    },

    hitTube(x, y) {
      for (let i = 0; i < this.layout.length; i++) {
        const t = this.layout[i];
        if (x >= t.x - t.gap / 2 && x <= t.x + t.w + t.gap / 2 &&
            y >= t.y - this.d * 1.3 && y <= t.y + t.h + this.d * 0.35) return i;
      }
      return -1;
    },

    /* ---------- Ввод ---------- */
    onPointer(e) {
      G.Sound.unlock();
      const s = this.state;
      if (!s || s.won || this.anims.length || G.UI.isModalOpen()) return;
      const i = this.hitTube(e.clientX, e.clientY);
      if (i < 0) { this.selected = -1; return; }
      G.UI.hideTipOnAction();

      if (this.selected < 0) {
        if (s.tubes[i].length && !L().isFullUniform(s.tubes[i], s.cap)) {
          this.selected = i;
          G.Sound.play('tap');
        } else {
          this.shakeTube(i);
        }
        return;
      }
      if (i === this.selected) {
        this.selected = -1;
        G.Sound.play('tap');
        return;
      }
      if (L().canMove(s.tubes, s.cap, this.selected, i)) {
        this.doMove(this.selected, i);
      } else if (s.tubes[i].length && !L().isFullUniform(s.tubes[i], s.cap)) {
        this.selected = i;   // переключаем выбор на другую колбу
        G.Sound.play('tap');
      } else {
        this.shakeTube(i);
      }
    },

    shakeTube(i) {
      this.shake = { i: i, until: performance.now() + 300 };
      G.Sound.play('error');
    },

    /* ---------- Ходы ---------- */
    doMove(a, b) {
      const s = this.state;
      const n = L().moveCount(s.tubes, s.cap, a, b);
      const src = s.tubes[a];
      const dst = s.tubes[b];
      const srcLen = src.length;
      const dstLen = dst.length;
      const now = performance.now();
      const wasSelected = this.selected === a;

      for (let j = 0; j < n; j++) {
        const color = src.pop();
        dst.push(color);
        this.anims.push({
          color: color,
          from: a, fromSlot: srcLen - 1 - j, fromLift: wasSelected && j === 0,
          to: b, toSlot: dstLen + j,
          start: now + j * MOVE_STAGGER, dur: MOVE_DUR
        });
      }
      this.pendingIn[b] = (this.pendingIn[b] || 0) + n;
      s.history.push({ from: a, to: b, n: n });
      s.moves++;
      this.selected = -1;
      this.highlight = null;

      if (L().isFullUniform(dst, s.cap)) {
        this.afterAnims.push(() => {
          this.burst(b, PALETTE[dst[0]], 22);
          G.Sound.play('complete');
        });
      }
      if (L().isSolved(s.tubes, s.cap)) {
        s.won = true;
        this.afterAnims.push(() => this.onWin());
      } else {
        this.afterAnims.push(() => {
          if (!this.hasUsefulMove()) G.UI.toast(G.t('no_moves'));
        });
      }
    },

    hasUsefulMove() {
      const s = this.state;
      for (let a = 0; a < s.tubes.length; a++) {
        const src = s.tubes[a];
        if (!src.length || L().isFullUniform(src, s.cap)) continue;
        const uniform = L().topRun(src) === src.length;
        for (let b = 0; b < s.tubes.length; b++) {
          if (!L().canMove(s.tubes, s.cap, a, b)) continue;
          if (uniform && s.tubes[b].length === 0) continue;
          return true;
        }
      }
      return false;
    },

    undo() {
      const s = this.state;
      if (!s || s.won || this.anims.length) return 'busy';
      const h = s.history.pop();
      if (!h) return 'empty';
      for (let j = 0; j < h.n; j++) s.tubes[h.from].push(s.tubes[h.to].pop());
      s.moves = Math.max(0, s.moves - 1);
      this.selected = -1;
      this.highlight = null;
      G.Sound.play('pop');
      return 'ok';
    },

    addTube() {
      const s = this.state;
      if (!s || s.extraUsed) return false;
      s.tubes.push([]);
      s.extraUsed = true;
      this.layoutCalc();
      G.Sound.play('complete');
      return true;
    },

    // Возвращает следующий ход решения [from, to] или null
    findHint() {
      const s = this.state;
      if (!s || s.won) return null;
      const sol = L().solve(s.tubes, s.cap, 120000);
      return sol && sol.length ? sol[0] : null;
    },

    showHint(move) {
      this.selected = -1;
      this.highlight = { a: move[0], b: move[1], until: performance.now() + 3000 };
    },

    onWin() {
      this.selected = -1;
      this.confetti();
      G.Sound.play('win');
      G.SDK.gameplayStop();
      setTimeout(() => G.UI.onWin(this.state.level, this.state.moves), 700);
    },

    /* ---------- Частицы ---------- */
    burst(i, color, count) {
      const p = this.liftPos(i);
      for (let k = 0; k < count; k++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 120 + Math.random() * 220;
        this.particles.push({
          x: p.x, y: p.y + this.d * 0.6,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 200,
          life: 0.9, max: 0.9, color: color, size: 3 + Math.random() * 4
        });
      }
    },

    confetti() {
      for (let k = 0; k < 110; k++) {
        this.particles.push({
          x: Math.random() * this.W, y: -20 - Math.random() * this.H * 0.3,
          vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 200,
          life: 2.6, max: 2.6, color: PALETTE[k % PALETTE.length],
          size: 4 + Math.random() * 5, rect: true, rot: Math.random() * 6
        });
      }
    },

    /* ---------- Обновление ---------- */
    update(now) {
      const dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0.016;
      this._last = now;

      if (this.anims.length) {
        const keep = [];
        for (const a of this.anims) {
          if (now >= a.start + a.dur) {
            this.pendingIn[a.to] = Math.max(0, (this.pendingIn[a.to] || 0) - 1);
            G.Sound.play('pop');
          } else keep.push(a);
        }
        this.anims = keep;
        if (!this.anims.length && this.afterAnims.length) {
          const cbs = this.afterAnims;
          this.afterAnims = [];
          cbs.forEach((f) => f());
        }
      }

      if (this.particles.length) {
        for (const p of this.particles) {
          p.life -= dt;
          p.vy += (p.rect ? 60 : 650) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.rect) p.rot += dt * 6;
        }
        this.particles = this.particles.filter((p) => p.life > 0 && p.y < this.H + 40);
      }
    },

    animPos(a, now) {
      const u = Math.max(0, Math.min(1, (now - a.start) / a.dur));
      const p0 = a.fromLift ? this.liftPos(a.from) : this.ballPos(a.from, a.fromSlot);
      const p1 = this.liftPos(a.from);
      const p2 = this.liftPos(a.to);
      const p3 = this.ballPos(a.to, a.toSlot);
      if (u < 0.25) {
        const v = easeOut(u / 0.25);
        return { x: lerp(p0.x, p1.x, v), y: lerp(p0.y, p1.y, v) };
      }
      if (u < 0.6) {
        const v = easeInOut((u - 0.25) / 0.35);
        return { x: lerp(p1.x, p2.x, v), y: lerp(p1.y, p2.y, v) - Math.sin(Math.PI * v) * this.d * 0.5 };
      }
      const v = easeIn((u - 0.6) / 0.4);
      return { x: lerp(p2.x, p3.x, v), y: lerp(p2.y, p3.y, v) };
    },

    /* ---------- Отрисовка ---------- */
    draw(now) {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      const s = this.state;
      if (!s) return;

      for (let i = 0; i < s.tubes.length; i++) {
        const t = this.layout[i];
        if (!t) continue;
        const tube = s.tubes[i];
        const pending = this.pendingIn[i] || 0;
        const visible = tube.length - pending;
        const hl = this.highlight && now < this.highlight.until &&
          (this.highlight.a === i || this.highlight.b === i);
        const complete = pending === 0 && L().isFullUniform(tube, s.cap);
        let dx = 0;
        if (this.shake && this.shake.i === i && now < this.shake.until) {
          dx = Math.sin(now / 22) * 5;
        }
        this.drawTube(t, dx, i === this.selected, hl, complete, now);

        for (let k = 0; k < visible; k++) {
          let p = this.ballPos(i, k);
          if (i === this.selected && k === visible - 1) {
            p = this.liftPos(i);
            p.y += Math.sin(now / 170) * 3;
          }
          this.drawBall(p.x + dx, p.y, tube[k]);
        }
      }

      for (const a of this.anims) {
        const p = this.animPos(a, now);
        this.drawBall(p.x, p.y, a.color);
      }

      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        if (p.rect) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },

    tubePath(x, y, w, h) {
      const ctx = this.ctx;
      const r = w / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h - r);
      ctx.arc(x + r, y + h - r, r, Math.PI, 0, true);
      ctx.lineTo(x + w, y);
    },

    drawTube(t, dx, selected, highlighted, complete, now) {
      const ctx = this.ctx;
      const x = t.x + dx;
      ctx.save();
      this.tubePath(x, t.y, t.w, t.h);
      ctx.fillStyle = complete ? 'rgba(120,255,170,0.13)' : 'rgba(255,255,255,0.07)';
      ctx.fill();

      let stroke = 'rgba(255,255,255,0.55)';
      let lw = 2.5;
      if (complete) stroke = 'rgba(140,255,180,0.9)';
      if (selected) { stroke = '#ffe066'; lw = 3.5; }
      if (highlighted) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 120);
        stroke = 'rgba(124,252,154,' + (0.6 + 0.4 * pulse) + ')';
        lw = 4;
        ctx.shadowColor = '#7CFC9A';
        ctx.shadowBlur = 14 + pulse * 10;
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // блик на стекле
      ctx.beginPath();
      ctx.moveTo(x + t.w * 0.2, t.y + 8);
      ctx.lineTo(x + t.w * 0.2, t.y + t.h - t.w * 0.6);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = Math.max(2, t.w * 0.08);
      ctx.lineCap = 'round';
      ctx.stroke();

      // горлышко
      ctx.fillStyle = selected ? '#ffe066' : 'rgba(255,255,255,0.6)';
      ctx.fillRect(x - 3, t.y - 2, t.w + 6, 4);
      ctx.restore();
    },

    drawBall(x, y, c) {
      const ctx = this.ctx;
      const r = this.d * 0.43;
      const base = PALETTE[c] || '#ffffff';
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, shade(base, 0.65));
      g.addColorStop(0.35, base);
      g.addColorStop(1, shade(base, -0.4));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.stroke();
    }
  };

  G.Core = Core;
})(window.Game = window.Game || {});
