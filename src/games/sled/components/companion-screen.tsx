import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  Clock3,
  Crosshair,
  Fingerprint,
  LogOut,
  Radio,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { investigationMarks, type GameCase } from "../lib/game-cases";
import type { CaseStory } from "../lib/season-story";
import type { RoomPayload } from "../lib/multiplayer";
import { roleById } from "../lib/multiplayer";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { RoleIcon } from "./role-icon";
import { evidenceSizes, evidenceSrcSet } from "../lib/image-performance";
import { sledAsset } from "../lib/sled-assets";

function formatTimer(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

function useSharedCountdown(deadline: number | null | undefined, enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || typeof deadline !== "number") return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline, enabled]);
  if (!enabled || typeof deadline !== "number") return null;
  return Math.max(0, Math.ceil((deadline - Math.max(now, Date.now())) / 1000));
}

type CompanionScreenProps = {
  room: RoomPayload;
  gameCase: GameCase;
  story: CaseStory;
  busy: boolean;
  error: string | null;
  onVote: (roundIndex: number, district: string) => Promise<unknown>;
  onAbility: () => Promise<unknown>;
  onLeave: () => void;
};

export function CompanionScreen({ room, gameCase, story, busy, error, onVote, onAbility, onLeave }: CompanionScreenProps) {
  const state = room.state;
  const role = roleById(room.me.roleId);
  const roundIndex = Math.min(state?.roundIndex ?? 0, gameCase.rounds.length - 1);
  const round = gameCase.rounds[roundIndex];
  const beat = story.beats[roundIndex];
  const myVote = room.me.voteRound === roundIndex ? room.me.voteDistrict : null;
  const votes = room.players.filter((player) => player.voteRound === roundIndex && player.voteDistrict);
  const hostOnline = room.players.find((player) => player.isHost)?.online ?? false;
  const active = room.status === "game" && state?.signalOpen && !state.resolved;
  const found = state?.analysisByRound?.[roundIndex] ?? [];
  const marks = investigationMarks(round);
  const deductionReady = state?.deductionsSolved?.includes(roundIndex) ?? false;
  const timed = room.mode === "operative";
  const secondsLeft = useSharedCountdown(state?.timerDeadline, timed && Boolean(active));
  const analystHint = round.analystHint;
  const analystOpened = state?.analystRounds?.includes(roundIndex) ?? false;
  const recentAbility = [...room.events].reverse().find((event) => event.kind === "ability");
  const abilityStillUseful = role.effect === "reveal_detail"
    ? Boolean(analystHint) && !analystOpened
    : role.effect === "extra_time"
      ? typeof state?.timerDeadline === "number"
      : role.effect === "free_hint"
        ? !(state?.hintsUsed?.includes(roundIndex) ?? false)
        : role.effect === "reduce_threat"
          ? (state?.threat ?? 0) > 0
          : true;
  const abilityAvailable = active && !room.me.abilityUsed && !busy && abilityStillUseful;
  const abilityButtonCopy = room.me.abilityUsed
    ? "СПОСОБНОСТЬ УЖЕ ИСПОЛЬЗОВАНА"
    : !active
      ? "ДОЖДИТЕСЬ СТАРТА РАССЛЕДОВАНИЯ"
      : !abilityStillUseful
        ? role.effect === "reveal_detail"
          ? analystHint ? "СВЯЗКА ЭТОГО РАУНДА УЖЕ ОТКРЫТА" : "ДЛЯ ЭТОГО РАУНДА НЕТ СВЯЗКИ"
          : "ЭФФЕКТ СЕЙЧАС НЕПРИМЕНИМ"
        : role.guide.buttonLabel;
  const nextStep = !state?.signalOpen
    ? {
        number: "01",
        title: "Читайте вступление вместе с ведущим",
        body: "Таймер не идёт. Улика и способность появятся после кнопки «Начать расследование».",
      }
    : state.resolved
      ? {
          number: "04",
          title: "Решение принято — ждите следующую сцену",
          body: "Ведущий уже зафиксировал район. Следующий сигнал появится автоматически.",
        }
      : found.length < 2
        ? {
            number: "02",
            title: role.effect === "reveal_detail" && !room.me.abilityUsed ? "Откройте скрытую связку и обсудите её" : "Изучайте улику и обсуждайте детали",
            body: role.guide.responsibility,
          }
        : !deductionReady
          ? {
              number: "02",
              title: "Помогите команде собрать общий вывод",
              body: "Две детали найдены. Обсудите, как они связаны, пока ведущий подтверждает дедукцию.",
            }
          : {
              number: "03",
              title: "Выберите свою версию района ниже",
              body: "Ваш голос сразу появится у ведущего. Его можно изменить, пока ведущий не подтвердил решение.",
            };

  if (room.status === "final" || room.status === "ended") {
    const solved = state?.finalChoice === gameCase.final.correct && (state?.score ?? 0) >= 2 && (state?.threat ?? 100) < 100;
    return (
      <section className="companion-screen screen-pad">
        <div className={`companion-finale tactical-panel ${state?.finalChoice ? solved ? "won" : "lost" : "waiting"}`}>
          <div className="ending-emblem">{state?.finalChoice ? solved ? <ShieldCheck /> : <TriangleAlert /> : <Crosshair />}</div>
          <div className="eyebrow"><Radio /> КОМНАТА {room.code} · ФИНАЛЬНЫЙ ПРОТОКОЛ</div>
          <h2>{state?.finalChoice ? solved ? gameCase.final.successTitle : gameCase.final.failureTitle : "РЕШЕНИЕ ЗА ВЕДУЩИМ"}</h2>
          <p>{state?.finalChoice ? solved ? gameCase.final.successText : gameCase.final.wrongText : "Обсудите последнюю точку всей группой. Ведущий зафиксирует общий ответ на главном экране."}</p>
          <div className="ending-grid">
            <div><small>ТОЧНОСТЬ</small><strong>{state?.score ?? 0}/3</strong></div>
            <div><small>УГРОЗА</small><strong>{state?.threat ?? 0}%</strong></div>
            <div><small>ОЧКИ</small><strong>{state?.casePoints ?? 0}</strong></div>
          </div>
          <Button className="ghost-action" onClick={onLeave}><LogOut /> ПОКИНУТЬ КОМНАТУ</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="companion-screen screen-pad">
      <div className="companion-header">
        <div>
          <div className="eyebrow"><Radio /> КОМНАТА {room.code} · ВЫ В ГРУППЕ</div>
          <h2>{beat.chapter}</h2>
          <p>{beat.title} · {beat.location}</p>
        </div>
        <div className="companion-timer"><Clock3 /><span><small>{timed ? "ОСТАЛОСЬ" : "РЕЖИМ"}</small><strong>{!state?.signalOpen || state.resolved ? "--:--" : timed ? (secondsLeft == null ? "--:--" : formatTimer(secondsLeft)) : "БЕЗ ЛИМИТА"}</strong></span></div>
      </div>

      <div className="companion-next-step tactical-panel">
        <span>{nextStep.number}</span>
        <div>
          <small>ВАША ЗАДАЧА СЕЙЧАС · {role.name.toUpperCase()}</small>
          <h3>{nextStep.title}</h3>
          <p>{nextStep.body}</p>
        </div>
      </div>

      <div className="companion-status tactical-panel">
        <div><span><TriangleAlert /> УГРОЗА</span><strong>{state?.threat ?? 28}%</strong></div>
        <Progress value={state?.threat ?? 28} />
        <div className="companion-progress-chips">
          <span className={found.length >= 2 ? "done" : ""}><Fingerprint /> ДЕТАЛИ {found.length}/{marks.length}</span>
          <span className={deductionReady ? "done" : ""}><ShieldCheck /> ВЫВОД {deductionReady ? "ГОТОВ" : "В РАБОТЕ"}</span>
          <span><Users /> ГОЛОСА {votes.length}/{room.players.length}</span>
        </div>
      </div>
      {error && <div className="room-api-error"><Radio /> {error}</div>}
      {!hostOnline && <div className="room-api-error"><TriangleAlert /> Ведущий временно не в сети. Комната продолжит работу после его возвращения.</div>}

      <div className="companion-grid">
        <article className="companion-role tactical-panel">
          <div className="companion-role-head"><div><RoleIcon icon={role.icon} /></div><span><small>{role.callSign}</small><strong>{role.name}</strong></span></div>
          <p>{role.mission}</p>
          <div className="companion-role-guide">
            <div><small>КОГДА ИСПОЛЬЗОВАТЬ</small><strong>{role.guide.useWhen}</strong></div>
            <div><small>ЧТО ИЗМЕНИТСЯ У ВЕДУЩЕГО</small><strong>{role.guide.result}</strong></div>
          </div>
          <div className="companion-ability">
            <Sparkles />
            <span><strong>{role.abilityName}</strong><small>{role.abilityDescription}</small></span>
          </div>
          <Button className="ability-action wide" disabled={!abilityAvailable} onClick={() => { if (abilityAvailable) void onAbility(); }}>
            <Sparkles /> {abilityButtonCopy}
          </Button>
          {role.effect === "reveal_detail" && analystOpened && analystHint && (
            <div className="analyst-private">
              <small>ЧТО ВЫ УЗНАЛИ</small>
              <p>{analystHint.insight}</p>
              <small>ЧТО ОБСУДИТЬ С КОМАНДОЙ</small>
              <p>{analystHint.discuss}</p>
            </div>
          )}
          {recentAbility && <div className="ability-feed"><Check /><span><strong>{recentAbility.participantName}</strong> применяет проверку</span></div>}
        </article>

        <article className="companion-evidence tactical-panel">
          {!state?.signalOpen ? (
            <div className="companion-wait"><Radio /><h3>Входящий сигнал закрыт</h3><p>{beat.setup}</p><span>Ведущий скоро откроет улику.</span></div>
          ) : (
            <>
              <div className="companion-photo">
                <img
                  src={sledAsset(round.image)}
                  srcSet={evidenceSrcSet(round.image, round.imageWidth)}
                  sizes={evidenceSizes(true)}
                  width={round.imageWidth}
                  height={round.imageHeight}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  alt={`Улика: ${round.title}`}
                />
                <span>{round.code}</span>
              </div>
              <div className="companion-evidence-copy">
                <small>{round.source}</small>
                <h3>{round.title}</h3>
                <p>{round.summary}</p>
                {found.length >= 2 && <div className="companion-conclusion"><BookOpen /><span><small>КОМАНДА НАШЛА СВЯЗЬ</small>{deductionReady ? round.deduction.success : "Детали открыты. Аналитики собирают общий вывод."}</span></div>}
              </div>
            </>
          )}
        </article>
      </div>

      <article className={`companion-vote tactical-panel ${active && deductionReady ? "active" : "locked"}`}>
        <div className="panel-title"><span><Crosshair /> ВАША ВЕРСИЯ</span><b>{myVote ? "ГОЛОС ПРИНЯТ" : active && deductionReady ? "ВЫБЕРИТЕ РАЙОН" : "ОЖИДАНИЕ"}</b></div>
        <p>{!state?.signalOpen ? "Голосование откроется вместе с уликой." : !deductionReady ? "Сначала команда должна исследовать детали и подтвердить логический вывод." : state.resolved ? "Ведущий уже зафиксировал решение этой сцены." : "Отметьте район, который лучше всего соответствует общему выводу. Выбор можно изменить до решения ведущего."}</p>
        <div className="companion-districts">
          {gameCase.districts.map((district) => (
            <button
              key={district.id}
              className={`${myVote === district.id ? "selected" : ""} ${state?.eliminatedDistricts?.includes(district.id) ? "eliminated" : ""}`}
              disabled={!active || !deductionReady || state?.eliminatedDistricts?.includes(district.id)}
              onClick={() => void onVote(roundIndex, district.id)}
            >
              <span>{district.code}</span><strong>{district.name}</strong>{myVote === district.id && <Check />}
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}
