export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 14;

export type Phase = "lobby" | "reveal" | "night" | "discussion" | "vote" | "finished";
export type Role = "don" | "mafia" | "detective" | "doctor" | "maniac" | "citizen";
export type Team = "mafia" | "city" | "neutral";

export const ROLE_META: Record<Role, { title: string; team: Team; short: string; goal: string; color: string }> = {
  don: { title: "Дон", team: "mafia", short: "Вы возглавляете мафию и выбираете ночную жертву.", goal: "Останьтесь в большинстве. Красные метки — ваши союзники.", color: "crimson" },
  mafia: { title: "Тень мафии", team: "mafia", short: "Ночью выберите жертву вместе с Доном.", goal: "Запутайте город и доведите мафию до большинства.", color: "crimson" },
  detective: { title: "Детектив", team: "city", short: "Каждую ночь тайно проверяйте одного жителя.", goal: "Найдите мафию и убедите город, не раскрыв себя слишком рано.", color: "cyan" },
  doctor: { title: "Доктор", team: "city", short: "Каждую ночь защищайте одного живого игрока.", goal: "Сорвите покушение и помогите городу вычислить мафию.", color: "emerald" },
  maniac: { title: "Одиночка", team: "neutral", short: "Вы охотитесь в одиночку и наносите отдельный ночной удар.", goal: "Останьтесь единственным живым игроком. Пока рядом кто-то есть, победы ещё нет.", color: "violet" },
  citizen: { title: "Житель", team: "city", short: "Ночью наблюдайте, а днём анализируйте слова и голосуйте.", goal: "Найдите всех преступников, пока мафия не захватила город.", color: "blue" },
};

export const PHASE_TITLES: Record<Phase, string> = {
  lobby: "Сбор игроков",
  reveal: "Тайные роли",
  night: "Город засыпает",
  discussion: "Утро и обсуждение",
  vote: "Суд города",
  finished: "Финал",
};

export const CITY_EVENTS = {
  rain: { title: "Ливень смывает следы", text: "Слушайте не только слова — замечайте, кто слишком быстро строит версию." },
  blackout: { title: "Квартал остался без света", text: "Сегодня у каждого будет всего один шанс сформулировать главное подозрение." },
  broadcast: { title: "Перехвачен ночной сигнал", text: "Город нервничает. Сравните, кто изменил свою версию с прошлого круга." },
  sirens: { title: "Сирены всё ближе", text: "Попросите двух самых тихих игроков назвать по одному подозреваемому." },
} as const;

export type CityEventKey = keyof typeof CITY_EVENTS;
