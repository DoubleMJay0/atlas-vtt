function randomUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

/** A join code: six digits, each code as likely as any other (numbers past the last whole million are drawn again). */
export function newJoinCode(random: () => number = randomUint32): string {
  const span = 1_000_000;
  const limit = Math.floor(2 ** 32 / span) * span;
  let value = random();
  while (value >= limit) value = random();
  return String(value % span).padStart(6, '0');
}
