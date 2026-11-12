/* ===== I18N: тексты на русском и английском ===== */
(function (G) {
  'use strict';

  const DICT = {
    ru: {
      title: 'Сортировка шариков: Цветные колбы',
      level: 'Уровень {n}',
      restart: 'Заново', undo: 'Отмена', hint: 'Подсказка', tube: 'Колба',
      tip1: 'Нажми на колбу, а потом на другую — шарики перельются',
      tip2: 'Класть можно только на такой же цвет или в пустую колбу',
      win_title: 'Уровень {n} пройден!',
      moves: 'Ходов: {n}',
      double: '×2 монет',
      next: 'Дальше',
      watch_ad: 'Смотреть рекламу',
      for_coins: 'За {n} монет',
      not_enough: 'Не хватает монет',
      hint_title: 'Подсказка', hint_text: 'Подсвечу лучший следующий ход',
      hint_none: 'Отсюда не решить — отмени пару ходов или начни заново',
      tube_title: 'Ещё одна колба', tube_text: 'Добавить пустую колбу на этот уровень',
      tube_used: 'Дополнительная колба уже добавлена',
      undo_title: 'Отмены закончились', undo_text: 'Получи ещё 5 отмен',
      nothing_undo: 'Нечего отменять',
      no_moves: 'Ходов нет — отмени ход или добавь колбу',
      menu: 'Меню', sound_on: 'Звук: вкл', sound_off: 'Звук: выкл',
      shop: 'Фоны', leaderboard: 'Рейтинг', noads: 'Отключить рекламу', buy_coins: '500 монет', close: 'Закрыть',
      daily_title: 'Ежедневная награда',
      daily_text: 'День {n} подряд! Заходи каждый день — награда растёт',
      claim: 'Забрать', claim_x2: 'Забрать ×2',
      ad_fail: 'Реклама сейчас недоступна, попробуй позже',
      thanks: 'Спасибо за покупку!', pay_fail: 'Покупка не завершена',
      lb_title: 'Рейтинг игроков', lb_loading: 'Загрузка…',
      lb_unavailable: 'Рейтинг доступен в Яндекс Играх',
      lb_login: 'Войти, чтобы попасть в рейтинг',
      lb_you: 'Твоё место: {n}', lb_empty: 'Пока пусто — будь первым!',
      owned: 'Куплен', selected: 'Выбран',
      coins_got: '+{n} монет',
      test_ad: 'Тестовая реклама', test_ad_note: 'Вне Яндекс Игр реклама только имитируется',
      bg_default: 'Ночь', bg_ocean: 'Океан', bg_sunset: 'Закат', bg_forest: 'Лес', bg_gold: 'Золото',
      noads_done: 'Реклама отключена',
      invite: 'Пригласить друзей',
      lb_unavailable_vk: 'Доступно в игре ВКонтакте'
    },
    en: {
      title: 'Ball Sort: Color Tubes',
      level: 'Level {n}',
      restart: 'Restart', undo: 'Undo', hint: 'Hint', tube: 'Tube',
      tip1: 'Tap a tube, then another one to pour the balls',
      tip2: 'You can only pour onto the same color or into an empty tube',
      win_title: 'Level {n} complete!',
      moves: 'Moves: {n}',
      double: '×2 coins',
      next: 'Next',
      watch_ad: 'Watch ad',
      for_coins: 'For {n} coins',
      not_enough: 'Not enough coins',
      hint_title: 'Hint', hint_text: 'I will highlight the best next move',
      hint_none: 'No solution from here — undo a few moves or restart',
      tube_title: 'Extra tube', tube_text: 'Add an empty tube to this level',
      tube_used: 'Extra tube is already added',
      undo_title: 'No undos left', undo_text: 'Get 5 more undos',
      nothing_undo: 'Nothing to undo',
      no_moves: 'No moves — undo or add a tube',
      menu: 'Menu', sound_on: 'Sound: on', sound_off: 'Sound: off',
      shop: 'Backgrounds', leaderboard: 'Leaderboard', noads: 'Remove ads', buy_coins: '500 coins', close: 'Close',
      daily_title: 'Daily reward',
      daily_text: 'Day {n} in a row! Come back daily — the reward grows',
      claim: 'Claim', claim_x2: 'Claim ×2',
      ad_fail: 'Ad is not available now, try later',
      thanks: 'Thank you for your purchase!', pay_fail: 'Purchase not completed',
      lb_title: 'Leaderboard', lb_loading: 'Loading…',
      lb_unavailable: 'Leaderboard is available on Yandex Games',
      lb_login: 'Log in to join the leaderboard',
      lb_you: 'Your rank: {n}', lb_empty: 'Empty so far — be the first!',
      owned: 'Owned', selected: 'Selected',
      coins_got: '+{n} coins',
      test_ad: 'Test ad', test_ad_note: 'Outside Yandex Games ads are only simulated',
      bg_default: 'Night', bg_ocean: 'Ocean', bg_sunset: 'Sunset', bg_forest: 'Forest', bg_gold: 'Gold',
      noads_done: 'Ads removed',
      invite: 'Invite friends',
      lb_unavailable_vk: 'Available inside VK'
    }
  };

  const RU_LIKE = ['ru', 'be', 'kk', 'uk', 'uz', 'tr_ru'];

  const I18N = {
    lang: 'ru',
    setLang(code) {
      const c = String(code || 'ru').toLowerCase().slice(0, 2);
      this.lang = RU_LIKE.includes(c) ? 'ru' : 'en';
      document.documentElement.lang = this.lang;
      document.title = this.t('title');
    },
    t(key, vars) {
      let s = (DICT[this.lang] && DICT[this.lang][key]) || DICT.ru[key] || key;
      if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
      return s;
    },
    apply(root) {
      (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = this.t(el.dataset.i18n);
      });
    }
  };

  G.I18N = I18N;
  G.t = (k, v) => I18N.t(k, v);
})(window.Game = window.Game || {});
