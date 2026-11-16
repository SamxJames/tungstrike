function mix32(h: number): number {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

function hash2(a: number, b: number): number {
  return mix32((a ^ Math.imul(b + 1, 0x9e3779b1)) >>> 0)
}

/** Draw n of throw throwIndex for this seed. A pure function of its three integers. */
export function draw(seed: number, throwIndex: number, n: number): number {
  return hash2(hash2(seed >>> 0, throwIndex), n)
}
