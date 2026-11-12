/* ===== VK SDK (VK Bridge): реклама, облачное хранилище, рейтинг, приглашения =====
 * Тот же интерфейс, что и у js/yandex.js — остальной код игры не меняется.
 * Вне ВКонтакте (нет параметров запуска vk_app_id/sign) работает тестовый режим.
 */
(function (G) {
  'use strict';

  const INTERSTITIAL_GAP = 150 * 1000;
  const FIRST_AD_DELAY = 60 * 1000;
  const MIN_LEVEL_FOR_ADS = 4;

  const params = new URLSearchParams(location.search);
  const IN_VK = params.has('vk_app_id') && params.has('sign');
  const bridge = () => window.vkBridge;

  const SDK = {
    platform: 'vk',
    mock: true,
    lang: (params.get('vk_language') || navigator.language || 'ru').slice(0, 2),
    player: null,
    payments: null,
    catalog: [],
    lastAd: 0,
    startTime: Date.now(),
    playing: false,
    adOpen: false,

    async init() {
      if (!IN_VK || !bridge()) {
        console.info('[VK] запуск вне ВКонтакте — тестовый режим');
        return;
      }
      try {
        await bridge().send('VKWebAppInit', {});
        this.mock = false;
      } catch (e) {
        console.warn('[VK] VKWebAppInit failed', e);
        return;
      }
      // Пользователь свернул/развернул приложение VK
      bridge().subscribe((event) => {
        const type = event && event.detail && event.detail.type;
        if (type === 'VKWebAppViewHide') {
          G.Sound.pauseAll();
          G.Save && G.Save.flush();
        } else if (type === 'VKWebAppViewRestore' && !this.adOpen) {
          G.Sound.resumeAll();
        }
      });
      this.preloadAds();
    },

    // Подгрузка рекламы заранее — так она показывается без задержки
    async preloadAds() {
      if (this.mock) return;
      for (const f of ['interstitial', 'reward']) {
        try { await bridge().send('VKWebAppCheckNativeAds', { ad_format: f }); } catch (e) { }
      }
    },

    /* ---------- Игрок ---------- */
    isAuthorized() { return !this.mock; },   // во ВКонтакте игрок всегда авторизован
    async auth() { return !this.mock; },

    /* ---------- Жизненный цикл (во VK отдельных методов нет) ---------- */
    ready() { },
    gameplayStart() { this.playing = true; },
    gameplayStop() { this.playing = false; },

    /* ---------- Реклама ---------- */
    canInterstitial() {
      if (G.Save.data.noads) return false;
      const now = Date.now();
      return now - this.startTime >= FIRST_AD_DELAY &&
        now - this.lastAd >= INTERSTITIAL_GAP &&
        G.Save.data.level >= MIN_LEVEL_FOR_ADS;
    },

    maybeInterstitial(done) {
      if (!this.canInterstitial()) { done && done(); return; }
      this.showInterstitial(done);
    },

    _adBegin() {
      this.gameplayStop();
      this.adOpen = true;
      G.Sound.pauseAll();
    },

    _adEnd() {
      this.adOpen = false;
      G.Sound.resumeAll();
    },

    showInterstitial(done) {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        this._adEnd();
        this.preloadAds();
        done && done();
      };
      this.lastAd = Date.now();
      this._adBegin();
      if (this.mock) { G.UI.mockAd(false, finish); return; }
      bridge().send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
        .then(finish)
        .catch(finish);
    },

    showRewarded(onReward, onFail) {
      let rewarded = false;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        this._adEnd();
        this.lastAd = Math.max(this.lastAd, Date.now() - INTERSTITIAL_GAP + 60000);
        this.preloadAds();
        if (rewarded) onReward && onReward();
        else onFail && onFail();
      };
      this._adBegin();
      if (this.mock) { G.UI.mockAd(true, () => { rewarded = true; finish(); }); return; }
      bridge().send('VKWebAppShowNativeAds', { ad_format: 'reward' })
        .then((data) => { rewarded = !!(data && data.result); finish(); })
        .catch(() => finish());
    },

    hideBanner() { },

    /* ---------- Облачные сохранения (VK Storage) ---------- */
    async getData() {
      if (this.mock) return null;
      try {
        const r = await bridge().send('VKWebAppStorageGet', { keys: ['save'] });
        const item = r && r.keys && r.keys.find((k) => k.key === 'save');
        return item && item.value ? JSON.parse(item.value) : null;
      } catch (e) {
        return null;
      }
    },

    async setData(save) {
      if (this.mock) return;
      try {
        await bridge().send('VKWebAppStorageSet', { key: 'save', value: JSON.stringify(save) });
      } catch (e) { }
    },

    /* ---------- Рейтинг: нативное окно VK со списком друзей ---------- */
    async setScore() { /* результат передаётся при открытии окна рейтинга */ },
    async getLeaderboard() { return null; },

    async openNativeLeaderboard() {
      if (this.mock) { G.UI.toast(G.t('lb_unavailable_vk')); return; }
      try {
        await bridge().send('VKWebAppShowLeaderBoardBox', { user_result: Math.max(0, G.Save.data.level - 1) });
      } catch (e) {
        G.UI.toast(G.t('lb_unavailable_vk'));
      }
    },

    /* ---------- Приглашение друзей ---------- */
    async invite() {
      if (this.mock) { G.UI.toast(G.t('lb_unavailable_vk')); return; }
      try { await bridge().send('VKWebAppShowInviteBox', {}); } catch (e) { }
    },

    /* ---------- Покупки (голоса VK требуют сервер — пока выключены) ---------- */
    hasProduct() { return false; },
    price() { return ''; },
    async purchase() { return null; },
    async consume() { },
    async getPurchases() { return []; }
  };

  G.SDK = SDK;
})(window.Game = window.Game || {});
