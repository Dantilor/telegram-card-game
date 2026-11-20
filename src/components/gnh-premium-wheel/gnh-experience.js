import { eligibleGames, randomIndex, wheelPool, winningRotation, savings, rub, pluralGames } from './gnh-model.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  spark:'<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  play:'<path d="m9 5 11 7-11 7V5Z"/>',
  wheel:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7m0 4v7M3 12h7m4 0h7M5.6 5.6l5 5m2.8 2.8 5 5m0-12.8-5 5m-2.8 2.8-5 5"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9"/>',
  diamond:'<path d="m7 3-5 6 10 13L22 9l-5-6H7Zm-5 6h20M7 3l5 19 5-19"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
  moon:'<path d="M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z"/>',
  brain:'<path d="M12 4c-3-4-8 0-6 3-5 0-5 7-1 8-1 5 5 7 7 3m0-14c3-4 8 0 6 3 5 0 5 7 1 8 1 5-5 7-7 3V4Z"/>',
  cup:'<path d="M6 3h12v6a6 6 0 0 1-12 0V3Zm0 2H3v3a4 4 0 0 0 4 4m11-7h3v3a4 4 0 0 1-4 4M12 15v6m-4 0h8"/>',
  home:'<path d="m3 10 9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z"/>'
};
const icon = (name, cls='') => `<svg class="gnh-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.spark}</svg>`;

export function mountGnhExperience(root, options = {}) {
  if (!root) throw new Error('A mount element is required');
  const catalog = options.catalog ?? [];
  const plans = options.plans ?? [];
  const assets = options.assetBase ?? './assets/';
  const uid = `gnh-${Math.random().toString(36).slice(2,9)}`;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const plansFocus = options.initialView === 'plans';
  const state = {view:options.initialView === 'wheel' ? 'wheel' : 'premium',players:6,mood:'any',minutes:0,rotation:0,spinning:false,result:null,pool:[],timer:null,toast:null,destroyed:false};
  let dialog = null;
  let opener = null;
  const hasPremium = () => typeof options.isPremium === 'function' ? options.isPremium() : Boolean(options.isPremium);
  root.classList.add('gnh-experience');
  root.style.setProperty('--gnh-ambient', `url("${assets.replace(/["\\\n\r]/g,'')}ambient.webp")`);

  function notify(message) {
    const node = root.querySelector('.gnh-toast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(state.toast);
    state.toast = setTimeout(() => { if (!state.destroyed) node.hidden = true; }, 4500);
  }
  function closeDialog() {
    if (!dialog) return;
    dialog.close();
  }
  function openDialog(content, label) {
    closeDialog();
    opener = root.contains(document.activeElement) ? document.activeElement : null;
    dialog = document.createElement('dialog');
    dialog.className = 'gnh-dialog';
    dialog.setAttribute('aria-label', label);
    dialog.innerHTML = `<button class="gnh-close" data-action="close-dialog" aria-label="Закрыть">${icon('close')}</button>${content}`;
    root.append(dialog);
    const current = dialog;
    const restore = opener;
    current.addEventListener('close', () => {
      current.remove();
      if (dialog === current) dialog = null;
      if (restore?.isConnected) restore.focus({preventScroll:true});
    }, {once:true});
    current.addEventListener('click', event => {
      if (event.target !== current) return;
      const box = current.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog();
    });
    current.showModal();
  }
  function header() {
    return `<header class="gnh-header"><button class="gnh-brand" data-action="go-home" aria-label="GameNight Host, на главную"><img src="${esc(assets)}brand.webp" alt="" width="44" height="44"><span>GameNight <b>Host</b></span></button><nav class="gnh-tabs" aria-label="Разделы макета"><button data-action="view-premium" ${state.view==='premium'?'aria-current="page"':''}>${icon('diamond')}<span>Premium</span></button><button data-action="view-wheel" ${state.view==='wheel'?'aria-current="page"':''}>${icon('wheel')}<span>Колесо игр</span></button></nav><button type="button" class="gnh-header-home" data-action="go-home" aria-label="На главную">${icon('home')}<span class="gnh-header-home__label">Домой</span></button></header>`;
  }
  function planCards() {
    const short = plans.find(p=>p.days===30);
    if (!plans.length) return '<p class="gnh-muted">Тарифы появятся после загрузки.</p>';
    return plans.map(plan => {
      const saving = short ? savings(short,plan) : 0;
      return `<article class="gnh-plan ${plan.recommended?'gnh-plan-featured':''}">${plan.badge?`<span class="gnh-plan-badge">${esc(plan.badge)}</span>`:''}<div class="gnh-plan-top"><span class="gnh-plan-icon">${icon(plan.days===null?'diamond':plan.days===90?'spark':'moon')}</span><h3>${esc(plan.label)}</h3><p>${esc(plan.description)}</p></div><p class="gnh-price">${esc(rub(plan.price))}</p><p class="gnh-price-term">${plan.days===null?'одна покупка · без продлений':`за ${plan.days} дней · без автопродления`}</p><div class="gnh-saving">${saving?`<del>${esc(rub(short.price * plan.days / short.days))}</del><span>Экономия ${esc(rub(saving))}</span>`:plan.days===null?'':`${icon('heart')} Подойдёт, чтобы попробовать`}</div><ul class="gnh-plan-list"><li>${icon('check')}Все Premium-игры и режимы</li><li>${icon('check')}Гости играют бесплатно</li><li>${icon('check')}Новые игры и обновления</li></ul><button class="gnh-button ${plan.recommended?'gnh-button-primary':'gnh-button-glass'}" data-action="choose-plan" data-plan="${esc(plan.id)}">${esc(plan.cta || 'Выбрать тариф')}</button><span class="gnh-plan-foot">Оплата через YooKassa</span></article>`;
    }).join('');
  }
  function premium() {
    const preferred = options.featuredGameIds ?? ['mafia-shadows','who-is-who','card','sled','russia-travel'];
    const ordered = [...new Set([...preferred.map(id=>catalog.find(g=>g.id===id)).filter(Boolean), ...catalog])];
    const displayGames = ordered.slice(0,3);
    const featured = [...new Set([...['mafia-shadows','who-is-who','sled','russia-travel'].map(id=>catalog.find(g=>g.id===id)).filter(Boolean), ...ordered])].slice(0,4);
    const short = plans.find(p=>p.days===30);
    return `<main class="gnh-main">
      ${state.result?`<div class="gnh-return-banner">${icon('wheel')}<span>Колесо выбрало: <b>${esc(state.result.title)}</b></span><button data-action="view-wheel">К результату</button></div>`:''}
      <section class="gnh-premium-hero" aria-labelledby="${uid}-hero"><div class="gnh-hero-copy"><span class="gnh-eyebrow">${icon('diamond')} GAME NIGHT PREMIUM</span><h1 id="${uid}-hero">Один Premium.<br><span>Играют все.</span></h1><p class="gnh-hero-description">Лучшие игры для компании, пары и друзей.<br>Подписка нужна <strong>только ведущему</strong> —<br class="gnh-desktop-break"> остальные присоединяются бесплатно.</p><div class="gnh-hero-actions"><button class="gnh-button gnh-button-primary" data-action="scroll-plans">${icon('spark')}Выбрать тариф</button><button class="gnh-text-button" data-action="view-wheel">${icon('wheel')}Сначала выбрать игру</button></div><p class="gnh-hero-assurance">${icon('shield')}Без автопродления и скрытых списаний</p></div><div class="gnh-hero-visual" aria-label="Игры для всей компании"><div class="gnh-orbit gnh-orbit-one"></div><div class="gnh-orbit gnh-orbit-two"></div><span class="gnh-orbit-star">✦</span><div class="gnh-stack">${displayGames.map((game,i)=>`<div class="gnh-stack-card gnh-stack-card-${i}"><img src="${esc(game.image)}" alt="" width="1536" height="1024" fetchpriority="${i===1?'high':'auto'}"><div><span>GAME NIGHT</span><b>${esc(game.title)}</b></div></div>`).join('')}</div><div class="gnh-company-pill"><span class="gnh-avatar gnh-host">${icon('diamond')}</span><div><b>Ведущий с Premium</b><span>Одна подписка на всю компанию</span></div><div class="gnh-mini-avatars"><span>А</span><span>М</span><span>Д</span><span>+3</span></div></div><span class="gnh-visual-caption">Больше смеха. Больше историй. Больше вас.</span></div></section>
      <div class="gnh-value-strip"><span>${icon('users')}Платит только ведущий</span><span>${icon('heart')}Друзья играют бесплатно</span><span>${icon('shield')}Без автопродления</span></div>
      <section class="gnh-pricing gnh-section" id="${uid}-plans" aria-labelledby="${uid}-pricing-title"><div class="gnh-section-heading"><div><span class="gnh-eyebrow">ВАШ ПРОПУСК В ХОРОШИЙ ВЕЧЕР</span><h2 id="${uid}-pricing-title">Больше планов на вечер.<br><span>Один понятный тариф.</span></h2></div><p>Все Premium-возможности — в каждом тарифе.<br>Выберите, как долго хотите играть.</p></div><div class="gnh-plans">${planCards()}</div>${short?`<div class="gnh-company-cost"><span class="gnh-cost-icon">${icon('users')}</span><div class="gnh-cost-copy"><b>Вас ${state.players}? Это примерно <span>${esc(rub(short.price/state.players))}</span> на человека</b><p>За ${short.days} дней игр. Полную сумму ${esc(rub(short.price))} оплачивает ведущий.</p></div><div class="gnh-stepper" role="group" aria-label="Размер компании для расчёта"><button data-action="cost-minus" ${state.players<=2?'disabled':''} aria-label="Уменьшить компанию">−</button><output aria-label="Игроков">${state.players}</output><button data-action="cost-plus" ${state.players>=16?'disabled':''} aria-label="Увеличить компанию">+</button></div></div>`:''}</section>
      <section class="gnh-section gnh-included" aria-labelledby="${uid}-included"><div class="gnh-section-heading"><div><span class="gnh-eyebrow">БОЛЬШЕ, ЧЕМ ОДНА ИГРА</span><h2 id="${uid}-included">Под настроение.<br><span>Под вашу компанию.</span></h2></div><p>Шумная вечеринка, свидание или домашний вечер.<br>Хорошая игра найдётся для каждого.</p></div><div class="gnh-game-showcase">${featured.map(game=>`<button class="gnh-showcase-card" data-action="preview-game" data-game="${esc(game.id)}"><div class="gnh-showcase-art"><img src="${esc(game.image)}" alt="" width="1536" height="1024" loading="lazy"><span>${icon('play')}</span></div><b>${esc(game.title)}</b><span>${esc(game.players[0])}–${esc(game.players[1])} игроков · ~${esc(game.minutes)} мин</span></button>`).join('')}</div><div class="gnh-benefit-row"><article>${icon('diamond')}<div><h3>Весь Premium-каталог</h3><p>Больше режимов, механик и историй в одном доступе.</p></div></article><article>${icon('spark')}<div><h3>Новые игры и обновления</h3><p>Возвращайтесь за новыми поводами собраться вместе.</p></div></article><article>${icon('heart')}<div><h3>Для пары и друзей</h3><p>Разговоры по душам, дружеский азарт и много смеха.</p></div></article></div></section>
      <section class="gnh-how gnh-section" aria-labelledby="${uid}-how"><div><span class="gnh-eyebrow">ТРИ ПРОСТЫХ ШАГА</span><h2 id="${uid}-how">От идеи до игры —<br><span>пара минут.</span></h2></div><ol><li><span>1</span><div><h3>Выберите тариф</h3><p>30 дней, 90 дней или одна покупка навсегда.</p></div></li><li><span>2</span><div><h3>Оплатите через YooKassa</h3><p>Доступ открывается после подтверждения успешной оплаты.</p></div></li><li><span>3</span><div><h3>Соберите своих</h3><p>Пригласите друзей. В онлайн-играх они входят по коду бесплатно.</p></div></li></ol></section>
      <section class="gnh-faq gnh-section" aria-labelledby="${uid}-faq"><div><span class="gnh-eyebrow">ВСЁ ПРОЗРАЧНО</span><h2 id="${uid}-faq">Остались <br><span>вопросы?</span></h2><p>Одна оплата, понятные условия.<br>Без неожиданных продлений.</p></div><div class="gnh-faq-list">${[
        ['Premium нужен каждому игроку?','Нет. Достаточно Premium у ведущего. В играх с комнатами остальные подключаются по коду бесплатно. В играх за одним устройством вы играете вместе на устройстве ведущего.'],
        ['Будут ли автоматические списания?','Нет, автопродления нет. Вы оплачиваете только выбранный срок. Продлевать доступ или нет — решаете сами.'],
        ['Когда откроется доступ?','После подтверждения успешной оплаты. Если статус ещё обновляется, действующее приложение проверяет платёж и обновляет доступ.'],
        ['Какой тариф выбрать?', '30 дней — познакомиться с Premium. 90 дней — играть регулярно и сэкономить по сравнению с тремя отдельными покупками на 30 дней. Навсегда — оплатить доступ один раз.']
      ].map(([q,a])=>`<details><summary>${esc(q)}${icon('chevron')}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
      <section class="gnh-finale"><div class="gnh-finale-orb">${icon('wheel')}</div><div><span class="gnh-eyebrow">А ВО ЧТО СЫГРАТЬ?</span><h2>Пусть решит колесо.</h2><p>Укажите компанию и настроение.<br>Мы найдём игру для вашего вечера.</p></div><button class="gnh-button gnh-button-primary" data-action="view-wheel">${icon('wheel')}Подобрать игру</button></section>
    </main>`;
  }
  function wheelSvg(pool) {
    const count = pool.length;
    if (!count) return `<div class="gnh-empty-wheel">${icon('moon')}<span>Пока нет подходящих игр</span></div>`;
    const center=300, radius=286, step=360/count;
    const point=(degrees,r=radius)=>[center+r*Math.sin(degrees*Math.PI/180),center-r*Math.cos(degrees*Math.PI/180)];
    const fills=['#7650ac','#4f526f','#9665a0','#4e6387','#6d478f','#536b89'];
    const paths=pool.map((game,i)=>{
      const [x1,y1]=point(i*step-step/2),[x2,y2]=point(i*step+step/2);
      const d = count===1 ? '' : `M300 300L${x1} ${y1}A286 286 0 ${step>180?1:0} 1 ${x2} ${y2}Z`;
      const lines=String(game.wheelLabel || game.title).split('|').slice(0,3);
      const thumbnail=`<defs><clipPath id="${uid}-thumb-${i}"><rect x="252" y="58" width="96" height="64" rx="10"/></clipPath></defs><image href="${esc(game.image)}" x="252" y="58" width="96" height="64" preserveAspectRatio="xMidYMid meet" clip-path="url(#${uid}-thumb-${i})"/><rect x="252" y="58" width="96" height="64" rx="10" fill="none" stroke="#ecd7ff70" stroke-width="1.5"/>`;
      return `<g>${count===1?`<circle cx="300" cy="300" r="286" fill="${fills[i%6]}"/>`:`<path d="${d}" fill="${fills[i%6]}" stroke="#e5cbff38" stroke-width="1.5"/>`}<g transform="rotate(${i*step} 300 300)">${thumbnail}<text text-anchor="middle" fill="#fff8ff" font-size="${lines.some(s=>s.length>12)?20:24}" font-weight="650">${lines.map((line,j)=>`<tspan x="300" y="${148+j*26}">${esc(line)}</tspan>`).join('')}</text></g></g>`;
    }).join('');
    return `<svg class="gnh-wheel-svg" viewBox="0 0 600 600" role="img" aria-label="Колесо: ${esc(pool.map(g=>g.title).join(', '))}" style="transform:rotate(${state.rotation}deg)"><circle cx="300" cy="300" r="299" fill="#21182e"/>${paths}<circle cx="300" cy="300" r="286" fill="none" stroke="#efceff99" stroke-width="2"/><circle cx="300" cy="300" r="294" fill="none" stroke="#e9d7ff33" stroke-width="5"/></svg>`;
  }
  function wheelResult() {
    const game=state.result;
    if (!game && !eligibleGames(catalog,state).length) return `<div class="gnh-result gnh-result-waiting">${icon('moon')}<div><b>Немного поменяем планы?</b><p>Измените фильтры — и мы подберём варианты для вашей компании.</p></div></div>`;
    if (!game) return state.spinning
      ? `<div class="gnh-result gnh-result-waiting"><div><b>Выбираем вашу следующую игру…</b><p>Немного удачи. И много хорошей компании.</p></div></div>`
      : `<p class="gnh-wheel-footnote">Нажмите «Крутить колесо» и доверьтесь случаю.</p>`;
    return `<article class="gnh-result"><img src="${esc(game.image)}" alt="" width="1536" height="1024"><div class="gnh-result-copy"><span class="gnh-eyebrow">ВАШ ВЫБОР НА СЕГОДНЯ</span><h2>${esc(game.title)}</h2><p>${esc(game.players[0])}–${esc(game.players[1])} игроков · ~${esc(game.minutes)} мин</p><p>${esc(game.description)}</p></div><div class="gnh-result-actions">${game.premium&&!hasPremium()?'<span class="gnh-result-tag">'+icon('diamond')+'Игра с Premium</span>':''}<button class="gnh-button gnh-button-primary" data-action="start-result">${icon(game.premium&&!hasPremium()?'diamond':'play')}${game.premium&&!hasPremium()?'Открыть Premium':'Начать игру'}</button><button class="gnh-text-button" data-action="spin" ${state.spinning?'disabled':''}>${icon('refresh')}Выбрать другую</button></div></article>`;
  }
  function wheel() {
    const eligible=eligibleGames(catalog,state);
    if (!state.pool.length) state.pool=wheelPool(eligible);
    return `<main class="gnh-main gnh-wheel-main"><section class="gnh-wheel-intro"><span class="gnh-eyebrow">${icon('wheel')} КОГДА НЕ МОЖЕТЕ РЕШИТЬ</span><h1>Ваш вечер.<br class="gnh-mobile-break"><span>Выбор за колесом.</span></h1><p>Соберите компанию. Поймайте настроение.<br>Остальное доверьте случаю.</p></section><section class="gnh-roulette-layout" aria-label="Выбор случайной игры"><div class="gnh-filters"><span class="gnh-eyebrow">КАКОЙ У ВАС ПЛАН?</span><fieldset ${state.spinning?'disabled':''}><legend class="gnh-sr-only">Фильтры игр</legend><div class="gnh-filter-group"><h2>${icon('users')}Сколько вас?</h2><div class="gnh-player-picker"><button data-action="players-minus" aria-label="На одного игрока меньше" ${state.players<=2?'disabled':''}>−</button><div><b>${state.players}</b><span>игроков</span></div><button data-action="players-plus" aria-label="На одного игрока больше" ${state.players>=16?'disabled':''}>+</button></div></div><div class="gnh-filter-group"><h2>${icon('heart')}Настроение</h2><div class="gnh-mood-options" role="group" aria-label="Настроение">${[['any','spark','Любое'],['fun','bolt','Посмеяться'],['mystery','moon','Интрига'],['close','heart','Сблизиться'],['brain','brain','Подумать']].map(([value,symbol,label])=>`<button data-action="mood" data-value="${value}" aria-pressed="${state.mood===value}">${icon(symbol)}${label}</button>`).join('')}</div></div><div class="gnh-filter-group"><h2>${icon('clock')}Сколько времени?</h2><div class="gnh-time-options" role="group" aria-label="Время игры">${[[15,'15 мин'],[30,'30 мин'],[60,'60 мин'],[0,'Без спешки']].map(([value,label])=>`<button data-action="time" data-value="${value}" aria-pressed="${state.minutes===value}">${label}</button>`).join('')}</div></div></fieldset><div class="gnh-matches"><span>${icon('spark')}<b>${eligible.length} ${pluralGames(eligible.length)}</b> под ваши планы</span><button data-action="reset-filters" ${state.spinning?'disabled':''}>Сбросить</button></div>${!eligible.length?'<p class="gnh-empty-note">Попробуйте другое настроение, больше времени или измените число игроков.</p>':''}</div><div class="gnh-wheel-play"><div class="gnh-wheel-stage"><div class="gnh-wheel-halo"></div><div class="gnh-wheel-pointer" aria-hidden="true"></div>${wheelSvg(state.pool)}${eligible.length?`<button class="gnh-wheel-center" data-action="spin" aria-label="Крутить колесо" ${state.spinning?'disabled':''}>${icon('spark')}<span>GAME<br>NIGHT</span></button>`:''}<i class="gnh-wheel-star gnh-wheel-star-one">✦</i><i class="gnh-wheel-star gnh-wheel-star-two">✧</i></div><button class="gnh-button gnh-button-primary gnh-spin" data-action="spin" ${state.spinning||!eligible.length?'disabled':''}>${icon('wheel')}${state.spinning?'Колесо выбирает…':'Крутить колесо'}</button><p class="gnh-wheel-footnote">Все подходящие игры участвуют с равным шансом</p></div></section><div class="gnh-wheel-result-area" aria-live="polite" aria-atomic="true">${wheelResult()}</div><section class="gnh-wheel-upgrade"><span class="gnh-upgrade-icon">${icon('diamond')}</span><div><h2>Больше игр — больше вариантов вечера.</h2><p>Один Premium у ведущего. Вся компания играет вместе.</p></div><button class="gnh-button gnh-button-glass" data-action="view-premium">Посмотреть Premium</button></section></main>`;
  }
  function render(focusAction=null) {
    if (state.destroyed) return;
    root.innerHTML=`${options.showHeader!==false?header():''}${state.view==='wheel'?wheel():premium()}${options.showFooter!==false?`<footer class="gnh-footer"><span>GameNight Host <i>✦</i> Собирает людей вместе</span><span>${options.demoMode?'Интерактивный макет · без списания денег':'Без автопродления · оплата через YooKassa'}</span></footer>`:''}<div class="gnh-toast" role="status" hidden></div>`;
    if (focusAction) root.querySelector(`[data-action="${focusAction}"]`)?.focus({preventScroll:true});
  }
  function go(view) {
    if (state.spinning) return;
    closeDialog();
    state.view=view;
    render(`view-${view}`);
    options.onViewChange?.(view);
    root.scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'});
  }
  function updateFilter(action, value) {
    if (state.spinning) return;
    if (action==='mood') state.mood=value;
    if (action==='time') state.minutes=Number(value);
    if (action==='players-minus'||action==='cost-minus') state.players=Math.max(2,state.players-1);
    if (action==='players-plus'||action==='cost-plus') state.players=Math.min(16,state.players+1);
    if (action==='reset-filters') Object.assign(state,{players:6,mood:'any',minutes:0});
    state.pool=[];state.result=null;state.rotation=0;
    render();
    let candidate=root.querySelector(`[data-action="${action}"]${value!==undefined?`[data-value="${value}"]`:''}`);
    if (candidate?.disabled) candidate=root.querySelector(`[data-action="${action.endsWith('-plus')?action.replace('plus','minus'):action.replace('minus','plus')}"]`);
    candidate?.focus({preventScroll:true});
  }
  function spin() {
    if (state.spinning) return;
    const eligible=eligibleGames(catalog,state);
    if (!eligible.length) return;
    const selected=eligible[randomIndex(eligible.length)];
    state.pool=wheelPool(eligible,selected);
    const next=winningRotation(state.rotation,state.pool.findIndex(g=>g.id===selected.id),state.pool.length);
    state.spinning=true;state.result=null;
    render();
    const svg=root.querySelector('.gnh-wheel-svg');
    let done=false;
    const finish=()=>{
      if (done||state.destroyed) return;
      done=true;clearTimeout(state.timer);
      state.rotation=next;state.spinning=false;state.result=selected;
      render('spin');
      root.querySelector('.gnh-wheel-result-area')?.scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'nearest'});
    };
    if (motion.matches) { state.rotation=next;state.timer=setTimeout(finish,60);return; }
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if (!svg?.isConnected||state.destroyed) return;
      svg.style.transformBox='view-box';
      svg.style.transformOrigin='50% 50%';
      svg.style.transition='transform 4.2s cubic-bezier(.13,.65,.12,1)';
      svg.style.transform=`rotate(${next}deg)`;
      svg.addEventListener('transitionend',event=>{if(event.propertyName==='transform')finish();},{once:true});
      state.timer=setTimeout(finish,4550);
    }));
  }
  async function choosePlan(id) {
    const plan=plans.find(p=>String(p.id)===id);
    if (!plan) return;
    if (options.onCheckout) {
      const button=root.querySelector(`[data-plan="${CSS.escape(id)}"]`);
      if (button?.disabled) return;
      if(button) button.disabled=true;
      try { await options.onCheckout(plan,{returnView:state.result?'wheel':'premium',selectedGameId:state.result?.id ?? null}); }
      catch { notify('Не удалось открыть оплату. Попробуйте ещё раз.'); }
      finally { if(button?.isConnected)button.disabled=false; }
      return;
    }
    if (!options.demoMode) { notify('Оплата сейчас недоступна. Попробуйте позже.');return; }
    openDialog(`<span class="gnh-eyebrow">${icon('diamond')} GAME NIGHT PREMIUM</span><h2>Хорошие вечера.<br><span>Всё включено.</span></h2><p class="gnh-dialog-lead">${esc(plan.label)} для ведущего.<br>Вся компания присоединяется бесплатно.</p><div class="gnh-order"><div><b>${esc(plan.label)}</b><span>${plan.days===null?'Единоразовая покупка':`Доступ на ${plan.days} дней`}</span></div><strong>${esc(rub(plan.price))}</strong></div><ul class="gnh-plan-list"><li>${icon('check')}Все Premium-игры и режимы</li><li>${icon('check')}Без автоматического продления</li><li>${icon('check')}Доступ после подтверждения оплаты</li></ul><div class="gnh-payment-trust">${icon('shield')}<span>Оплата через <b>YooKassa</b></span></div><button class="gnh-button gnh-button-primary gnh-checkout-demo" data-action="demo-checkout" data-plan="${esc(plan.id)}">Посмотреть оплату · ${esc(rub(plan.price))}</button><p class="gnh-demo-note">Демонстрация оформления. Деньги не списываются.</p>`,'Выбранный тариф Premium');
  }
  function previewGame(game) {
    if (!game) return;
    openDialog(`<img class="gnh-dialog-game-art" src="${esc(game.image)}" width="1536" height="1024" alt=""><span class="gnh-eyebrow">${game.premium?'GAME NIGHT PREMIUM':'GAME NIGHT'}</span><h2>${esc(game.title)}</h2><p class="gnh-dialog-lead">${esc(game.description)}</p><p class="gnh-muted">${game.players[0]}–${game.players[1]} игроков · ~${game.minutes} мин</p><button class="gnh-button gnh-button-primary" data-action="game-from-dialog" data-game="${esc(game.id)}">${icon(game.premium&&!hasPremium()?'diamond':'play')}${game.premium&&!hasPremium()?'Открыть Premium':'Начать игру'}</button>${options.demoMode?'<p class="gnh-demo-note">Предпросмотр. Игры запускаются в вашем приложении.</p>':''}`,'Игра '+game.title);
  }
  async function startGame(game) {
    if (!game) return;
    if (game.premium&&!hasPremium()) { state.result=game; if (options.onNeedPremium) { options.onNeedPremium(game.id); return; } go('premium'); return; }
    closeDialog();
    if (options.onStartGame) {
      try { await options.onStartGame(game.id); } catch { notify('Не удалось открыть игру. Попробуйте ещё раз.'); }
    } else if(options.demoMode) {
      openDialog(`<span class="gnh-eyebrow">${icon('play')} ВЫБОР ГОТОВ</span><h2>${esc(game.title)}</h2><p class="gnh-dialog-lead">В рабочем приложении эта кнопка открывает выбранную игру.</p><button class="gnh-button gnh-button-primary" data-action="close-dialog">Понятно</button><p class="gnh-demo-note">Здесь показан интерактивный макет.</p>`,'Предпросмотр запуска игры');
    }
  }
  function onClick(event) {
    const button=event.target.closest('[data-action]');
    if (!button||!root.contains(button)||button.disabled) return;
    const {action,value,game,plan}=button.dataset;
    if(action==='close-dialog')return closeDialog();
    if(action==='go-home'){ if (typeof options.onGoHome === 'function') return void options.onGoHome(); return; }
    if(action==='view-premium')return go('premium');
    if(action==='view-wheel')return go('wheel');
    if(action==='scroll-plans')return root.querySelector(`#${uid}-plans`)?.scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'});
    if(['mood','time','players-minus','players-plus','cost-minus','cost-plus','reset-filters'].includes(action))return updateFilter(action,value);
    if(action==='spin')return spin();
    if(action==='choose-plan')return void choosePlan(plan);
    if(action==='preview-game')return previewGame(catalog.find(g=>g.id===game));
    if(action==='start-result')return void startGame(state.result);
    if(action==='game-from-dialog')return void startGame(catalog.find(g=>g.id===game));
    if(action==='demo-checkout'){
      const selected=plans.find(p=>String(p.id)===plan);
      openDialog(`<span class="gnh-success-orb">${icon('shield')}</span><span class="gnh-eyebrow">ПРЕДПРОСМОТР ОПЛАТЫ</span><h2>Выбор сохранён.</h2><p class="gnh-dialog-lead">${esc(selected?.label)} · ${esc(rub(selected?.price ?? 0))}</p><p>На этом шаге приложение передаст выбранный тариф в действующую оплату YooKassa.</p><button class="gnh-button gnh-button-primary" data-action="close-dialog">Вернуться к макету</button><p class="gnh-demo-note">Платёж не создавался. Premium не активирован.</p>`,'Демонстрация перехода к оплате');
    }
  }
  root.addEventListener('click',onClick);
  if (plansFocus) root.classList.add('gnh-experience--plans-focus');
  render();
  if (plansFocus) {
    queueMicrotask(() => root.querySelector('#' + uid + '-plans')?.scrollIntoView({behavior:'instant',block:'start'}));
  }
  return {
    showPremium:()=>go('premium'), showWheel:()=>go('wheel'),
    refreshAccess(){if(!state.spinning)render();},
    destroy() {state.destroyed=true;clearTimeout(state.timer);clearTimeout(state.toast);closeDialog();root.removeEventListener('click',onClick);root.replaceChildren();root.classList.remove('gnh-experience');root.style.removeProperty('--gnh-ambient');}
  };
}
