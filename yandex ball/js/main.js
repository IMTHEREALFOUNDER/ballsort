/* ===== MAIN: запуск игры ===== */
(function (G) {
  'use strict';

  async function boot() {
    await G.SDK.init();                 // 1. SDK (или тестовый режим)
    G.I18N.setLang(G.SDK.lang);         // 2. язык из окружения Яндекса
    await G.Save.load();                // 3. прогресс: облако или localStorage
    G.Sound.init();
    G.Sound.setEnabled(G.Save.data.sound);
    G.UI.init();
    G.Core.init(document.getElementById('game'));
    G.Core.startLevel(G.Save.data.level);

    document.getElementById('loader').classList.add('done');
    G.SDK.ready();                      // 4. сообщаем платформе: игра загружена

    G.UI.checkDaily();
    G.UI.restorePurchases();
  }

  boot().catch((e) => {
    console.error(e);
    document.getElementById('loader').classList.add('done');
  });
})(window.Game = window.Game || {});
