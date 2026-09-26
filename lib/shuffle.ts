// A public gallery that always lists projects in the same order (e.g. by
// submission time) gives an unfair visibility advantage to whoever
// submitted first or has a database id that happens to sort early. This
// implements a seeded shuffle so ordering is randomized but *stable for
// a given viewer* — the same person reloading the page, or turning to
// page 2, sees a consistent order rather than items jumping around.

/**
 * A small, fast, deterministic PRNG (mulberry32). Not cryptographically
 * secure — it doesn't need to be, since this is for display ordering, not
 * anything security-sensitive. Deterministic output for a given seed is
 * exactly the property we want.
 */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns an arbitrary string seed (e.g. a user id or session id) into a 32-bit int. */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Returns a new array, shuffled deterministically based on `seed`. Same
 * seed + same input order always produces the same output order — that's
 * what makes it stable per-viewer rather than re-randomizing on every
 * request.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(hashSeed(seed));
  const result = [...items];

  // Fisher-Yates, driven by the seeded RNG instead of Math.random().
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
