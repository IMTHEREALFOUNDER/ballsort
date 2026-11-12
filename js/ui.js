/* ===== UI: HUD, кнопки, окна, магазин, рейтинг, ежедневная награда ===== */
(function (G) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const t = (k, v) => G.t(k, v);

  const HINT_COST = 50;
  const TUBE_COST = 100;
  const UNDO_COST = 30;
  const UNDO_PACK = 5;

  const BGS = [
    { id: 'default', price: 0, css: 'radial-gradient(circle at 50% 18%, #3b2a6e 0%, #1a1238 60%, #0e0a22 100%)' },
    { id: 'ocean', price: 300, css: 'linear-gradient(180deg, #0f5c8a 0%, #0b3954 50%, #08202f 100%)' },
    { id: 'sunset', price: 600, css: 'linear-gradient(180deg, #ff7e5f 0%, #7b2d5b 55%, #2b1035 100%)' },
    { id: 'forest', price: 900, css: 'linear-gradient(180deg, #2d6a4f 0%, #1b4332 50%, #081c15 100%)' },
    { id: 'gold', price: 1500, css: 'radial-gradient(circle at 50% 10%, #6b5420 0%, #2a210c 60%, #140f05 100%)' }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function todayStr(offsetDays) {
    const d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  const UI = {
    modalOpen: false,
    handlers: {},
    tipShown: false,

    init() {
      G.I18N.apply();
      $('btnMenu').onclick = () => this.openMenu();
      $('btnRestart').onclick = () => { G.Sound.unlock(); G.Sound.play('tap'); G.Core.restart(); };
      $('btnUndo').onclick = () => this.onUndo();
      $('btnHint').onclick = () => this.onHint();
      $('btnTube').onclick = () => this.onTube();
      $('modalCard').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        G.Sound.unlock();
        const act = b.dataset.act;
        const h = this.handlers[act] || this.handlers[act.split(':')[0]];
        if (h) h(act.split(':')[1], b);
      });
      // Защита от случайных жестов браузера
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('dblclick', (e) => e.preventDefault());
      this.applyBg();
      this.updateHud();
    },

    /* ---------- HUD ---------- */
    updateHud(bump) {
      const s = G.Core.state;
      if (s) $('levelLabel').textContent = t('level', { n: s.level });
      $('coinsVal').textContent = G.Save.data.coins;
      if (bump) {
        const c = $('coins');
        c.classList.remove('bump');
        void c.offsetWidth;
        c.classList.add('bump');
        G.Sound.play('coin');
      }
      if (s) {
        $('undoBadge').textContent = s.undoLeft > 0 ? s.undoLeft : '▶';
        $('undoBadge').classList.toggle('ad-badge', s.undoLeft <= 0);
        $('btnTube').disabled = s.extraUsed;
      }
    },

    onLevelStart(n) {
      this.updateHud();
      const tip = $('tip');
      if (n <= 2) {
        tip.textContent = t(n === 1 ? 'tip1' : 'tip2');
        tip.classList.remove('hidden');
        this.tipShown = true;
      } else {
        tip.classList.add('hidden');
        this.tipShown = false;
      }
    },

    hideTipOnAction() {
      // на 1-м уровне подсказку оставляем до первого хода
      if (this.tipShown && G.Core.state && G.Core.state.moves > 0) {
        $('tip').classList.add('hidden');
        this.tipShown = false;
      }
    },

    toast(msg) {
      const el = $('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => el.classList.remove('show'), 2400);
    },

    /* ---------- Окна ---------- */
    isModalOpen() { return this.modalOpen; },

    openModal(html, handlers) {
      $('modalCard').innerHTML = html;
      this.handlers = Object.assign({ close: () => this.closeModal() }, handlers || {});
      $('modal').classList.remove('hidden');
      this.modalOpen = true;
      G.SDK.gameplayStop();
    },

    closeModal() {
      $('modal').classList.add('hidden');
      this.modalOpen = false;
      this.handlers = {};
      const s = G.Core.state;
      if (s && !s.won) G.SDK.gameplayStart();
    },

    coinsHtml(n) {
      return '<span class="coin-ico"></span>' + n;
    },

    // Универсальное окно «за рекламу или за монеты»
    offer(opts) {
      const enough = G.Save.data.coins >= opts.cost;
      this.openModal(
        '<h2>' + opts.title + '</h2><p>' + opts.text + '</p>' +
        '<button class="btn ad" data-act="ad">' + t('watch_ad') + '</button>' +
        '<button class="btn" data-act="coins"' + (enough ? '' : ' disabled') + '>' +
        t('for_coins', { n: opts.cost }) + '</button>' +
        '<button class="btn" data-act="close">' + t('close') + '</button>',
        {
          ad: () => {
            this.closeModal();
            G.SDK.showRewarded(() => opts.onGet(), () => this.toast(t('ad_fail')));
          },
          coins: () => {
            if (G.Save.spendCoins(opts.cost)) { this.closeModal(); opts.onGet(); }
            else this.toast(t('not_enough'));
          }
        }
      );
    },

    /* ---------- Кнопки инструментов ---------- */
    onUndo() {
      G.Sound.unlock();
      const s = G.Core.state;
      if (!s || s.won || G.Core.anims.length) return;
      if (s.undoLeft > 0) {
        const r = G.Core.undo();
        if (r === 'ok') { s.undoLeft--; this.updateHud(); }
        else if (r === 'empty') this.toast(t('nothing_undo'));
        return;
      }
      if (!s.history.length) { this.toast(t('nothing_undo')); return; }
      this.offer({
        title: t('undo_title'), text: t('undo_text'), cost: UNDO_COST,
        onGet: () => { s.undoLeft += UNDO_PACK; this.updateHud(); }
      });
    },

    onHint() {
      G.Sound.unlock();
      const s = G.Core.state;
      if (!s || s.won || G.Core.anims.length) return;
      // Сначала проверяем, есть ли решение — не берём плату за пустую подсказку
      const move = G.Core.findHint();
      if (!move) { this.toast(t('hint_none')); return; }
      this.offer({
        title: t('hint_title'), text: t('hint_text'), cost: HINT_COST,
        onGet: () => {
          const fresh = G.Core.findHint();
          if (fresh) G.Core.showHint(fresh); else this.toast(t('hint_none'));
        }
      });
    },

    onTube() {
      G.Sound.unlock();
      const s = G.Core.state;
      if (!s || s.won) return;
      if (s.extraUsed) { this.toast(t('tube_used')); return; }
      this.offer({
        title: t('tube_title'), text: t('tube_text'), cost: TUBE_COST,
        onGet: () => { G.Core.addTube(); this.updateHud(); }
      });
    },

    /* ---------- Победа ---------- */
    onWin(level, moves) {
      const reward = 10 + Math.floor(level / 5) * 2;
      G.Save.data.level = level + 1;
      G.Save.addCoins(reward);
      G.SDK.setScore(level);

      this.openModal(
        '<h2>' + t('win_title', { n: level }) + '</h2>' +
        '<p>' + t('moves', { n: moves }) + '</p>' +
        '<div class="reward">+' + this.coinsHtml(reward) + '</div>' +
        '<button class="btn ad" data-act="double">' + t('double') + '</button>' +
        '<button class="btn primary" data-act="next">' + t('next') + '</button>',
        {
          double: (_, btn) => {
            btn.disabled = true;
            G.SDK.showRewarded(
              () => { G.Save.addCoins(reward); this.toast(t('coins_got', { n: reward })); },
              () => { btn.disabled = false; this.toast(t('ad_fail')); }
            );
          },
          next: () => {
            this.closeModal();
            G.SDK.maybeInterstitial(() => G.Core.startLevel(G.Save.data.level));
          }
        }
      );
    },

    /* ---------- Меню ---------- */
    openMenu() {
      G.Sound.unlock();
      const d = G.Save.data;
      let html = '<h2>' + t('menu') + '</h2>' +
        '<button class="btn" data-act="sound">' + t(d.sound ? 'sound_on' : 'sound_off') + '</button>' +
        '<button class="btn" data-act="shop">' + t('shop') + '</button>' +
        '<button class="btn" data-act="lb">' + t('leaderboard') + '</button>';
      if (typeof G.SDK.invite === 'function') {
        html += '<button class="btn" data-act="invite">' + t('invite') + '</button>';
      }
      if (!d.noads && G.SDK.hasProduct('noads')) {
        html += '<button class="btn" data-act="buy:noads">' + t('noads') + ' — ' + esc(G.SDK.price('noads')) + '</button>';
      }
      if (G.SDK.hasProduct('coins_500')) {
        html += '<button class="btn" data-act="buy:coins_500">' + t('buy_coins') + ' — ' + esc(G.SDK.price('coins_500')) + '</button>';
      }
      html += '<button class="btn primary" data-act="close">' + t('close') + '</button>';

      this.openModal(html, {
        sound: (_, btn) => {
          d.sound = !d.sound;
          G.Sound.setEnabled(d.sound);
          G.Save.save();
          btn.textContent = t(d.sound ? 'sound_on' : 'sound_off');
        },
        shop: () => this.openShop(),
        lb: () => this.openLeaderboard(),
        invite: () => { this.closeModal(); G.SDK.invite(); },
        buy: (id) => this.buy(id)
      });
    },

    /* ---------- Магазин фонов ---------- */
    openShop() {
      const d = G.Save.data;
      let html = '<h2>' + t('shop') + '</h2><div class="shop">';
      for (const bg of BGS) {
        const owned = d.bgOwned.includes(bg.id);
        const active = d.bg === bg.id;
        const label = active ? t('selected') : owned ? t('owned') : this.coinsHtml(bg.price);
        html += '<button class="shop-item' + (active ? ' active' : '') + '" data-act="bg:' + bg.id + '">' +
          '<div class="swatch" style="background:' + bg.css + '"></div>' +
          '<div class="name">' + t('bg_' + bg.id) + '</div>' +
          '<div class="price">' + label + '</div></button>';
      }
      html += '</div><button class="btn primary" data-act="close">' + t('close') + '</button>';

      this.openModal(html, {
        bg: (id) => {
          const bg = BGS.find((b) => b.id === id);
          if (!bg) return;
          if (!d.bgOwned.includes(id)) {
            if (!G.Save.spendCoins(bg.price)) { this.toast(t('not_enough')); return; }
            d.bgOwned.push(id);
          }
          d.bg = id;
          G.Save.save();
          this.applyBg();
          this.openShop();
        }
      });
    },

    applyBg() {
      const bg = BGS.find((b) => b.id === G.Save.data.bg) || BGS[0];
      $('app').style.setProperty('--bg', bg.css);
    },

    /* ---------- Рейтинг ---------- */
    async openLeaderboard() {
      if (typeof G.SDK.openNativeLeaderboard === 'function') {
        // Платформа со своим окном рейтинга (ВКонтакте)
        this.closeModal();
        G.SDK.openNativeLeaderboard();
        return;
      }
      this.openModal('<h2>' + t('lb_title') + '</h2><p>' + t('lb_loading') + '</p>');
      const data = await G.SDK.getLeaderboard();
      if (!this.modalOpen) return;
      let html = '<h2>' + t('lb_title') + '</h2>';
      if (!data) {
        html += '<p>' + t('lb_unavailable') + '</p>';
      } else {
        if (!data.entries.length) html += '<p>' + t('lb_empty') + '</p>';
        html += '<ul class="lb">';
        for (const e of data.entries) {
          html += '<li class="' + (e.me ? 'me' : '') + '"><span class="rank">' + e.rank + '</span>' +
            '<span class="name">' + esc(e.name) + '</span><span class="score">' + e.score + '</span></li>';
        }
        html += '</ul>';
        if (data.userRank) html += '<p>' + t('lb_you', { n: data.userRank }) + '</p>';
        if (!G.SDK.isAuthorized()) html += '<button class="btn ad" data-act="login">' + t('lb_login') + '</button>';
      }
      html += '<button class="btn primary" data-act="close">' + t('close') + '</button>';
      this.openModal(html, {
        login: async () => {
          const ok = await G.SDK.auth();
          if (ok) {
            await G.Save.load();
            G.SDK.setScore(G.Save.data.level - 1);
            this.updateHud();
            this.applyBg();
            this.openLeaderboard();
          }
        }
      });
    },

    /* ---------- Покупки ---------- */
    async buy(id) {
      this.closeModal();
      const p = await G.SDK.purchase(id);
      if (!p) { this.toast(t('pay_fail')); G.SDK.gameplayStart(); return; }
      this.grant(id);
      if (id !== 'noads') await G.SDK.consume(p.purchaseToken);
      G.SDK.gameplayStart();
      this.toast(t('thanks'));
    },

    grant(id) {
      if (id === 'noads') {
        G.Save.data.noads = true;
        G.Save.save();
        G.SDK.hideBanner();
      } else if (id === 'coins_500') {
        G.Save.addCoins(500);
      }
    },

    // Восстановление покупок при запуске (если игрок закрыл игру во время оплаты)
    async restorePurchases() {
      const list = await G.SDK.getPurchases();
      for (const p of list) {
        if (p.productID === 'noads') {
          if (!G.Save.data.noads) this.grant('noads');
        } else if (p.productID === 'coins_500') {
          this.grant('coins_500');
          await G.SDK.consume(p.purchaseToken);
        }
      }
      if (G.Save.data.noads) G.SDK.hideBanner();
    },

    /* ---------- Ежедневная награда ---------- */
    checkDaily() {
      const d = G.Save.data;
      const today = todayStr(0);
      if (d.daily.last === today) return;
      if (d.level <= 1) {
        // самый первый запуск — не мешаем знакомству с игрой
        d.daily = { last: today, streak: 1 };
        G.Save.save();
        return;
      }
      const streak = d.daily.last === todayStr(-1) ? d.daily.streak + 1 : 1;
      const reward = 20 * Math.min(streak, 7);
      const claim = (mult) => {
        d.daily = { last: today, streak: streak };
        G.Save.addCoins(reward * mult);
        this.toast(t('coins_got', { n: reward * mult }));
      };
      this.openModal(
        '<h2>' + t('daily_title') + '</h2>' +
        '<p>' + t('daily_text', { n: streak }) + '</p>' +
        '<div class="reward">+' + this.coinsHtml(reward) + '</div>' +
        '<button class="btn ad" data-act="x2">' + t('claim_x2') + '</button>' +
        '<button class="btn primary" data-act="claim">' + t('claim') + '</button>',
        {
          x2: () => {
            this.closeModal();
            G.SDK.showRewarded(() => claim(2), () => { claim(1); this.toast(t('ad_fail')); });
          },
          claim: () => { this.closeModal(); claim(1); }
        }
      );
    },

    /* ---------- Имитация рекламы вне Яндекса ---------- */
    mockAd(rewarded, done) {
      const ov = $('adOverlay');
      $('adTitle').textContent = t('test_ad') + (rewarded ? ' (rewarded)' : ' (interstitial)');
      $('adNote').textContent = t('test_ad_note');
      ov.classList.remove('hidden');
      let left = 2;
      $('adTimer').textContent = left;
      const iv = setInterval(() => {
        left--;
        $('adTimer').textContent = left;
        if (left <= 0) {
          clearInterval(iv);
          ov.classList.add('hidden');
          done();
        }
      }, 1000);
    }
  };

  G.UI = UI;
})(window.Game = window.Game || {});
