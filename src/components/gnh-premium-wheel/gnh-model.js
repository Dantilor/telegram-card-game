// Pure helpers shared by the browser widget and the integration checks.
export function eligibleGames(catalog, filters) {
  return catalog.filter(game => game.players[0] <= filters.players && game.players[1] >= filters.players &&
    (filters.mood === 'any' || game.moods.includes(filters.mood)) &&
    (filters.minutes === 0 || game.minutes <= filters.minutes));
}

// Rejection sampling avoids modulo bias. Every eligible game has the same chance.
export function randomIndex(length, source = globalThis.crypto) {
  if (!Number.isInteger(length) || length < 1 || length > 0x100000000) throw new RangeError('Invalid pool size');
  const value = new Uint32Array(1);
  const ceiling = Math.floor(0x100000000 / length) * length;
  do { source.getRandomValues(value); } while (value[0] >= ceiling);
  return value[0] % length;
}

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function wheelPool(eligible, selected = null, limit = 6) {
  if (!selected) return eligible.slice(0, limit);
  return shuffle([selected, ...shuffle(eligible.filter(g => g.id !== selected.id)).slice(0, limit - 1)]);
}

export function winningRotation(previous, index, count, turns = 5) {
  const target = ((-index * 360 / count) % 360 + 360) % 360;
  const current = ((previous % 360) + 360) % 360;
  return previous + turns * 360 + ((target - current + 360) % 360);
}

export function savings(shortPlan, longPlan) {
  if (!shortPlan.days || !longPlan.days || shortPlan.currency !== longPlan.currency) return 0;
  const periods = longPlan.days / shortPlan.days;
  return Number.isInteger(periods) ? Math.max(0, shortPlan.price * periods - longPlan.price) : 0;
}

export const rub = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 0}).format(value) + ' ₽';
export const pluralGames = n => n % 10 === 1 && n % 100 !== 11 ? 'игра' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'игры' : 'игр';
