import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { Router, json, type Request } from "express";
import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";
import { verifyInitData } from "../telegram/verifyInitData.js";
import { getUserPremiumWithDb } from "../premiumStore.js";
import { infectedCycleOutcome, infectedWaitingFor, numericRoomCode } from "../party/partyRules.js";

type Db = Pool | PoolClient;
type InfectionStatus = "healthy" | "latent" | "active";
type Winner = "crew" | "infected";
type SystemKey = "power" | "lab" | "comms" | "life";
type Systems = Record<SystemKey, number>;

type RoomRow = {
  id: string;
  code: string;
  phase: "lobby" | "briefing" | "operations" | "council" | "result" | "ended";
  round: number;
  max_rounds: number;
  tasks_done: number;
  task_target: number;
  crew_score: number;
  infection_level: number;
  systems_json: Systems | string;
  event_json: Record<string, unknown> | string;
  winner: Winner | null;
  host_id: string | null;
  lab_compromised_round: number;
  version: number;
};

type PlayerRow = {
  id: string;
  room_id: string;
  name: string;
  token: string;
  is_host: boolean;
  job: string;
  infection_status: InfectionStatus;
  awaken_round: number;
  original_infected: boolean;
  quarantined: boolean;
  ready: boolean;
  task_done_round: number;
  vote_target_id: string | null;
  dark_action_round: number;
  conversion_used: boolean;
  special_action_round: number;
  protected_round: number;
  analysis_text: string;
  private_notice: string;
};

const JOBS = [
  "medic", "engineer", "security", "biologist", "operator", "navigator",
  "analyst", "technician", "commander", "psychologist", "geologist", "quartermaster",
] as const;
const SYSTEM_KEYS: SystemKey[] = ["power", "lab", "comms", "life"];
const INITIAL_SYSTEMS: Systems = { power: 100, lab: 100, comms: 100, life: 100 };

const gameError = (message: string) => Object.assign(new Error(message), { expected: true });
const cleanName = (value: unknown) => String(value ?? "")
  .replace(/[<>\u0000-\u001f]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 20);

function parseJson<T>(value: T | string, fallback: T): T {
  if (typeof value !== "string") return value ?? fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function systemsOf(room: RoomRow): Systems {
  return { ...INITIAL_SYSTEMS, ...parseJson(room.systems_json, INITIAL_SYSTEMS) };
}

function eventOf(room: RoomRow): Record<string, unknown> {
  return parseJson(room.event_json, {});
}

function event(kind: string, title: string, text: string, extra: Record<string, unknown> = {}) {
  return { kind, title, text, ...extra };
}

function roomCode() {
  return numericRoomCode(max => randomInt(max));
}

function waitingText(names: string[]) {
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} и ещё ${names.length - 3}` : names.join(", ");
}

function sessionToken() {
  return randomBytes(24).toString("hex");
}

function shuffled<T>(items: readonly T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function ability(job: string) {
  if (["medic", "biologist", "analyst"].includes(job)) return "analyze" as const;
  if (["engineer", "technician"].includes(job)) return "repair" as const;
  if (["security", "commander"].includes(job)) return "protect" as const;
  return "stabilize" as const;
}

function infectedCount(playerCount: number) {
  return playerCount <= 6 ? 1 : playerCount <= 9 ? 2 : 3;
}

async function transaction<T>(pool: Pool, callback: (db: PoolClient) => Promise<T>) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await callback(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

async function roomById(db: Db, roomId: string, lock = false) {
  const result = await db.query<RoomRow>(
    `SELECT * FROM infected_rooms WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [roomId],
  );
  return result.rows[0] ?? null;
}

async function playerByAuth(db: Db, playerId: string, token: string, lock = false) {
  const result = await db.query<PlayerRow>(
    `SELECT * FROM infected_players WHERE id = $1 AND token = $2${lock ? " FOR UPDATE" : ""}`,
    [playerId, token],
  );
  return result.rows[0] ?? null;
}

async function roomPlayers(db: Db, roomId: string, lock = false) {
  const result = await db.query<PlayerRow>(
    `SELECT * FROM infected_players WHERE room_id = $1 ORDER BY created_at${lock ? " FOR UPDATE" : ""}`,
    [roomId],
  );
  return result.rows;
}

async function stateFor(db: Db, playerId: string, token: string) {
  const me = await playerByAuth(db, playerId, token);
  if (!me) return null;
  const room = await roomById(db, me.room_id);
  if (!room) return null;
  const players = await roomPlayers(db, room.id);
  const visibleInfection = me.infection_status === "active" ? "active" : "healthy";
  const onStation = players.filter(player => !player.quarantined);

  return {
    room: {
      code: room.code,
      phase: room.phase,
      round: room.round,
      maxRounds: room.max_rounds,
      // Pressed protocols, not honest ones: a secret sabotage stays hidden until the council.
      tasksDone: onStation.filter(player => player.task_done_round === room.round).length,
      taskTarget: onStation.length,
      crewScore: room.crew_score,
      infectionLevel: room.infection_level,
      systems: systemsOf(room),
      event: eventOf(room),
      winner: room.winner,
      version: room.version,
    },
    me: {
      id: me.id,
      name: me.name,
      isHost: me.is_host,
      job: me.job,
      infectionStatus: visibleInfection,
      awakenedThisRound: me.infection_status === "active"
        && !me.original_infected
        && me.awaken_round === room.round,
      quarantined: me.quarantined,
      ready: me.ready,
      taskDone: me.task_done_round === room.round,
      voteSubmitted: Boolean(me.vote_target_id),
      darkActionUsed: me.dark_action_round === room.round,
      conversionUsed: me.conversion_used,
      specialActionUsed: me.special_action_round === room.round,
      protected: me.protected_round === room.round,
      ability: ability(me.job),
      analysisText: me.analysis_text,
      privateNotice: me.private_notice,
      teammates: visibleInfection === "active"
        ? players
          .filter(player => player.id !== me.id && !player.quarantined && player.infection_status === "active")
          .map(player => ({ id: player.id, name: player.name }))
        : [],
    },
    players: players.map(player => ({
      id: player.id,
      name: player.name,
      isHost: player.is_host,
      quarantined: player.quarantined,
      ready: player.ready,
      taskDone: player.task_done_round === room.round,
      voted: Boolean(player.vote_target_id),
      finalRole: room.phase === "ended"
        ? (player.infection_status === "healthy" ? "crew" : "infected")
        : undefined,
    })),
  };
}

async function createRoom(pool: Pool, name: string) {
  return transaction(pool, async db => {
    const roomId = randomUUID();
    const playerId = randomUUID();
    const token = sessionToken();
    let code = "";

    for (let attempt = 0; attempt < 8; attempt += 1) {
      code = roomCode();
      const inserted = await db.query(
        `INSERT INTO infected_rooms
          (id, code, phase, round, max_rounds, tasks_done, task_target, crew_score,
           infection_level, systems_json, event_json, winner, host_id,
           lab_compromised_round, version)
         VALUES ($1, $2, 'lobby', 0, 4, 0, 0, 0, 0, $3::jsonb, $4::jsonb,
                 NULL, NULL, 0, 1)
         ON CONFLICT (code) DO NOTHING
         RETURNING id`,
        [
          roomId,
          code,
          JSON.stringify(INITIAL_SYSTEMS),
          JSON.stringify(event("lobby", "Станция ждёт экипаж", "Передайте код остальным игрокам.")),
        ],
      );
      if (inserted.rowCount) break;
      code = "";
    }
    if (!code) throw gameError("Не удалось создать код станции. Повторите попытку.");

    await db.query(
      `INSERT INTO infected_players
        (id, room_id, name, token, is_host, job, infection_status)
       VALUES ($1, $2, $3, $4, true, 'commander', 'healthy')`,
      [playerId, roomId, name, token],
    );
    await db.query("UPDATE infected_rooms SET host_id = $1 WHERE id = $2", [playerId, roomId]);
    return { playerId, token, code };
  });
}

async function joinRoom(pool: Pool, code: string, name: string) {
  return transaction(pool, async db => {
    const roomResult = await db.query<RoomRow>(
      "SELECT * FROM infected_rooms WHERE upper(code) = upper($1) FOR UPDATE",
      [code],
    );
    const room = roomResult.rows[0];
    if (!room) throw gameError("Станция с таким кодом не найдена.");
    if (room.phase !== "lobby") throw gameError("Смена уже началась. Войти нельзя.");

    const players = await roomPlayers(db, room.id);
    if (players.length >= 12) throw gameError("На станции уже 12 человек.");
    if (players.some(player => player.name.toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru"))) {
      throw gameError("Это имя уже занято.");
    }

    const playerId = randomUUID();
    const token = sessionToken();
    await db.query(
      `INSERT INTO infected_players
        (id, room_id, name, token, is_host, job, infection_status)
       VALUES ($1, $2, $3, $4, false, 'crew', 'healthy')`,
      [playerId, room.id, name, token],
    );
    await db.query(
      "UPDATE infected_rooms SET version = version + 1, updated_at = now() WHERE id = $1",
      [room.id],
    );
    return { playerId, token, code: room.code };
  });
}

async function start(db: Db, room: RoomRow, actor: PlayerRow) {
  if (!actor.is_host) throw gameError("Только начальник станции может начать смену.");
  if (!["lobby", "ended"].includes(room.phase)) throw gameError("Смена уже запущена.");

  const players = await roomPlayers(db, room.id, true);
  if (players.length < 4) throw gameError("Нужно от 4 до 12 игроков.");
  const order = shuffled(players);
  const jobs = shuffled(JOBS);
  const infected = infectedCount(players.length);

  for (const [index, player] of order.entries()) {
    await db.query(
      `UPDATE infected_players SET
         job = $1, infection_status = $2, awaken_round = 0,
         original_infected = $3, quarantined = false, ready = false,
         task_done_round = 0, vote_target_id = NULL, dark_action_round = 0,
         conversion_used = false, special_action_round = 0, protected_round = 0,
         analysis_text = '', private_notice = ''
       WHERE id = $4`,
      [jobs[index % jobs.length], index < infected ? "active" : "healthy", index < infected, player.id],
    );
  }

  await db.query(
    `UPDATE infected_rooms SET
       phase = 'briefing', round = 1, tasks_done = 0, task_target = $1,
       crew_score = 0, infection_level = $2, systems_json = $3::jsonb,
       event_json = $4::jsonb, winner = NULL, lab_compromised_round = 0,
       version = version + 1, updated_at = now()
     WHERE id = $5`,
    [
      players.length,
      infected * 8,
      JSON.stringify(INITIAL_SYSTEMS),
      JSON.stringify(event("briefing", "Личности назначены", "Не показывайте экран. Изучите личную карточку и подтвердите готовность.")),
      room.id,
    ],
  );
}

async function ready(db: Db, room: RoomRow, actor: PlayerRow) {
  if (room.phase !== "briefing") throw gameError("Сейчас подтверждение не требуется.");
  await db.query("UPDATE infected_players SET ready = true WHERE id = $1", [actor.id]);
  const waitingResult = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM infected_players WHERE room_id = $1 AND quarantined = false AND ready = false",
    [room.id],
  );
  const nobodyWaiting = Number(waitingResult.rows[0]?.count ?? 0) === 0;
  await db.query(
    `UPDATE infected_rooms SET
       phase = CASE WHEN $1 THEN 'operations' ELSE phase END,
       event_json = CASE WHEN $1 THEN $2::jsonb ELSE event_json END,
       version = version + 1, updated_at = now()
     WHERE id = $3`,
    [
      nobodyWaiting,
      JSON.stringify(event("operations", "Смена началась", "Выполните личный протокол. Следите за системами и поведением экипажа.")),
      room.id,
    ],
  );
}

async function task(db: Db, room: RoomRow, actor: PlayerRow, payload: Record<string, unknown>) {
  if (room.phase !== "operations") throw gameError("Протоколы сейчас недоступны.");
  if (actor.quarantined) throw gameError("Вы в карантине.");
  const sabotage = payload.sabotage === true;
  if (sabotage && actor.infection_status !== "active") throw gameError("Сорвать протокол может только организм.");
  const result = await db.query(
    `UPDATE infected_players
     SET task_done_round = $1, private_notice = $3
     WHERE id = $2 AND task_done_round < $1`,
    [
      room.round,
      actor.id,
      sabotage ? "Протокол тайно сорван. Для остальных он выглядит выполненным." : "Личный протокол принят системой.",
    ],
  );
  if (!result.rowCount) throw gameError("Протокол этого цикла уже отправлен.");
  await db.query(
    `UPDATE infected_rooms SET tasks_done = tasks_done + $2,
       version = version + 1, updated_at = now() WHERE id = $1`,
    [room.id, sabotage ? 0 : 1],
  );
}

async function dark(db: Db, room: RoomRow, actor: PlayerRow, payload: Record<string, unknown>) {
  if (room.phase !== "operations" || actor.infection_status !== "active" || actor.quarantined) {
    throw gameError("Тёмный канал недоступен.");
  }
  if (actor.dark_action_round === room.round) throw gameError("Тёмное действие уже использовано.");
  const mode = String(payload.mode ?? "");

  if (mode === "infect") {
    if (actor.conversion_used) throw gameError("Обращение уже использовано в этой партии.");
    const targetResult = await db.query<PlayerRow>(
      "SELECT * FROM infected_players WHERE id = $1 AND room_id = $2 FOR UPDATE",
      [String(payload.targetId ?? ""), room.id],
    );
    const target = targetResult.rows[0];
    if (!target || target.id === actor.id || target.quarantined || target.infection_status !== "healthy") {
      throw gameError("Эта цель недоступна.");
    }

    if (target.protected_round === room.round) {
      await db.query(
        "UPDATE infected_players SET dark_action_round = $1, private_notice = $2 WHERE id = $3",
        [room.round, "Защитный протокол отбил организм. Обращение не произошло.", actor.id],
      );
    } else {
      await db.query(
        "UPDATE infected_players SET infection_status = 'latent', awaken_round = $1 WHERE id = $2",
        [room.round + 1, target.id],
      );
      await db.query(
        `UPDATE infected_players SET
           dark_action_round = $1, conversion_used = true, private_notice = $2
         WHERE id = $3`,
        [room.round, `${target.name} заражён(а), но узнает об этом лишь в следующем цикле.`, actor.id],
      );
      await db.query(
        `UPDATE infected_rooms SET infection_level = LEAST(100, infection_level + 6),
           version = version + 1, updated_at = now() WHERE id = $1`,
        [room.id],
      );
      return;
    }
  } else if (mode === "sabotage") {
    const system = String(payload.system ?? "") as SystemKey;
    if (!SYSTEM_KEYS.includes(system)) throw gameError("Выберите систему.");
    const systems = systemsOf(room);
    systems[system] = Math.max(0, systems[system] - 26);
    await db.query(
      "UPDATE infected_players SET dark_action_round = $1, private_notice = $2 WHERE id = $3",
      [room.round, "Саботаж проведён. Авария выглядит случайной.", actor.id],
    );
    await db.query(
      `UPDATE infected_rooms SET systems_json = $1::jsonb,
         infection_level = LEAST(100, infection_level + 7),
         version = version + 1, updated_at = now() WHERE id = $2`,
      [JSON.stringify(systems), room.id],
    );
    return;
  } else if (mode === "forge") {
    await db.query(
      "UPDATE infected_players SET dark_action_round = $1, private_notice = $2 WHERE id = $3",
      [room.round, "Результаты анализов этого цикла подменены.", actor.id],
    );
    await db.query(
      `UPDATE infected_rooms SET lab_compromised_round = $1,
         version = version + 1, updated_at = now() WHERE id = $2`,
      [room.round, room.id],
    );
    return;
  } else {
    throw gameError("Выберите действие организма.");
  }

  await db.query(
    "UPDATE infected_rooms SET version = version + 1, updated_at = now() WHERE id = $1",
    [room.id],
  );
}

async function special(db: Db, room: RoomRow, actor: PlayerRow, payload: Record<string, unknown>) {
  if (room.phase !== "operations" || actor.quarantined) throw gameError("Спецдоступ недоступен.");
  if (actor.special_action_round === room.round) throw gameError("Спецдоступ уже использован.");
  const kind = ability(actor.job);
  const systems = systemsOf(room);

  if (kind === "analyze") {
    const targetResult = await db.query<PlayerRow>(
      "SELECT * FROM infected_players WHERE id = $1 AND room_id = $2 FOR UPDATE",
      [String(payload.targetId ?? ""), room.id],
    );
    const target = targetResult.rows[0];
    if (!target || target.id === actor.id || target.quarantined) throw gameError("Выберите доступного игрока.");
    const infected = target.infection_status !== "healthy";
    const compromised = room.lab_compromised_round === room.round || systems.lab < 45;
    const accurate = Math.random() < (compromised ? 0.38 : systems.lab < 70 ? 0.72 : 0.9);
    const found = accurate ? infected : !infected;
    const confidence = compromised ? 61 : 92;
    const result = found
      ? `${target.name}: обнаружены аномальные клетки. Риск — ВЫСОКИЙ. Достоверность ${confidence}%.`
      : `${target.name}: опасных маркеров не обнаружено. Риск — НИЗКИЙ. Достоверность ${confidence}%.`;
    await db.query(
      `UPDATE infected_players SET special_action_round = $1,
         analysis_text = $2, private_notice = 'Результат виден только вам.' WHERE id = $3`,
      [room.round, result, actor.id],
    );
  } else if (kind === "repair") {
    const system = String(payload.system ?? "") as SystemKey;
    if (!SYSTEM_KEYS.includes(system)) throw gameError("Выберите систему.");
    systems[system] = Math.min(100, systems[system] + 20);
    await db.query(
      "UPDATE infected_players SET special_action_round = $1, private_notice = $2 WHERE id = $3",
      [room.round, "Аварийный ремонт завершён: +20%.", actor.id],
    );
    await db.query(
      "UPDATE infected_rooms SET systems_json = $1::jsonb, version = version + 1, updated_at = now() WHERE id = $2",
      [JSON.stringify(systems), room.id],
    );
    return;
  } else if (kind === "protect") {
    const targetResult = await db.query<PlayerRow>(
      "SELECT * FROM infected_players WHERE id = $1 AND room_id = $2 FOR UPDATE",
      [String(payload.targetId ?? ""), room.id],
    );
    const target = targetResult.rows[0];
    if (!target || target.quarantined) throw gameError("Выберите доступного игрока.");
    await db.query("UPDATE infected_players SET protected_round = $1 WHERE id = $2", [room.round, target.id]);
    await db.query(
      "UPDATE infected_players SET special_action_round = $1, private_notice = $2 WHERE id = $3",
      [room.round, `${target.name} защищён(а) от обращения.`, actor.id],
    );
  } else {
    const lowest = SYSTEM_KEYS.reduce((left, right) => systems[right] < systems[left] ? right : left);
    systems[lowest] = Math.min(100, systems[lowest] + 10);
    await db.query(
      "UPDATE infected_players SET special_action_round = $1, private_notice = $2 WHERE id = $3",
      [room.round, "Самая слабая система восстановлена на 10%.", actor.id],
    );
    await db.query(
      "UPDATE infected_rooms SET systems_json = $1::jsonb, version = version + 1, updated_at = now() WHERE id = $2",
      [JSON.stringify(systems), room.id],
    );
    return;
  }

  await db.query(
    "UPDATE infected_rooms SET version = version + 1, updated_at = now() WHERE id = $1",
    [room.id],
  );
}

async function council(db: Db, room: RoomRow, actor: PlayerRow) {
  if (!actor.is_host || room.phase !== "operations") throw gameError("Только начальник может открыть совет.");
  const players = await roomPlayers(db, room.id, true);
  const waiting = infectedWaitingFor(players, player => player.task_done_round === room.round);
  if (waiting.length) throw gameError(`Совет откроется, когда все выполнят протокол. Ждём: ${waitingText(waiting)}.`);
  const infected = players.filter(player => !player.quarantined && player.infection_status !== "healthy").length;
  const onStation = players.filter(player => !player.quarantined).length;
  const { success, sabotaged } = infectedCycleOutcome(onStation, room.tasks_done);
  const systems = systemsOf(room);
  let infectionLevel = Math.min(100, room.infection_level + infected * 2);
  let crewScore = room.crew_score;

  if (success) {
    crewScore += 1;
    SYSTEM_KEYS.forEach(key => { systems[key] = Math.min(100, systems[key] + 3); });
  } else {
    const key = SYSTEM_KEYS[Math.floor(Math.random() * SYSTEM_KEYS.length)];
    systems[key] = Math.max(0, systems[key] - 16);
    infectionLevel = Math.min(100, infectionLevel + 8);
  }

  const winner: Winner | null = infectionLevel >= 100 || SYSTEM_KEYS.some(key => systems[key] <= 0)
    ? "infected"
    : crewScore >= 3 ? "crew" : null;
  const nextEvent = winner
    ? event(
      "ended",
      winner === "crew" ? "Контур восстановлен" : "Станция потеряна",
      winner === "crew" ? "Три ключевых протокола завершены." : "Заражение достигло критической отметки.",
    )
    : event(
      success ? "success" : "failure",
      "Общий совет",
      `${success ? "Все протоколы выполнены честно — цикл засчитан экипажу." : `Протокол сорван изнутри: сбоев — ${sabotaged}. Кто-то из экипажа работает на организм.`} ${room.round < 2 ? "Первый совет только фиксирует подозрение. В карантин пока никого не отправляют." : "Обсудите подозрения и выберите кандидата на карантин."}`,
    );

  await db.query(
    `UPDATE infected_rooms SET phase = $1, crew_score = $2, infection_level = $3,
       systems_json = $4::jsonb, event_json = $5::jsonb, winner = $6,
       version = version + 1, updated_at = now() WHERE id = $7`,
    [winner ? "ended" : "council", crewScore, infectionLevel, JSON.stringify(systems), JSON.stringify(nextEvent), winner, room.id],
  );
}

async function vote(db: Db, room: RoomRow, actor: PlayerRow, targetId: string) {
  if (room.phase !== "council" || actor.quarantined) throw gameError("Голосование недоступно.");
  if (actor.vote_target_id) throw gameError("Голос уже отправлен.");
  if (actor.id === targetId) throw gameError("За себя голосовать нельзя.");
  const targetResult = await db.query(
    "SELECT id FROM infected_players WHERE id = $1 AND room_id = $2 AND quarantined = false FOR UPDATE",
    [targetId, room.id],
  );
  if (!targetResult.rowCount) throw gameError("Игрок недоступен.");
  await db.query("UPDATE infected_players SET vote_target_id = $1 WHERE id = $2", [targetId, actor.id]);
  await db.query(
    "UPDATE infected_rooms SET version = version + 1, updated_at = now() WHERE id = $1",
    [room.id],
  );
}

function winnerFor(room: RoomRow, players: PlayerRow[]) {
  const active = players.filter(player => !player.quarantined);
  const infected = active.filter(player => player.infection_status !== "healthy").length;
  const healthy = active.length - infected;
  if (room.crew_score >= 3) return "crew" as const;
  if (!infected && room.round >= 2) return "crew" as const;
  if (room.infection_level >= 100 || SYSTEM_KEYS.some(key => systemsOf(room)[key] <= 0)) return "infected" as const;
  if (active.length >= 4 && infected >= healthy) return "infected" as const;
  if (room.round >= room.max_rounds) return room.crew_score >= 2 && infected < healthy ? "crew" as const : "infected" as const;
  return null;
}

async function resolveCouncil(db: Db, room: RoomRow, actor: PlayerRow) {
  if (!actor.is_host || room.phase !== "council") throw gameError("Только начальник подводит итог.");
  const players = await roomPlayers(db, room.id, true);
  const notVoted = infectedWaitingFor(players, player => Boolean(player.vote_target_id));
  if (notVoted.length) throw gameError(`Итог откроется после всех голосов. Ждём: ${waitingText(notVoted)}.`);
  const counts = new Map<string, number>();
  players.forEach(player => {
    if (!player.quarantined && player.vote_target_id) {
      counts.set(player.vote_target_id, (counts.get(player.vote_target_id) ?? 0) + 1);
    }
  });
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const targetId = ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1])
    ? ranked[0][0]
    : null;
  const observation = room.round < 2;
  const target = targetId ? players.find(player => player.id === targetId) : undefined;
  if (target && !observation) await db.query("UPDATE infected_players SET quarantined = true WHERE id = $1", [target.id]);

  const resultText = observation
    ? target
      ? `Подозрение первого цикла: ${target.name}. Шлюз не закрывается, организм ещё может действовать.`
      : ranked.length
        ? "Голоса разошлись. Подозрение не зафиксировано. Карантин откроется со следующего цикла."
        : "Голосов нет. Карантин откроется со следующего цикла."
    : target
      ? `${target.name} — в карантине.`
      : ranked.length
        ? "Голоса разделились поровну. Карантин отменён."
        : "Голоса не поданы. В карантин никто не отправлен.";
  const updatedPlayers = await roomPlayers(db, room.id);
  const winner = winnerFor(room, updatedPlayers);
  const nextEvent = winner
    ? event(
      "ended",
      winner === "crew" ? "Экипаж выжил" : "Организм победил",
      `${resultText} ${winner === "crew" ? "Угрозы нейтрализованы. Роли открыты." : "Организм захватил станцию. Роли открыты."}`,
      { quarantinedId: target?.id ?? null },
    )
    : event(
      "quarantine",
      observation ? (target ? "Подозрение зафиксировано" : "Подозрение не собрано") : target ? "Шлюз запечатан" : "Карантин отменён",
      resultText,
      { quarantinedId: observation ? null : target?.id ?? null },
    );

  await db.query(
    `UPDATE infected_rooms SET phase = $1, winner = $2, event_json = $3::jsonb,
       version = version + 1, updated_at = now() WHERE id = $4`,
    [winner ? "ended" : "result", winner, JSON.stringify(nextEvent), room.id],
  );
}

async function nextCycle(db: Db, room: RoomRow, actor: PlayerRow) {
  if (!actor.is_host || room.phase !== "result") throw gameError("Новый цикл недоступен.");
  const nextRound = room.round + 1;
  const players = await roomPlayers(db, room.id, true);
  const activeCount = players.filter(player => !player.quarantined).length;
  await db.query(
    `UPDATE infected_players SET infection_status = 'active'
     WHERE room_id = $1 AND infection_status = 'latent' AND awaken_round <= $2`,
    [room.id, nextRound],
  );
  await db.query(
    "UPDATE infected_players SET vote_target_id = NULL, analysis_text = '' WHERE room_id = $1",
    [room.id],
  );
  await db.query(
    `UPDATE infected_rooms SET phase = 'operations', round = $1, tasks_done = 0,
       task_target = $2, event_json = $3::jsonb,
       version = version + 1, updated_at = now() WHERE id = $4`,
    [
      nextRound,
      activeCount,
      JSON.stringify(event("operations", `Цикл ${nextRound} из ${room.max_rounds}`, "Новые протоколы загружены. Некоторые симптомы проявляются не сразу.")),
      room.id,
    ],
  );
}

async function performAction(
  db: Db,
  room: RoomRow,
  actor: PlayerRow,
  name: string,
  payload: Record<string, unknown>,
) {
  if (name === "start" || name === "restart") return start(db, room, actor);
  if (name === "ready") return ready(db, room, actor);
  if (name === "task") return task(db, room, actor, payload);
  if (name === "dark") return dark(db, room, actor, payload);
  if (name === "special") return special(db, room, actor, payload);
  if (name === "council") return council(db, room, actor);
  if (name === "vote") return vote(db, room, actor, String(payload.targetId ?? ""));
  if (name === "resolve") return resolveCouncil(db, room, actor);
  if (name === "next") return nextCycle(db, room, actor);
  throw gameError("Неизвестная команда станции.");
}

function requestAuth(request: Request, body: Record<string, unknown> = {}) {
  return {
    playerId: String(request.header("x-infected-player-id") ?? body.playerId ?? request.query.playerId ?? ""),
    token: String(request.header("x-infected-token") ?? body.token ?? request.query.token ?? ""),
  };
}

function statusFor(error: unknown) {
  if (typeof error === "object" && error && "expected" in error) return 400;
  if (typeof error === "object" && error && "code" in error && error.code === "23505") return 409;
  return 500;
}

function messageFor(error: unknown) {
  if (typeof error === "object" && error && "expected" in error && error instanceof Error) return error.message;
  if (typeof error === "object" && error && "code" in error && error.code === "23505") return "Такая запись уже существует.";
  return "Станция временно не отвечает.";
}

async function callerIsPremium(request: Request) {
  const raw = request.headers["x-telegram-init-data"];
  const initData = typeof raw === "string" ? raw.trim() : "";
  if (!initData) return false;
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? "";
  if (!botToken) return false;
  try {
    const parsed = verifyInitData(initData, botToken);
    const status = await getUserPremiumWithDb(parsed.telegram_id);
    return status.premium;
  } catch {
    return false;
  }
}

export function createInfectedGameRouter(pool: Pool) {
  const router = Router();
  router.use(json({ limit: "16kb" }));
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    next();
  });

  router.get("/ready", async (_request, response) => {
    try {
      await pool.query("SELECT 1 FROM infected_rooms LIMIT 0");
      await pool.query("SELECT 1 FROM infected_players LIMIT 0");
      const privileges = await pool.query<{ ok: boolean }>(
        `SELECT (
           has_table_privilege(current_user, 'infected_rooms', 'SELECT')
           AND has_table_privilege(current_user, 'infected_rooms', 'INSERT')
           AND has_table_privilege(current_user, 'infected_rooms', 'UPDATE')
           AND has_table_privilege(current_user, 'infected_rooms', 'DELETE')
           AND has_table_privilege(current_user, 'infected_players', 'SELECT')
           AND has_table_privilege(current_user, 'infected_players', 'INSERT')
           AND has_table_privilege(current_user, 'infected_players', 'UPDATE')
           AND has_table_privilege(current_user, 'infected_players', 'DELETE')
         ) AS ok`,
      );
      if (!privileges.rows[0]?.ok) {
        response.status(503).json({ ok: false, error: "infected privileges missing" });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      console.error("[infected] ready", error);
      response.status(503).json({ ok: false, error: "infected schema unavailable" });
    }
  });

  router.get("/", async (request, response) => {
    try {
      const auth = requestAuth(request);
      const state = await stateFor(pool, auth.playerId, auth.token);
      if (!state) return response.status(404).json({ error: "Сессия станции не найдена." });
      return response.json(state);
    } catch (error) {
      console.error("infected_game_state_failed", error);
      return response.status(statusFor(error)).json({ error: messageFor(error) });
    }
  });

  router.post("/", async (request, response) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const mode = String(body.mode ?? "");
    try {
      if (mode === "create") {
        if (!(await callerIsPremium(request))) return response.status(403).json({ error: "Создать комнату можно только с Premium." });
        const name = cleanName(body.name);
        if (name.length < 2) throw gameError("Введите имя — минимум 2 символа.");
        return response.status(201).json({ session: await createRoom(pool, name) });
      }

      if (mode === "join") {
        const name = cleanName(body.name);
        const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (name.length < 2) throw gameError("Введите имя — минимум 2 символа.");
        if (code.length !== 6) throw gameError("Код станции — 6 цифр.");
        return response.status(201).json({ session: await joinRoom(pool, code, name) });
      }

      if (mode === "action") {
        const auth = requestAuth(request, body);
        await transaction(pool, async db => {
          const actor = await playerByAuth(db, auth.playerId, auth.token, true);
          if (!actor) throw gameError("Сессия игрока истекла.");
          const room = await roomById(db, actor.room_id, true);
          if (!room) throw gameError("Станция не найдена.");
          await performAction(
            db,
            room,
            actor,
            String(body.action ?? ""),
            (body.payload as Record<string, unknown> | undefined) ?? {},
          );
        });
        const state = await stateFor(pool, auth.playerId, auth.token);
        return response.json(state);
      }

      throw gameError("Неизвестный запрос.");
    } catch (error) {
      console.error("infected_game_action_failed", error);
      return response.status(statusFor(error)).json({ error: messageFor(error) });
    }
  });

  return router;
}

export default createInfectedGameRouter(pool);

