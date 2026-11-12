/* ===== LEVELS: генератор уровней и решатель =====
 * Уровень N всегда одинаковый у всех игроков (генерация по seed).
 * Каждый уровень проверяется решателем — нерешаемых уровней нет.
 */
(function (G) {
  'use strict';

  const CAP = 4;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, r) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // Кривая сложности: число цветов растёт с уровнем
  function params(level) {
    let colors;
    if (level <= 2) colors = 3;
    else if (level <= 5) colors = 4;
    else if (level <= 10) colors = 5;
    else if (level <= 18) colors = 6;
    else if (level <= 30) colors = 7;
    else if (level <= 45) colors = 8;
    else if (level <= 65) colors = 9;
    else if (level <= 90) colors = 10;
    else if (level <= 120) colors = 11;
    else colors = 12;
    return { colors: colors, empty: 2, cap: CAP };
  }

  function isFullUniform(t, cap) {
    if (t.length !== cap) return false;
    for (let i = 1; i < t.length; i++) if (t[i] !== t[0]) return false;
    return true;
  }

  function isSolved(tubes, cap) {
    for (const t of tubes) if (t.length && !isFullUniform(t, cap)) return false;
    return true;
  }

  function topRun(t) {
    if (!t.length) return 0;
    const c = t[t.length - 1];
    let n = 0;
    for (let i = t.length - 1; i >= 0 && t[i] === c; i--) n++;
    return n;
  }

  function canMove(tubes, cap, a, b) {
    if (a === b) return false;
    const s = tubes[a], d = tubes[b];
    if (!s || !d || !s.length || d.length >= cap) return false;
    if (d.length && d[d.length - 1] !== s[s.length - 1]) return false;
    return true;
  }

  // Сколько шариков реально перельётся (вся верхняя серия одного цвета, сколько влезет)
  function moveCount(tubes, cap, a, b) {
    return Math.min(topRun(tubes[a]), cap - tubes[b].length);
  }

  function keyOf(tubes) {
    const parts = tubes.map((t) => t.join(','));
    parts.sort();
    return parts.join('|');
  }

  // Поиск в глубину с запоминанием состояний. Возвращает список ходов [from, to] или null.
  function solve(start, cap, limit) {
    const tubes = start.map((t) => t.slice());
    const seen = new Set();
    const path = [];
    let nodes = 0;

    function moves() {
      const res = [];
      for (let a = 0; a < tubes.length; a++) {
        const s = tubes[a];
        if (!s.length || isFullUniform(s, cap)) continue;
        const run = topRun(s);
        const uniform = run === s.length;
        let emptyTried = false;
        for (let b = 0; b < tubes.length; b++) {
          if (a === b) continue;
          const d = tubes[b];
          if (d.length >= cap) continue;
          if (!d.length) {
            // в пустую колбу: бессмысленно для однородной колбы, и все пустые равнозначны
            if (uniform || emptyTried) continue;
            emptyTried = true;
            res.push([a, b, run, 2]);
          } else if (d[d.length - 1] === s[s.length - 1]) {
            const n = Math.min(run, cap - d.length);
            res.push([a, b, n, n === run ? 0 : 1]);
          }
        }
      }
      res.sort((x, y) => x[3] - y[3]);
      return res;
    }

    function dfs() {
      if (isSolved(tubes, cap)) return true;
      if (++nodes > limit) return false;
      const k = keyOf(tubes);
      if (seen.has(k)) return false;
      seen.add(k);
      const list = moves();
      for (let i = 0; i < list.length; i++) {
        const a = list[i][0], b = list[i][1], n = list[i][2];
        for (let j = 0; j < n; j++) tubes[b].push(tubes[a].pop());
        path.push([a, b]);
        if (dfs()) return true;
        path.pop();
        for (let j = 0; j < n; j++) tubes[a].push(tubes[b].pop());
        if (nodes > limit) return false;
      }
      return false;
    }

    return dfs() ? path : null;
  }

  function deal(p, r) {
    const balls = [];
    for (let c = 0; c < p.colors; c++) for (let k = 0; k < p.cap; k++) balls.push(c);
    shuffle(balls, r);
    const tubes = [];
    for (let i = 0; i < p.colors; i++) tubes.push(balls.slice(i * p.cap, (i + 1) * p.cap));
    for (let e = 0; e < p.empty; e++) tubes.push([]);
    return tubes;
  }

  function tooEasy(tubes, cap, level) {
    let runs = 0;
    for (const t of tubes) {
      if (isFullUniform(t, cap)) return true;
      if (t.length && topRun(t) >= 3) runs++;
    }
    return level > 3 && runs > 0;
  }

  const cache = {};

  function generate(level) {
    if (cache[level]) return clone(cache[level]);
    const p = params(level);
    // Перемешиваем цвета, чтобы разные уровни выглядели по-разному
    const colorRnd = rng(level * 31337 + 7);
    const colorMap = shuffle(Array.from({ length: 12 }, (_, i) => i), colorRnd);

    let result = null;
    for (let attempt = 0; attempt < 60 && !result; attempt++) {
      const r = rng(level * 9973 + attempt * 7919 + 17);
      const tubes = deal(p, r);
      if (isSolved(tubes, p.cap) || tooEasy(tubes, p.cap, level)) continue;
      if (solve(tubes, p.cap, 60000)) result = { tubes: tubes, cap: p.cap, colors: p.colors };
    }
    if (!result) {
      // Запасной вариант: три пустые колбы — решается практически всегда
      const p3 = { colors: p.colors, empty: 3, cap: p.cap };
      for (let attempt = 0; attempt < 200 && !result; attempt++) {
        const tubes = deal(p3, rng(level * 4243 + attempt * 131 + 5));
        if (!isSolved(tubes, p3.cap) && solve(tubes, p3.cap, 200000)) result = { tubes: tubes, cap: p3.cap, colors: p3.colors };
      }
    }
    if (!result) {
      // Совсем крайний случай: собранный уровень с одной перемешанной парой
      const tubes = [];
      for (let c = 0; c < p.colors; c++) tubes.push(new Array(p.cap).fill(c));
      tubes.push([], []);
      result = { tubes: tubes, cap: p.cap, colors: p.colors };
    }
    result.tubes = result.tubes.map((t) => t.map((c) => colorMap[c]));
    cache[level] = result;
    return clone(result);
  }

  function clone(lv) {
    return { tubes: lv.tubes.map((t) => t.slice()), cap: lv.cap, colors: lv.colors };
  }

  G.Levels = {
    generate: generate,
    solve: solve,
    canMove: canMove,
    moveCount: moveCount,
    topRun: topRun,
    isSolved: isSolved,
    isFullUniform: isFullUniform,
    params: params
  };
})(window.Game = window.Game || {});
