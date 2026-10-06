/* Детерминированный генератор случайных чисел: по одному seed партию можно воспроизвести. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DetectiveRng = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  class Rng {
    // Числовой seed: 32 бита (тесты и симуляции). Строка из 32 hex-символов: 128 бит для живых партий,
    // чтобы по своей карте нельзя было перебором подобрать seed и узнать, кто убийца.
    constructor(seed) {
      if (typeof seed === 'string' && /^[0-9a-f]{32}$/.test(seed)) {
        this.q = [0, 8, 16, 24].map((i) => parseInt(seed.slice(i, i + 8), 16) | 0);
        for (let i = 0; i < 16; i++) this.next();
      } else this.s = (seed >>> 0) || 1;
    }
    next() {
      if (this.q) {
        // sfc32
        const q = this.q;
        const t = (((q[0] + q[1]) | 0) + q[3]) | 0;
        q[3] = (q[3] + 1) | 0;
        q[0] = q[1] ^ (q[1] >>> 9);
        q[1] = (q[2] + (q[2] << 3)) | 0;
        q[2] = ((q[2] << 21) | (q[2] >>> 11)) + t | 0;
        return (t >>> 0) / 4294967296;
      }
      this.s = (this.s + 0x6D2B79F5) >>> 0;
      let t = this.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(n) { return Math.floor(this.next() * n); }
    range(a, b) { return a + this.int(b - a + 1); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[this.int(arr.length)]; }
    shuffle(arr) {
      const r = arr.slice();
      for (let i = r.length - 1; i > 0; i--) { const j = this.int(i + 1); const t = r[i]; r[i] = r[j]; r[j] = t; }
      return r;
    }
    sample(arr, k) { return this.shuffle(arr).slice(0, k); }
  }
  /** Случайный seed на 128 бит из криптографического генератора. */
  function randomSeed() {
    const c = typeof globalThis !== 'undefined' && globalThis.crypto;
    const w = new Uint32Array(4);
    if (c && c.getRandomValues) c.getRandomValues(w);
    else for (let i = 0; i < 4; i++) w[i] = Math.floor(Math.random() * 4294967296);
    return Array.from(w, (x) => x.toString(16).padStart(8, '0')).join('');
  }
  return { Rng, randomSeed };
});
