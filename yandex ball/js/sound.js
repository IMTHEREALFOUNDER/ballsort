/* ===== SOUND: синтез звуков через WebAudio (без файлов, 0 КБ ассетов) ===== */
(function (G) {
  'use strict';

  const Sound = {
    ctx: null,
    master: null,
    enabled: true,
    hidden: false,
    paused: false,   // пауза на время рекламы / паузы платформы

    init() {
      document.addEventListener('visibilitychange', () => {
        this.hidden = document.hidden;
        if (this.hidden) this.suspend(); else this.resumeAll();
      });
    },

    // Браузеры разрешают звук только после жеста пользователя
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended' && this.canPlay()) this.ctx.resume();
    },

    canPlay() {
      return this.enabled && !this.hidden && !this.paused;
    },

    suspend() {
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    },

    pauseAll() { this.paused = true; this.suspend(); },

    resumeAll() {
      this.paused = false;
      if (this.ctx && this.canPlay()) this.ctx.resume();
    },

    setEnabled(v) {
      this.enabled = !!v;
      if (!this.enabled) this.suspend(); else this.resumeAll();
    },

    tone(freq, dur, type, vol, slide, delay) {
      if (!this.ctx || !this.canPlay()) return;
      const t = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.03);
    },

    play(name) {
      switch (name) {
        case 'tap':
          this.tone(660, 0.08, 'triangle', 0.18);
          break;
        case 'pop':
          this.tone(380 + Math.random() * 140, 0.1, 'sine', 0.25, 260);
          break;
        case 'error':
          this.tone(190, 0.16, 'square', 0.08, -70);
          break;
        case 'complete':
          [523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.2, 0, i * 0.07));
          break;
        case 'win':
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.22, 0, i * 0.11));
          break;
        case 'coin':
          this.tone(988, 0.08, 'square', 0.1);
          this.tone(1319, 0.14, 'square', 0.1, 0, 0.07);
          break;
      }
    }
  };

  G.Sound = Sound;
})(window.Game = window.Game || {});
