import type { ActivityCategoryId, TaskType } from '../types'

export type { ActivityCategoryId }

/**
 * Формат: "taskType|word" — действие и слово заданы вместе, чередуются Покажи/Объясни/Нарисуй.
 * show = Покажи, explain = Объясни, draw = Нарисуй
 */
export type ActivityCategory = {
  id: ActivityCategoryId
  title: string
  emoji: string
  icon: string
  paid: boolean
  words: string[]
}

const EMOTIONS_WORDS = [
  'show|Радость', 'explain|Грусть', 'draw|Удивление', 'show|Скука', 'explain|Стыд', 'draw|Гордость', 'show|Вина', 'explain|Любопытство', 'draw|Смущение', 'show|Обида',
  'explain|Ревность', 'draw|Зависть', 'show|Нежность', 'explain|Страсть', 'draw|Влюбленность', 'show|Безразличие', 'explain|Сочувствие', 'draw|Жалость', 'show|Презрение', 'explain|Высокомерие',
  'draw|Паника', 'show|Тревога', 'explain|Спокойствие', 'draw|Умиротворение', 'show|Усталость', 'explain|Бодрость', 'draw|Разочарование', 'show|Облегчение', 'explain|Надежда', 'draw|Отчаяние',
  'show|Воодушевление', 'explain|Апатия', 'draw|Тоска', 'show|Скорбь', 'explain|Ликование', 'draw|Злорадство', 'show|Ирония', 'explain|Сарказм', 'draw|Сомнение', 'show|Уверенность',
  'explain|Нерешительность', 'draw|Упрямство', 'show|Покорность', 'explain|Благодарность', 'draw|Озарение', 'show|Вдохновение', 'explain|Экстаз', 'draw|Меланхолия', 'show|Истерика', 'explain|Каприз',
  'draw|Напряжение', 'show|Расслабление', 'explain|Одиночество', 'draw|Ностальгия', 'show|Мстительность', 'explain|Досада', 'draw|Предвкушение', 'show|Азарт', 'explain|Кураж', 'draw|Приязнь',
  'show|Уважение', 'explain|Благоговение', 'draw|Робость', 'show|Смелость', 'explain|Отвага', 'draw|Нирвана', 'show|Трепет', 'explain|Эмпатия', 'draw|Симпатия', 'show|Антипатия',
  'explain|Обожание', 'draw|Испуг', 'show|Наслаждение', 'explain|Удовлетворение', 'draw|Замешательство', 'show|Ненависть', 'explain|Холоднокровие', 'draw|Равнодушие', 'show|Безмятежность', 'explain|Мнительность',
  'draw|Ехидство', 'show|Смирение', 'explain|Отчуждение', 'draw|Возмущение', 'show|Злость', 'explain|Ужас', 'draw|Тревожность', 'show|Оцепенение', 'explain|Изнеможение', 'draw|Потрясение',
  'show|Изумление', 'explain|Скромность', 'draw|Надменность', 'show|Умиление', 'explain|Брезгливость', 'draw|Негодование', 'show|Ошеломление', 'explain|Восхищение', 'draw|Свирепость', 'show|Благодать',
]

const BEHAVIORS_WORDS = [
  'explain|Лицемерие', 'draw|Сплетничество', 'show|Подглядывание', 'explain|Подслушивание', 'draw|Хвастовство', 'show|Нытье', 'explain|Командование', 'draw|Подчинение', 'show|Перепалка', 'explain|Оправдание',
  'draw|Раскаяние', 'show|Угроза', 'explain|Шантаж', 'draw|Лесть', 'show|Кокетство', 'explain|Флирт', 'draw|Игнорирование', 'show|Заискивание', 'explain|Дерзость', 'draw|Хамство',
  'show|Помощь', 'explain|Отвлечение', 'draw|Медитация', 'show|Марширование', 'explain|Хромота', 'draw|Кувырок', 'show|Карабканье', 'explain|Ныряние', 'draw|Защита', 'show|Уворот',
  'explain|Прятки', 'draw|Поиск', 'show|Преследование', 'explain|Красование', 'draw|Позирование', 'show|Кривляние', 'explain|Передразнивание', 'draw|Дразнение', 'show|Утешение', 'explain|Обнимание',
  'draw|Поглаживание', 'show|Щекотка', 'explain|Щипание', 'draw|Укус', 'show|Царапание', 'explain|Толкание', 'draw|Жонглирование', 'show|Балансирование', 'explain|Подмигивание', 'draw|Потягивание',
  'show|Чесание', 'explain|Расчесывание', 'draw|Бритье', 'show|Умывание', 'explain|Облизывание', 'draw|Пережевывание', 'show|Сглатывание', 'explain|Выплевывание', 'draw|Покашливание', 'show|Сморкание',
  'explain|Свист', 'draw|Пение', 'show|Шепот', 'explain|Бормотание', 'draw|Крик', 'show|Визг', 'explain|Рычание', 'draw|Шипение', 'show|Мурлыкание', 'explain|Кряхтение',
  'draw|Вздох', 'show|Сопение', 'explain|Чавканье', 'draw|Прихлебывание', 'show|Кража', 'explain|Упрашивание', 'draw|Парирование', 'show|Атака', 'explain|Догонялки', 'draw|Выслеживание',
  'show|Жмурки', 'explain|Вытирание', 'draw|Плевок', 'show|Стояние', 'explain|Сидение', 'draw|Лежание', 'show|Прыжок', 'explain|Бег', 'draw|Ходьба', 'show|Поклон',
  'explain|Реверанс', 'draw|Приседание', 'show|Отжимание', 'explain|Подтягивание', 'draw|Плавание', 'show|Полет', 'explain|Падение', 'draw|Скольжение', 'show|Торможение', 'explain|Разгон',
]

const CHARACTERS_WORDS = [
  'draw|Дед Мороз', 'show|Снегурочка', 'explain|Баба Яга', 'draw|Кощей', 'show|Горыныч', 'explain|Леший', 'draw|Водяной', 'show|Домовой', 'explain|Русалочка', 'draw|Золушка',
  'show|Белоснежка', 'explain|Рапунцель', 'draw|Буратино', 'show|Мальвина', 'explain|Пьеро', 'draw|Карабас', 'show|Чиполлино', 'explain|Карлсон', 'draw|Пятачок', 'show|Чебурашка',
  'explain|Шапокляк', 'draw|Маугли', 'show|Балу', 'explain|Багира', 'draw|Тарзан', 'show|Робин Гуд', 'explain|Дон Кихот', 'draw|Холмс', 'show|Ватсон', 'explain|Франкенштейн',
  'draw|Дракула', 'show|Геракл', 'explain|Зевс', 'draw|Афина', 'show|Посейдон', 'explain|Аид', 'draw|Клеопатра', 'show|Цезарь', 'explain|Наполеон', 'draw|Чингисхан',
  'show|Петр Первый', 'explain|Пушкин', 'draw|Гоголь', 'show|Толстой', 'explain|Шекспир', 'draw|Моцарт', 'show|Бетховен', 'explain|Эйнштейн', 'draw|Ньютон', 'show|Менделеев',
  'explain|Гагарин', 'draw|Колумб', 'show|Леонардо', 'explain|Пикассо', 'draw|Ван Гог', 'show|Дали', 'explain|Чаплин', 'draw|Мэрилин', 'show|Элвис', 'explain|Джексон',
  'draw|Мадонна', 'show|Мерлин', 'explain|Артур', 'draw|Ланселот', 'show|Гулливер', 'explain|Мюнхгаузен', 'draw|Алиса', 'show|Шляпник', 'explain|Чеширский Кот', 'draw|Питер Пэн',
  'show|Крюк', 'explain|Крузо', 'draw|Пятница', 'show|Дартаньян', 'explain|Атос', 'draw|Портос', 'show|Миледи', 'explain|Зорро', 'draw|Ромео', 'show|Джульетта',
  'explain|Отелло', 'draw|Гамлет', 'show|Сократ', 'explain|Аристотель', 'draw|Пифагор', 'show|Архимед', 'explain|Галилей', 'draw|Нефертити', 'show|Мумия', 'explain|Фараон',
  'draw|Гладиатор', 'show|Самурай', 'explain|Ниндзя', 'draw|Викинг', 'show|Рыцарь', 'explain|Корсар', 'draw|Ковбой', 'show|Шериф', 'explain|Индеец', 'draw|Вождь',
]

const LIFE_SITUATIONS_WORDS = [
  'show|Покупка хлеба', 'explain|Вынос мусора', 'draw|Глажка белья', 'show|Завязывание галстука', 'explain|Чистка ковра', 'draw|Полив цветов', 'show|Сборка мебели', 'explain|Покраска забора', 'draw|Колка дров', 'show|Разжигание костра',
  'explain|Установка палатки', 'draw|Рыбалка на озере', 'show|Сбор грибов', 'explain|Лепка снеговика', 'draw|Игра в снежки', 'show|Катание на санках', 'explain|Запуск змея', 'draw|Пускание пузырей', 'show|Прыжки на батуте', 'explain|Плавание в бассейне',
  'draw|Загар на пляже', 'show|Постройка замка', 'explain|Поиск ракушек', 'draw|Кормление голубей', 'show|Выгул питомца', 'explain|Дрессировка щенка', 'draw|Ловля бабочек', 'show|Сбор ягод', 'explain|Варка варенья', 'draw|Жарка блинов',
  'show|Лепка пельменей', 'explain|Нарезка салата', 'draw|Запекание курицы', 'show|Заварка чая', 'explain|Кофе в постель', 'draw|Завтрак на траве', 'show|Пикник в лесу', 'explain|Поход в горы', 'draw|Сплав по реке', 'show|Прыжок с парашютом',
  'explain|Катание верхом', 'draw|Дойка коровы', 'show|Стрижка овец', 'explain|Посадка дерева', 'draw|Прополка грядок', 'show|Сбор урожая', 'explain|Уборка листьев', 'draw|Расчистка сугробов', 'show|Украшение елки', 'explain|Упаковка подарка',
  'draw|Распаковка посылки', 'show|Примерка обуви', 'explain|Ожидание автобуса', 'draw|Поездка в метро', 'show|Полет на лайнере', 'explain|Досмотр багажа', 'draw|Заселение в гостиницу', 'show|Выписка из палаты', 'explain|Прием у доктора', 'draw|Сдача крови',
  'show|Измерение температуры', 'explain|Наложение гипса', 'draw|Снятие швов', 'show|Пломбирование зуба', 'explain|Удаление кариеса', 'draw|Проверка зрения', 'show|Подбор очков', 'explain|Стрижка ногтей', 'draw|Маникюр в салоне', 'show|Массаж спины',
  'explain|Купание в проруби', 'draw|Обливание водой', 'show|Хождение по углям', 'explain|Йога на коврике', 'draw|Шпагат', 'show|Поднятие штанги', 'explain|Бег на дорожке', 'draw|Езда на велосипеде', 'show|Накачивание шин', 'explain|Заправка топливом',
  'draw|Мойка кузова', 'show|Полировка капота', 'explain|Замена масла', 'draw|Починка двигателя', 'show|Штукатурка стен', 'explain|Поклейка обоев', 'draw|Укладка плитки', 'show|Забивание гвоздя', 'explain|Сверление стены', 'draw|Замена лампочки',
  'show|Вытирание пыли', 'explain|Подметание пола', 'draw|Мытье окон', 'show|Стирка белья', 'explain|Развешивание одежды', 'draw|Смена пододеяльника', 'show|Застилание кровати', 'explain|Чтение газеты', 'draw|Разгадывание кроссворда', 'show|Вязание шарфа',
]

const AWKWARD_MOMENTS_WORDS = [
  'explain|Порвал штаны', 'draw|Ошибся именем', 'show|Помахал незнакомцу', 'explain|Застряла пища', 'draw|Заурчал живот', 'show|Громко пукнул', 'explain|Чихнул в лицо', 'draw|Забыл текст', 'show|Споткнулся на сцене', 'explain|Рухнул в лужу',
  'draw|Зашел в женский', 'show|Открыта ширинка', 'explain|Капля на рубашке', 'draw|Облился соком', 'show|Брызнула слюна', 'explain|Застрял с начальником', 'draw|Оставил бумажник', 'show|Кредитка заблокирована', 'explain|Не хватило мелочи', 'draw|Набрал бывшей',
  'show|Назвал мамой', 'explain|Уснул на совещании', 'draw|Захрапел на сеансе', 'show|Свалился со стула', 'explain|Скрипнула мебель', 'draw|Чужой локон', 'show|Поперхнулся водой', 'explain|Сморозил глупость', 'draw|Пошутил в тишине', 'show|Смех без причины',
  'explain|Забыл поздравить', 'draw|Перепутал близнецов', 'show|Обознался со спины', 'explain|Обнял манекен', 'draw|Врезался в стекло', 'show|Заглючил турникет', 'explain|Прищемило дверью', 'draw|Перевернул поднос', 'show|Разнес витрину', 'explain|Взвыла сигнализация',
  'draw|Пискнули рамки', 'show|Остановка ДПС', 'explain|Проезд зайцем', 'draw|Выронил проездной', 'show|Занял чужое', 'explain|Выгнали из зала', 'draw|Громкий рингтон', 'show|Звонок во время спектакля', 'explain|Вспышка в музее', 'draw|Голый на фоне',
  'show|Ковырял в ноздре', 'explain|Засорился унитаз', 'draw|Забилась раковина', 'show|Лопнула труба', 'explain|Затопил снизу', 'draw|Стук по батарее', 'show|Вышел в полотенце', 'explain|Захлопнулся замок', 'draw|Сломалась отмычка', 'show|Забыл пинкод',
  'explain|Облаяла дворняга', 'draw|Отдавил лапу', 'show|Питомец наблевал', 'explain|Вступил в кучу', 'draw|Чайка нагадила', 'show|Измазался краской', 'explain|Окрашенная скамейка', 'draw|Прилипла жвачка', 'show|Прорвалось дно', 'explain|Рассыпал крупу',
  'draw|Разбил сервиз', 'show|Потекла паста', 'explain|Чумазые ладони', 'draw|Разошлась молния', 'show|Отлетела заклепка', 'explain|Слез кроссовок', 'draw|Расстегнулась застежка', 'show|Поехала стрелка', 'explain|Следы от пота', 'draw|Траур под ногтями',
  'show|Торчит нитка', 'explain|Потекла тушь', 'draw|Помада на клыках', 'show|Зелень в зубах', 'explain|Зацепился воротником', 'draw|Сломалась шпилька', 'show|Поехал на эскалаторе', 'explain|Снесло с беговой дорожки', 'draw|Выронил гантелю', 'show|Проиграл младенцу',
  'explain|Нелепый комплимент', 'draw|Утерян доступ', 'show|Отправил не в тот чат', 'explain|Испортил чужое', 'draw|Сел мимо пуфика', 'show|Сдуло парик', 'explain|Выпала челюсть', 'draw|Улетела шляпа', 'show|Вывернуло зонтик', 'explain|Отдавил мизинец',
]

const COMMUNICATION_WORDS = [
  'draw|Приветствие', 'show|Прощание', 'explain|Комплимент', 'draw|Оскорбление', 'show|Дискуссия', 'explain|Интервью', 'draw|Допрос', 'show|Исповедь', 'explain|Признание', 'draw|Обещание',
  'show|Зарок', 'explain|Мольба', 'draw|Просьба', 'show|Приказ', 'explain|Совет', 'draw|Рекомендация', 'show|Предупреждение', 'explain|Намек', 'draw|Шутка', 'show|Байка',
  'explain|Тост', 'draw|Речь', 'show|Доклад', 'explain|Презентация', 'draw|Лекция', 'show|Семинар', 'explain|Проповедь', 'draw|Сплетня', 'show|Слух', 'explain|Тайна',
  'draw|Секрет', 'show|Откровение', 'explain|Жалоба', 'draw|Донос', 'show|Кляуза', 'explain|Заявление', 'draw|Рапорт', 'show|Отчет', 'explain|Резюме', 'draw|Переговоры',
  'show|Сделка', 'explain|Договор', 'draw|Торг', 'show|Уговоры', 'explain|Отказ', 'draw|Согласие', 'show|Разрешение', 'explain|Запрет', 'draw|Вето', 'show|Бойкот',
  'explain|Протест', 'draw|Митинг', 'show|Забастовка', 'explain|Голосование', 'draw|Выборы', 'show|Дебаты', 'explain|Свидание', 'draw|Знакомство', 'show|Подкат', 'explain|Отшивание',
  'draw|Разрыв', 'show|Ссора', 'explain|Примирение', 'draw|Соболезнование', 'show|Поздравление', 'explain|Похвала', 'draw|Одобрение', 'show|Осуждение', 'explain|Критика', 'draw|Наглость',
  'show|Вежливость', 'explain|Тактичность', 'draw|Бестактность', 'show|Навязчивость', 'explain|Молчание', 'draw|Плач', 'show|Рыдание', 'explain|Смех', 'draw|Хохот', 'show|Улыбка',
  'explain|Усмешка', 'draw|Оскал', 'show|Гримаса', 'explain|Кивок', 'draw|Рукопожатие', 'show|Объятие', 'explain|Поцелуй', 'draw|Пощечина', 'show|Пинок', 'explain|Подзатыльник',
  'draw|Щелбан', 'show|Клятва на крови', 'explain|Вызов на дуэль', 'draw|Молитва', 'show|Проклятие', 'explain|Благословение', 'draw|Оклик', 'show|Перешептывание', 'explain|Скандирование', 'draw|Овации',
]

const SCENES_WORDS = [
  'show|Ограбление хранилища', 'explain|Спасение принцессы', 'draw|Битва с чудовищем', 'show|Поиск клада', 'explain|Захват заложников', 'draw|Обезвреживание мины', 'show|Погоня по крышам', 'explain|Перестрелка в салуне', 'draw|Дуэль на револьверах', 'show|Сражение на мечах',
  'explain|Похищение марсианами', 'draw|Падение астероида', 'show|Извержение магмы', 'explain|Землетрясение в мегаполисе', 'draw|Гигантская волна', 'show|Крушение лайнера', 'explain|Высадка на орбиту', 'draw|Контакт с гуманоидами', 'show|Тестирование машины времени', 'explain|Восстание киборгов',
  'draw|Апокалипсис мутантов', 'show|Вторжение полтергейста', 'explain|Изгнание демона', 'draw|Суд инквизиции', 'show|Казнь на эшафоте', 'explain|Побег из темницы', 'draw|Допрос шпиона', 'show|Засада партизан', 'explain|Секретная операция', 'draw|Вскрытие сейфа',
  'show|Похищение шедевра', 'explain|Передача дипломата', 'draw|Явка с повинной', 'show|Слежка из фургона', 'explain|Раскрытие алиби', 'draw|Чтение завещания', 'show|Дележка наследства', 'explain|Скандальный развод', 'draw|Предложение кольца', 'show|Венчание у алтаря',
  'explain|Полет букета', 'draw|Вальс молодоженов', 'show|Разрезание каравая', 'explain|Появление младенца', 'draw|Рождение сверхновой', 'show|Школьный вальс', 'explain|Вручение аттестата', 'draw|Защита проекта', 'show|Вручение статуэтки', 'explain|Дефиле по дорожке',
  'draw|Соло на гитаре', 'show|Партия в балете', 'explain|Премьера в опере', 'draw|Номер под куполом', 'show|Иллюзия с распиливанием', 'explain|Прыжок сквозь обруч', 'draw|Реприза жонглера', 'show|Апперкот на ринге', 'explain|Нокаут в челюсть', 'draw|Пенальти в ворота',
  'show|Решающий бросок', 'explain|Пьедестал почета', 'draw|Зажжение огня', 'show|Передача эстафеты', 'explain|Прыжок с шестом', 'draw|Марафонский финиш', 'show|Занос на повороте', 'explain|Смена колес', 'draw|Дым из-под капота', 'show|Пробоина в трюме',
  'explain|Абордаж корсаров', 'draw|Захват судна', 'show|Поиск источника', 'explain|Иллюзия в барханах', 'draw|Блуждание в тропиках', 'show|Укус гадюки', 'explain|Вязка плота', 'draw|Трение палочек', 'show|Выкладывание камнями SOS', 'explain|Спуск троса',
  'draw|Столкновение с гризли', 'show|Загон мамонта', 'explain|Шаманский обряд', 'draw|Подношение духам', 'show|Посвящение клинком', 'explain|Турнир конных', 'draw|Штурм башни', 'show|Прорыв баррикады', 'explain|Залп из катапульты', 'draw|Вираж на виверне',
  'show|Открытие портала', 'explain|Варка зелья', 'draw|Мутация в жабу', 'show|Разрушение чар', 'explain|Поцелуй истинной любви', 'draw|Прием во дворце', 'show|Потерянная туфелька', 'explain|Открытие континента', 'draw|Плавник в воде', 'show|Пробуждение саркофага',
]

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { id: 'emotions', title: 'Эмоции', emoji: '😶', icon: 'emotions', paid: false, words: EMOTIONS_WORDS },
  { id: 'behaviors', title: 'Поведение', emoji: '🎭', icon: 'mask', paid: false, words: BEHAVIORS_WORDS },
  { id: 'characters', title: 'Персонажи', emoji: '👤', icon: 'user', paid: false, words: CHARACTERS_WORDS },
  { id: 'lifeSituations', title: 'Ситуации', emoji: '🌍', icon: 'globe', paid: false, words: LIFE_SITUATIONS_WORDS },
  { id: 'awkwardMoments', title: 'Неловкость', emoji: '😅', icon: 'awkward', paid: false, words: AWKWARD_MOMENTS_WORDS },
  { id: 'communication', title: 'Общение', emoji: '💬', icon: 'message', paid: false, words: COMMUNICATION_WORDS },
  { id: 'scenes', title: 'Сцены', emoji: '🎬', icon: 'cinema', paid: false, words: SCENES_WORDS },
]

export function getCategoryById(id: ActivityCategoryId): ActivityCategory | undefined {
  return ACTIVITY_CATEGORIES.find((c) => c.id === id)
}

/** Парсит строку "taskType|word" в { taskType, word }. При ошибке — fallback на explain. */
export function parseActivityItem(item: string): { taskType: TaskType; word: string } {
  const sep = item.indexOf('|')
  if (sep < 0) return { taskType: 'explain', word: item }
  const t = item.slice(0, sep) as TaskType
  const w = item.slice(sep + 1).trim()
  if ((t === 'show' || t === 'explain' || t === 'draw') && w) return { taskType: t, word: w }
  return { taskType: 'explain', word: item }
}

export function pickRandomWord(category: ActivityCategory): string {
  const words = category.words
  const item = words[Math.floor(Math.random() * words.length)] ?? ''
  const { word } = parseActivityItem(item)
  return word
}
