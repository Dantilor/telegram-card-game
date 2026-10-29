import { extraGameCases } from "./additional-game-cases";

export type DistrictId = string;
export type DistrictTone = "cyan" | "violet" | "orange" | "green" | "pink" | "blue";
export type CaseId = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10";

export type District = {
  id: DistrictId;
  name: string;
  code: string;
  x: number;
  y: number;
  tone: DistrictTone;
};

export type EvidenceHotspot = {
  x: number;
  y: number;
  /** What the team does at this mark. Must not reveal the hidden fact. */
  action?: string;
};

export type AnalystHint = {
  insight: string;
  discuss: string;
};

export type GameRound = {
  code: string;
  title: string;
  time: string;
  correct: DistrictId;
  image: string;
  imageWidth: number;
  imageHeight: number;
  hotspots: EvidenceHotspot[];
  source: string;
  summary: string;
  details: string[];
  hint: string;
  trace: string;
  /** Private analyst link for this round. Absent means the ability must not be spent. */
  analystHint?: AnalystHint;
  deduction: {
    question: string;
    options: string[];
    correct: number;
    success: string;
  };
};

const fallbackActions = [
  "Осмотреть отмеченный участок",
  "Сверить второй участок кадра",
  "Проверить край кадра, который раньше был без метки",
];

/** One mark per fact. Extra facts get their own mark so a hidden detail can still be found. */
export function investigationMarks(round: GameRound): Array<EvidenceHotspot & { action: string }> {
  return round.details.map((_, index) => {
    const hotspot = round.hotspots[index];
    return {
      x: hotspot?.x ?? 50,
      y: hotspot?.y ?? 16,
      action: hotspot?.action || fallbackActions[index] || `Осмотреть метку ${index + 1}`,
    };
  });
}

export type GameCase = {
  id: CaseId;
  title: string;
  subtitle: string;
  operationTitle: string;
  briefing: string;
  rulesTitle: string;
  rulesGoal: string;
  target: {
    code: string;
    name: string;
    label: string;
    description: string;
  };
  mechanic: {
    name: string;
    description: string;
  };
  districts: District[];
  rounds: GameRound[];
  teamVotes: Record<number, Array<{ agent: string; district: DistrictId }>>;
  abilityEliminations: DistrictId[];
  chatIntro: [string, string];
  signalSound: "alert" | "transit" | "archive" | "radio" | "flight" | "hotel" | "glass" | "stage" | "cold" | "hostik";
  threatCopy: [string, string, string];
  final: {
    question: string;
    description: string;
    choices: DistrictId[];
    correct: DistrictId;
    hint: string;
    successTitle: string;
    failureTitle: string;
    successText: string;
    insufficientText: string;
    wrongText: string;
    networkLostText: string;
  };
};

const phantom: GameCase = {
  id: "01",
  title: "Фантом",
  subtitle: "След в ночной сети",
  operationTitle: "Ночная сеть города",
  briefing:
    "Неизвестный вмешивается в городскую сеть и оставляет противоречивые сигналы. Один неверный вывод усиливает его след.",
  rulesTitle: "Как поймать Фантома",
  rulesGoal: "Сопоставьте три сигнала и вычислите район, где заканчивается маршрут Фантома.",
  target: {
    code: "ОБЪЕКТ #0001",
    name: "ФАНТОМ",
    label: "ЛИЧНОСТЬ НЕ УСТАНОВЛЕНА",
    description:
      "Проникает в закрытые системы, использует заброшенную инфраструктуру и всегда оставляет одну лишнюю подсказку.",
  },
  mechanic: {
    name: "Трассировка маршрута",
    description: "Каждый подтверждённый сигнал открывает новую точку пути. В финале соедините все три точки.",
  },
  districts: [
    { id: "north", name: "Северный", code: "N-04", x: 28, y: 19, tone: "violet" },
    { id: "metro", name: "Метро-7", code: "M-07", x: 65, y: 22, tone: "cyan" },
    { id: "oldtown", name: "Старый город", code: "O-12", x: 19, y: 53, tone: "orange" },
    { id: "river", name: "Набережная", code: "R-03", x: 49, y: 62, tone: "blue" },
    { id: "labs", name: "Технопарк", code: "L-09", x: 79, y: 53, tone: "green" },
    { id: "port", name: "Порт", code: "P-01", x: 69, y: 81, tone: "pink" },
  ],
  rounds: [
    {
      code: "SIG-071",
      title: "Силуэт у последнего поезда",
      time: "23:41",
      correct: "metro",
      image: "/evidence/evidence-cctv-metro-exit.webp",
      imageWidth: 1280,
      imageHeight: 720,
      hotspots: [
        { x: 73, y: 42, action: "Осмотреть отражение в луже" },
        { x: 28, y: 68, action: "Сверить жест и часы камеры" },
        { x: 46, y: 18, action: "Понять, зачем фигура остановилась" },
      ],
      source: "Камера 07 / внешний контур",
      summary:
        "Камера заметила человека за четыре минуты до отключения городского контура. Лицо скрыто, направление движения не определено.",
      details: [
        "Фиолетовый контур в луже не совпадает со светом уличных фонарей.",
        "Часы камеры отстают от жеста на запястье на четыре минуты.",
        "Фигура стоит, пока этот контур не оказывается в кадре, и только потом показывает на часы.",
      ],
      hint: "Один факт ничего не решает. Сверьте свет, которого нет у фонарей, со сдвигом часов — и только потом выбирайте район.",
      trace: "23:41 → M-07",
      analystHint: {
        insight: "Код служебного входа совпадает с линией, чей свет лежит в луже. Названия станции в этом коде нет.",
        discuss: "Спросите, какой свет на кадре не может быть уличным фонарём, и сравните его с отставанием часов.",
      },
      deduction: {
        question: "Какие два факта вместе объясняют остановку в кадре?",
        options: ["Капюшон и мокрые ступени", "Чужой световой контур и сдвиг часов", "Дождь и тёмный фон"],
        correct: 1,
        success: "Фигура дождалась чужого контура в луже и показала на часы, которые отстают на четыре минуты. Такой контур остаётся у ночной служебной линии, а не у фонарей. Это вход Метро-7.",
      },
    },
    {
      code: "OBJ-214",
      title: "Повреждённая карта доступа",
      time: "00:06",
      correct: "river",
      image: "/evidence/evidence-access-card-glass.webp",
      imageWidth: 1280,
      imageHeight: 960,
      hotspots: [
        { x: 61, y: 48, action: "Осмотреть магнитную полосу" },
        { x: 26, y: 76, action: "Сверить серию пропуска с архивом" },
        { x: 78, y: 22, action: "Прислушаться к фону записи" },
      ],
      source: "Патруль 12 / вещественное доказательство",
      summary:
        "Найдена карта B-14 с осколком фиолетового стекла. Такой пропуск использовали на закрытых терминалах, которые давно сняли с учёта.",
      details: [
        "На магнитной полосе — соль и металлическая пыль, не городская грязь.",
        "Серия B-14 снята с учёта пять лет назад вместе со старыми складскими терминалами.",
        "Низкий гул на записи похож на воду у борта, а не на поезд под землёй.",
      ],
      hint: "Соль на полосе сама по себе не называет район. Сверьте её с шумом на записи и с тем, какие терминалы сняли вместе с серией B-14.",
      trace: "00:06 → R-03",
      analystHint: {
        insight: "Под стёртым именем виден знак каната, как у швартовой тумбы, а не как у турникета.",
        discuss: "Попросите сравнить шум на записи с солью на полосе и сказать, на что похож этот знак: на причал или на вход в поезд.",
      },
      deduction: {
        question: "Какие два факта вместе указывают на место находки?",
        options: ["Соль на полосе и гул воды у борта", "Современный офисный чип", "Жилой подъезд без промышленного шума"],
        correct: 0,
        success: "Соль с металлической пылью и гул воды у борта не сходятся с поездом. Серия B-14 ушла с учёта вместе со старыми терминалами у воды. Это склады Набережной.",
      },
    },
    {
      code: "CAM-909",
      title: "Красный свет на складе",
      time: "00:31",
      correct: "port",
      image: "/evidence/evidence-warehouse-riverside.webp",
      imageWidth: 1280,
      imageHeight: 720,
      hotspots: [
        { x: 61, y: 39, action: "Осмотреть след на воде" },
        { x: 22, y: 38, action: "Проверить, где горит красный свет" },
        { x: 84, y: 62, action: "Найти место, где обрывается сигнал" },
      ],
      source: "Дрон 03 / дальний визуальный канал",
      summary:
        "Дрон зафиксировал заброшенный склад и второй силуэт. Красный свет горит только в одной секции и гаснет, когда сигнал уходит с городской сети.",
      details: [
        "На воде узкий след короткого борта, не широкой баржи.",
        "Красный свет горит только в одной секции — как створ ворот, а не витрина.",
        "Сигнал обрывается там, где городская сеть уступает открытой воде.",
      ],
      hint: "Не выбирайте район по одному складу. Короткий борт и свет в одной секции должны указывать в одно и то же место.",
      trace: "00:31 → P-01",
      analystHint: {
        insight: "Вторая фигура не оставляет следов на настиле: её подняли с борта, а не вывели пешком.",
        discuss: "Спросите, чем узкий след на воде отличается от широкой баржи и почему свет горит только в одной секции.",
      },
      deduction: {
        question: "Какие два факта вместе замыкают маршрут?",
        options: ["Пеший переход через освещённый двор", "Широкая баржа и витринный свет", "Короткий борт, затем створ ворот"],
        correct: 2,
        success: "Узкий след короткого борта обрывается у створа, где красный свет горит только в одной секции. Дальше городская сеть уступает открытой воде. Это Порт.",
      },
    },
  ],
  teamVotes: {
    0: [{ agent: "К", district: "metro" }, { agent: "М", district: "north" }, { agent: "К", district: "metro" }],
    1: [{ agent: "К", district: "river" }, { agent: "М", district: "oldtown" }, { agent: "К", district: "river" }],
    2: [{ agent: "К", district: "port" }, { agent: "М", district: "labs" }, { agent: "К", district: "port" }],
  },
  abilityEliminations: ["oldtown", "labs", "north"],
  chatIntro: [
    "Камеры дали много шума. Смотрите не на силуэт, а на окружение.",
    "Я отмечу районы, где ночью ещё работают служебные входы.",
  ],
  signalSound: "alert",
  threatCopy: ["Контур стабилен", "Фантом меняет маршрут", "Критический уровень"],
  final: {
    question: "Где скрывается Фантом?",
    description: "У вас одна попытка. Сопоставьте три сигнала и укажите финальную точку.",
    choices: ["north", "labs", "port"],
    correct: "port",
    hint: "Сложите три уже подтверждённых следа. Верная точка объясняет все три сразу; один след без двух других — ложный район.",
    successTitle: "ФАНТОМ ОБНАРУЖЕН",
    failureTitle: "ФАНТОМ СКРЫЛСЯ",
    successText:
      "Команда вычислила склад P-01 до смены маршрута. На месте остался только терминал, но личность Фантома теперь можно установить.",
    insufficientText: "Точка верна, но доказательств недостаточно: Фантом успел стереть маршрут.",
    wrongText: "Вы выбрали ложную точку. В 00:44 городской контур потерял сигнал у портовых ворот.",
    networkLostText: "Угроза достигла критического уровня: Фантом разорвал городской контур раньше, чем группа закончила операцию.",
  },
};

const zeroStation: GameCase = {
  id: "02",
  title: "Нулевая станция",
  subtitle: "Поезд, которого нет",
  operationTitle: "Исчезнувший состав",
  briefing:
    "Последний поезд исчез между двумя станциями. Камеры не видели аварии, но из пустого состава продолжают поступать сообщения пассажиров.",
  rulesTitle: "Как найти Нулевую станцию",
  rulesGoal: "Восстановите хронологию поезда и найдите скрытую ветку до того, как диспетчерская сотрёт маршрут.",
  target: {
    code: "СОСТАВ #000",
    name: "НОЧНОЙ РЕЙС",
    label: "МАРШРУТ НЕ СУЩЕСТВУЕТ",
    description:
      "Поезд появляется в журналах каждые девять лет. Он не числится в расписании и всегда прибывает без пассажиров.",
  },
  mechanic: {
    name: "Нулевая хронология",
    description: "После каждой дедукции фиксируется время и сектор. Три отметки восстановят настоящий маршрут состава.",
  },
  districts: [
    { id: "terminal", name: "Вокзальная", code: "S-01", x: 24, y: 18, tone: "orange" },
    { id: "ring", name: "Кольцевая", code: "K-08", x: 67, y: 21, tone: "cyan" },
    { id: "oldline", name: "Старая ветка", code: "A-00", x: 18, y: 55, tone: "violet" },
    { id: "hub", name: "Служебный узел", code: "T-12", x: 49, y: 62, tone: "blue" },
    { id: "depot", name: "Депо Север", code: "D-03", x: 80, y: 52, tone: "green" },
    { id: "zero", name: "Нулевая", code: "Z-00", x: 69, y: 81, tone: "pink" },
  ],
  rounds: [
    {
      code: "TIME-000",
      title: "Платформа после полуночи",
      time: "00:00",
      correct: "ring",
      image: "/evidence/case-02-platform.webp",
      imageWidth: 1280,
      imageHeight: 720,
      hotspots: [{ x: 59, y: 22 }, { x: 22, y: 48 }],
      source: "Камера K-08 / архивный поток",
      summary:
        "В полночь платформа оказалась пустой. Часы остановились ровно на 00:00, а маршрутная схема показывает ветку, которой нет на официальной карте.",
      details: [
        "Часы замерли в момент потери состава",
        "На схеме появилась лишняя фиолетовая ветка",
        "Тоннель освещён, хотя питание отключено",
      ],
      hint: "Начните с единственной станции, где камера и часы отключились одновременно.",
      trace: "00:00 → K-08",
      deduction: {
        question: "Что доказывает, что поезд свернул с обычного маршрута?",
        options: ["Мокрый пол", "Лишняя ветка на схеме и остановившиеся часы", "Пустая скамейка"],
        correct: 1,
        success: "В 00:00 состав покинул Кольцевую через скрытый обходной путь.",
      },
    },
    {
      code: "CAR-003",
      title: "Вагон без пассажиров",
      time: "00:07",
      correct: "depot",
      image: "/evidence/case-02-carriage.webp",
      imageWidth: 1280,
      imageHeight: 960,
      hotspots: [{ x: 50, y: 75 }, { x: 74, y: 64 }],
      source: "Состав 000 / внутренний регистратор",
      summary:
        "Поезд прибыл пустым. Следы обуви обрываются в центре вагона, а технический люк открыт инструментом из северного депо.",
      details: [
        "Следы заканчиваются до ближайшей двери",
        "На люке — свежая оранжевая смазка депо D-03",
        "Аварийный указатель переведён на обходной путь",
      ],
      hint: "Смазку такого цвета используют только бригады, обслуживающие северный сектор.",
      trace: "00:07 → D-03",
      deduction: {
        question: "Где состав мог получить доступ к скрытому обходу?",
        options: ["На пассажирской платформе", "В Депо Север через открытый техлюк", "На Вокзальной после прибытия"],
        correct: 1,
        success: "Технический доступ D-03 связывает вагон с закрытой веткой депо.",
      },
    },
    {
      code: "ZERO-12",
      title: "Станция за служебной дверью",
      time: "00:12",
      correct: "zero",
      image: "/evidence/case-02-zero-station.webp",
      imageWidth: 1280,
      imageHeight: 720,
      hotspots: [{ x: 26, y: 46 }, { x: 67, y: 39 }],
      source: "Диспетчерский дрон / закрытый тоннель",
      summary:
        "За старой решёткой обнаружена действующая платформа с номером 0. Контактный рельс запитан, а свежие следы колёс уходят в тёмный тоннель.",
      details: [
        "Зелёный индикатор подтверждает питание рельса",
        "На стене сохранился знак станции 0",
        "Решётку открывали менее часа назад",
      ],
      hint: "Финальная точка должна объяснить и скрытую ветку, и питание, и номер на старой стене.",
      trace: "00:12 → Z-00",
      deduction: {
        question: "Что находится за открытой служебной решёткой?",
        options: ["Заброшенный склад", "Обычная пересадка", "Скрытая действующая станция Z-00"],
        correct: 2,
        success: "Питание рельса и знак 0 подтверждают существование Нулевой станции.",
      },
    },
  ],
  teamVotes: {
    0: [{ agent: "К", district: "ring" }, { agent: "М", district: "terminal" }, { agent: "К", district: "ring" }],
    1: [{ agent: "К", district: "depot" }, { agent: "М", district: "hub" }, { agent: "К", district: "depot" }],
    2: [{ agent: "К", district: "zero" }, { agent: "М", district: "oldline" }, { agent: "К", district: "zero" }],
  },
  abilityEliminations: ["oldline", "terminal", "hub"],
  chatIntro: [
    "У нас расходятся часы камер. Фиксируйте не только место, но и точное время.",
    "Проверяю закрытые ветки. Официальная схема явно что-то скрывает.",
  ],
  signalSound: "transit",
  threatCopy: ["Маршрут читается", "Диспетчер стирает журнал", "Состав уходит из сети"],
  final: {
    question: "Куда ушёл состав 000?",
    description: "У вас одна попытка. Соедините три временные отметки и назовите конечную станцию.",
    choices: ["oldline", "hub", "zero"],
    correct: "zero",
    hint: "Какая точка объясняет лишнюю ветку, доступ из депо и действующий рельс за знаком 0?",
    successTitle: "НУЛЕВАЯ СТАНЦИЯ НАЙДЕНА",
    failureTitle: "СОСТАВ СНОВА ИСЧЕЗ",
    successText:
      "Команда восстановила маршрут K-08 → D-03 → Z-00. Состав найден у скрытой платформы, а пассажирские сообщения оказались автоматической записью девятилетней давности.",
    insufficientText: "Станция выбрана верно, но в хронологии слишком много разрывов — диспетчерская успела закрыть тоннель.",
    wrongText: "Вы выбрали ложную ветку. В 00:16 состав 000 исчез из энергосети вместе с последней записью маршрута.",
    networkLostText: "Уровень угрозы достиг максимума: диспетчерская стёрла журнал и обесточила скрытую ветку.",
  },
};

export const gameCases: Record<GameCase["id"], GameCase> = {
  "01": phantom,
  "02": zeroStation,
  ...extraGameCases,
};
