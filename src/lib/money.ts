export function moneyForSession(total: number, count: number, index: number) {
  const base = Math.floor(total / count);
  return index === count ? total - base * (count - 1) : base;
}
