/* Детерминированный генератор случайных чисел: по одному seed партию можно воспроизвести. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DetectiveRng = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  class Rng {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
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
  return { Rng };
});
