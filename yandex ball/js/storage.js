/* ===== STORAGE: локальные + облачные сохранения ===== */
(function (G) {
  'use strict';

  const KEY = 'ballsort_save_v1';
  const DEFAULT = {
    v: 1,
    level: 1,          // текущий (ещё не пройденный) уровень
    coins: 0,
    sound: true,
    bg: 'default',
    bgOwned: ['default'],
    noads: false,
    daily: { last: '', streak: 0 },
    ts: 0
  };

  function merge(src) {
    const d = JSON.parse(JSON.stringify(DEFAULT));
    if (src && typeof src === 'object') {
      for (const k in DEFAULT) if (src[k] !== undefined) d[k] = src[k];
      if (!Array.isArray(d.bgOwned)) d.bgOwned = ['default'];
      if (!d.daily || typeof d.daily !== 'object') d.daily = { last: '', streak: 0 };
      d.level = Math.max(1, parseInt(d.level, 10) || 1);
      d.coins = Math.max(0, parseInt(d.coins, 10) || 0);
    }
    return d;
  }

  const Save = {
    data: merge(null),
    _cloudTimer: null,

    readLocal() {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    async load() {
      const local = this.readLocal();
      const cloud = await G.SDK.getData();
      let pick = local;
      if (cloud && (!local || (cloud.ts || 0) > (local.ts || 0))) pick = cloud;
      this.data = merge(pick);
    },

    save() {
      this.data.ts = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* приватный режим */ }
      clearTimeout(this._cloudTimer);
      this._cloudTimer = setTimeout(() => this.flush(), 1500);
    },

    flush() {
      clearTimeout(this._cloudTimer);
      G.SDK.setData(this.data);
    },

    addCoins(n) {
      this.data.coins += n;
      this.save();
      G.UI && G.UI.updateHud(true);
    },

    spendCoins(n) {
      if (this.data.coins < n) return false;
      this.data.coins -= n;
      this.save();
      G.UI && G.UI.updateHud();
      return true;
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Save.flush();
  });

  G.Save = Save;
})(window.Game = window.Game || {});
