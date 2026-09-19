// RNG déterministe à graine (mulberry32). L'état tient sur un entier 32 bits,
// ce qui le rend trivial à sérialiser dans une sauvegarde. Même graine +
// mêmes tirages => mêmes résultats. C'est la base du déterminisme du jeu.

export type Rng = {
  /** État interne 32 bits (sérialisable). */
  state: number;
  /** Prochain flottant dans [0,1). Fait avancer l'état. */
  next(): number;
};

/** Hash d'une chaîne (graine partageable "AZERTY-2027") vers un entier 32 bits. */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: string | number): Rng {
  const rng: Rng = {
    state: hashSeed(seed),
    next() {
      // mulberry32
      this.state = (this.state + 0x6d2b79f5) >>> 0;
      let t = this.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
  return rng;
}

/** Recrée un RNG depuis un état 32 bits sérialisé (reprise de partie). */
export function rngFromState(state: number): Rng {
  const rng = createRng(0);
  rng.state = state >>> 0;
  return rng;
}

/** Flottant dans [min,max). */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}

/** Entier dans [min,max] inclus. */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

/** true avec probabilité p. */
export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

/** Élément aléatoire d'un tableau. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng.next() * arr.length)];
}

/** Tirage pondéré : renvoie l'index selon les poids. -1 si somme nulle. */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return -1;
  let r = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** Mélange de Fisher-Yates déterministe (copie). */
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
