import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import pg from 'pg'

const api = process.env.PARTY_API ?? 'http://localhost:3001'
const failures = []

function assert(condition, message) {
  if (!condition) failures.push(message)
}

async function call(method, path, { body, headers } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }
  return { status: response.status, json }
}

function signInitData(botToken, telegramId) {
  const params = new URLSearchParams()
  params.set('auth_date', String(Math.floor(Date.now() / 1000)))
  params.set('query_id', 'local-party')
  params.set('user', JSON.stringify({ id: telegramId, first_name: 'Local', username: 'local_host' }))
  const dataCheck = [...params.keys()].sort().map((key) => `${key}=${params.get(key)}`).join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

function sledState(signalOpen = false) {
  return {
    roundIndex: 0,
    signalOpen,
    resolved: false,
    lastCorrect: null,
    threat: 28,
    score: 0,
    timeLeft: 600,
    timerDeadline: null,
    analystRounds: [],
    analysisByRound: {},
    hintsUsed: [],
    eliminatedDistricts: [],
    deductionsSolved: [],
    casePoints: 0,
    finalChoice: null,
    networkFailed: false,
    processedAbilityEventIds: [],
  }
}

async function playSled(initData) {
  const hostHeaders = { 'x-telegram-init-data': initData }
  const created = await call('POST', '/api/sled/rooms', {
    headers: hostHeaders,
    body: { name: 'Ведущий', caseId: '01', mode: 'story', state: sledState() },
  })
  assert(created.status === 201, `sled create ${created.status} ${JSON.stringify(created.json)}`)
  if (created.status !== 201) return
  const code = created.json.session.code
  const host = { token: created.json.session.token, id: created.json.session.participantId }
  const sledHeaders = (token) => ({ 'x-sled-player-token': token })

  const alone = await call('PATCH', `/api/sled/rooms/${code}`, {
    headers: sledHeaders(host.token),
    body: { status: 'roles' },
  })
  assert(alone.status === 409 && String(alone.json?.error).includes('ещё 2'), `sled start at 1: ${alone.status} ${alone.json?.error}`)

  const guest = await call('POST', `/api/sled/rooms/${code}/join`, { body: { name: 'Аня' } })
  assert(guest.status === 201, `sled join 2 ${guest.status}`)
  const pair = await call('PATCH', `/api/sled/rooms/${code}`, {
    headers: sledHeaders(host.token),
    body: { status: 'roles' },
  })
  assert(pair.status === 409 && String(pair.json?.error).includes('ещё 1'), `sled start at 2: ${pair.status} ${pair.json?.error}`)

  const third = await call('POST', `/api/sled/rooms/${code}/join`, { body: { name: 'Боря' } })
  assert(third.status === 201, `sled join 3 ${third.status}`)
  const started = await call('PATCH', `/api/sled/rooms/${code}`, {
    headers: sledHeaders(host.token),
    body: { status: 'roles' },
  })
  assert(started.status === 200 && started.json?.room?.status === 'roles', `sled start at 3 ${started.status}`)

  const playing = await call('PATCH', `/api/sled/rooms/${code}`, {
    headers: sledHeaders(host.token),
    body: { status: 'game', state: sledState(true) },
  })
  assert(playing.status === 200, `sled game ${playing.status} ${playing.json?.error}`)
  for (const token of [host.token, guest.json.session.token, third.json.session.token]) {
    const vote = await call('POST', `/api/sled/rooms/${code}/actions`, {
      headers: sledHeaders(token),
      body: { action: 'vote', roundIndex: 0, district: 'Север' },
    })
    assert(vote.status === 200, `sled vote ${vote.status} ${vote.json?.error}`)
  }
  const ability = await call('POST', `/api/sled/rooms/${code}/actions`, {
    headers: sledHeaders(host.token),
    body: { action: 'ability' },
  })
  assert(ability.status === 200, `sled ability ${ability.status} ${ability.json?.error}`)
  const finished = await call('PATCH', `/api/sled/rooms/${code}`, {
    headers: sledHeaders(host.token),
    body: { status: 'final' },
  })
  assert(finished.status === 200 && finished.json?.room?.status === 'final', `sled final ${finished.status}`)

  const guestView = await call('GET', `/api/sled/rooms/${code}`, { headers: sledHeaders(guest.json.session.token) })
  const room = guestView.json?.room
  assert(guestView.status === 200, `sled refresh ${guestView.status}`)
  assert(room?.players?.every((player) => player.roleId === undefined), 'sled player list leaked roleId')
  assert(typeof room?.me?.roleId === 'string' && room.me.roleId.length > 0, 'sled own role missing')
  assert(!JSON.stringify(room?.players).includes(room.me.roleId), 'sled own role appeared in the public list')
  const abilityEvent = room?.events?.find((event) => event.kind === 'ability')
  assert(abilityEvent?.roleId === '', `sled guest ability log named a role: ${abilityEvent?.roleId}`)
  assert(abilityEvent?.payload?.roleId === undefined, 'sled ability payload leaked roleId')
  assert(abilityEvent?.payload?.effect === 'eliminate_district', `sled ability effect ${abilityEvent?.payload?.effect}`)
  const hostView = await call('GET', `/api/sled/rooms/${code}`, { headers: sledHeaders(host.token) })
  const hostAbility = hostView.json?.room?.events?.find((event) => event.kind === 'ability')
  assert(hostAbility?.roleId === 'operative' && hostAbility?.payload?.effect === 'eliminate_district', 'sled host lost the own ability effect')

  const full = await call('POST', '/api/sled/rooms', {
    headers: hostHeaders,
    body: { name: 'Ведущий', caseId: '02', mode: 'operative', state: sledState() },
  })
  assert(full.status === 201, `sled full create ${full.status}`)
  if (full.status !== 201) return
  const fullCode = full.json.session.code
  for (let index = 1; index <= 7; index += 1) {
    const joined = await call('POST', `/api/sled/rooms/${fullCode}/join`, { body: { name: `Игрок ${index}` } })
    assert(joined.status === 201, `sled seat ${index + 1} ${joined.status} ${joined.json?.error}`)
  }
  const ninth = await call('POST', `/api/sled/rooms/${fullCode}/join`, { body: { name: 'Лишний' } })
  assert(ninth.status === 409, `sled ninth ${ninth.status} ${ninth.json?.error}`)
  const eight = await call('PATCH', `/api/sled/rooms/${fullCode}`, {
    headers: sledHeaders(full.json.session.token),
    body: { status: 'roles' },
  })
  assert(eight.status === 200, `sled start at 8 ${eight.status} ${eight.json?.error}`)
}

async function playMafia(initData) {
  const created = await call('POST', '/api/games/mafia-shadows', {
    headers: { 'x-telegram-init-data': initData },
    body: { action: 'create', name: 'Хост' },
  })
  assert(created.status === 201, `mafia create ${created.status} ${JSON.stringify(created.json)}`)
  if (created.status !== 201) return
  const code = created.json.code
  const hostToken = created.json.hostToken
  const seats = [{ name: 'Хост', token: created.json.token }]
  for (const name of ['Лида', 'Марк', 'Нина']) {
    const joined = await call('POST', '/api/games/mafia-shadows', { body: { action: 'join', code, name } })
    assert(joined.status === 201, `mafia join ${name} ${joined.status} ${joined.json?.error}`)
    seats.push({ name, token: joined.json?.token })
  }
  const started = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'start', code, token: seats[0].token, hostToken },
  })
  assert(started.status === 200, `mafia start ${started.status} ${started.json?.error}`)

  const views = []
  for (const seat of seats) {
    const view = await call('GET', `/api/games/mafia-shadows?code=${code}&token=${seat.token}&hostToken=${hostToken}`)
    assert(view.status === 200, `mafia state ${seat.name} ${view.status}`)
    views.push({ ...seat, body: view.json })
  }
  for (const seat of seats.slice(0, 3)) {
    const ack = await call('POST', '/api/games/mafia-shadows', {
      body: { action: 'acknowledge', code, token: seat.token },
    })
    assert(ack.status === 200, `mafia ack ${seat.name} ${ack.status}`)
  }
  for (const view of views) {
    const strangers = view.body.players.filter((player) => player.id !== view.body.self.id && player.alive)
    assert(strangers.every((player) => player.role === null && player.team === null), `mafia leaked role to ${view.name}`)
  }
  const earlyReveal = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(earlyReveal.status === 409, `mafia reveal waited ${earlyReveal.status} ${earlyReveal.json?.error}`)
  const lastAck = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'acknowledge', code, token: seats[3].token },
  })
  assert(lastAck.status === 200, `mafia last ack ${lastAck.status}`)
  const night = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(night.status === 200, `mafia night ${night.status} ${night.json?.error}`)
  const earlyNight = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(earlyNight.status === 409 && String(earlyNight.json?.error).includes('Ночь'), `mafia early dawn ${earlyNight.status} ${earlyNight.json?.error}`)

  const byRole = Object.fromEntries(views.map((view) => [view.body.self.role, view]))
  const citizen = byRole.citizen
  const don = byRole.don
  const doctor = byRole.doctor
  const detective = byRole.detective
  assert(citizen && don && doctor && detective, `mafia roles ${Object.keys(byRole).join(',')}`)
  if (!citizen || !don || !doctor || !detective) return

  async function act(actor, target) {
    const result = await call('POST', '/api/games/mafia-shadows', {
      body: { action: 'turn', code, token: actor.token, targetId: target.body.self.id },
    })
    assert(result.status === 200, `mafia turn ${actor.body.self.role} ${result.status} ${result.json?.error}`)
  }
  await act(don, citizen)
  await act(doctor, citizen)
  await act(detective, don)
  const dawn = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(dawn.status === 200, `mafia dawn ${dawn.status} ${dawn.json?.error}`)
  const discussion = await call('GET', `/api/games/mafia-shadows?code=${code}&token=${don.token}`)
  assert(discussion.json?.room?.phase === 'discussion', `mafia phase ${discussion.json?.room?.phase}`)
  const earlyTalk = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(earlyTalk.status === 409, `mafia discussion waited ${earlyTalk.status} ${earlyTalk.json?.error}`)
  for (const actor of [don, doctor, detective, citizen]) {
    const spoke = await call('POST', '/api/games/mafia-shadows', {
      body: { action: 'acknowledge', code, token: actor.token },
    })
    assert(spoke.status === 200, `mafia speak ${actor.body.self.role} ${spoke.status} ${spoke.json?.error}`)
  }
  const toVote = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(toVote.status === 200, `mafia vote open ${toVote.status} ${toVote.json?.error}`)
  for (const actor of [don, doctor, detective]) await act(actor, citizen)
  await act(citizen, don)
  const verdict = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(verdict.status === 200, `mafia verdict ${verdict.status} ${verdict.json?.error}`)
  const nightTwo = await call('GET', `/api/games/mafia-shadows?code=${code}&token=${don.token}`)
  assert(nightTwo.json?.room?.phase === 'night', `mafia second night ${nightTwo.json?.room?.phase}`)
  const blocked = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(blocked.status === 409, `mafia second night wait ${blocked.status}`)
  assert(!String(blocked.json?.error).includes(citizen.name), `dead player blocked night: ${blocked.json?.error}`)
  assert(String(blocked.json?.error).includes(don.name), `living don was not required: ${blocked.json?.error}`)
  await act(don, detective)
  await act(doctor, doctor)
  await act(detective, don)
  const ended = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(ended.status === 200, `mafia finish ${ended.status} ${ended.json?.error}`)
  const refresh = await call('GET', `/api/games/mafia-shadows?code=${code}&token=${doctor.token}`)
  assert(refresh.json?.room?.phase === 'finished' && refresh.json?.room?.winner === 'mafia', `mafia winner ${refresh.json?.room?.winner}`)
}

async function playManiac(initData) {
  const created = await call('POST', '/api/games/mafia-shadows', {
    headers: { 'x-telegram-init-data': initData },
    body: { action: 'create', name: 'Север' },
  })
  assert(created.status === 201, `maniac create ${created.status} ${JSON.stringify(created.json)}`)
  if (created.status !== 201) return
  const code = created.json.code
  const hostToken = created.json.hostToken
  const seats = [{ name: 'Север', token: created.json.token }]
  for (const name of ['Ида', 'Пётр', 'Кира', 'Уля']) {
    const joined = await call('POST', '/api/games/mafia-shadows', { body: { action: 'join', code, name } })
    assert(joined.status === 201, `maniac join ${name} ${joined.status}`)
    seats.push({ name, token: joined.json?.token })
  }
  const started = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'start', code, token: seats[0].token, hostToken },
  })
  assert(started.status === 200, `maniac start ${started.status} ${started.json?.error}`)
  const views = []
  for (const seat of seats) {
    const view = await call('GET', `/api/games/mafia-shadows?code=${code}&token=${seat.token}`)
    views.push({ ...seat, body: view.json })
  }
  for (const seat of seats.slice(0, 4)) {
    const ack = await call('POST', '/api/games/mafia-shadows', { body: { action: 'acknowledge', code, token: seat.token } })
    assert(ack.status === 200, `maniac ack ${ack.status}`)
  }
  const earlyReveal = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(earlyReveal.status === 409, `maniac reveal ${earlyReveal.status}`)
  await call('POST', '/api/games/mafia-shadows', { body: { action: 'acknowledge', code, token: seats[4].token } })
  const night = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(night.status === 200, `maniac night ${night.status} ${night.json?.error}`)
  const byRole = Object.fromEntries(views.map((view) => [view.body.self.role, view]))
  const { maniac, don, doctor, detective, citizen } = byRole
  assert(maniac && don && doctor && detective && citizen, `maniac cast ${Object.keys(byRole).join(',')}`)
  if (!maniac || !don || !doctor || !detective || !citizen) return
  const act = async (actor, target) => {
    const result = await call('POST', '/api/games/mafia-shadows', {
      body: { action: 'turn', code, token: actor.token, targetId: target.body.self.id },
    })
    assert(result.status === 200, `maniac turn ${actor.body.self.role} ${result.status} ${result.json?.error}`)
  }
  await act(maniac, citizen)
  await act(don, detective)
  await act(doctor, doctor)
  await act(detective, don)
  const dawn = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(dawn.status === 200, `maniac dawn ${dawn.status} ${dawn.json?.error}`)
  const earlyTalk = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(earlyTalk.status === 409, `maniac discussion ${earlyTalk.status} ${earlyTalk.json?.error}`)
  assert(!String(earlyTalk.json?.error).includes(citizen.name) && !String(earlyTalk.json?.error).includes(detective.name), `dead players blocked discussion: ${earlyTalk.json?.error}`)
  const deadSpeak = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'acknowledge', code, token: detective.token },
  })
  assert(deadSpeak.status === 409, `dead player could speak ${deadSpeak.status}`)
  for (const actor of [maniac, don, doctor]) {
    const spoke = await call('POST', '/api/games/mafia-shadows', { body: { action: 'acknowledge', code, token: actor.token } })
    assert(spoke.status === 200, `maniac speak ${spoke.status} ${spoke.json?.error}`)
  }
  const voteOpen = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(voteOpen.status === 200, `maniac vote ${voteOpen.status} ${voteOpen.json?.error}`)
  await act(maniac, don)
  await act(doctor, don)
  await act(don, doctor)
  const verdict = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(verdict.status === 200, `maniac verdict ${verdict.status} ${verdict.json?.error}`)
  const second = await call('GET', `/api/games/mafia-shadows?code=${code}&token=${maniac.token}`)
  assert(second.json?.room?.phase === 'night' && second.json?.room?.winner == null, `maniac still playing ${second.json?.room?.phase} ${second.json?.room?.winner}`)
  const waiting = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(waiting.status === 409 && !String(waiting.json?.error).includes(don.name), `dead don blocked night: ${waiting.json?.error}`)
  await act(maniac, doctor)
  await act(doctor, maniac)
  const finish = await call('POST', '/api/games/mafia-shadows', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(finish.status === 200, `maniac finish ${finish.status} ${finish.json?.error}`)
  const refresh = await call('GET', `/api/games/mafia-shadows?code=${code}&token=${maniac.token}`)
  assert(refresh.json?.room?.phase === 'finished' && refresh.json?.room?.winner === 'neutral', `maniac winner ${refresh.json?.room?.winner} ${refresh.json?.room?.publicMessage}`)
}

async function playDoubles(initData) {
  const created = await call('POST', '/api/games/doubles', {
    headers: { 'x-telegram-init-data': initData },
    body: { action: 'create', name: 'Хост' },
  })
  assert(created.status === 201, `doubles create ${created.status} ${JSON.stringify(created.json)}`)
  if (created.status !== 201) return
  const code = created.json.code
  const hostToken = created.json.hostToken
  const seats = [{ token: created.json.token }]
  for (const name of ['Мира', 'Лев', 'Яна']) {
    const joined = await call('POST', '/api/games/doubles', { body: { action: 'join', code, name } })
    assert(joined.status === 201, `doubles join ${name} ${joined.status}`)
    seats.push({ token: joined.json?.token })
  }
  const started = await call('POST', '/api/games/doubles', {
    body: { action: 'start', code, token: seats[0].token, hostToken },
  })
  assert(started.status === 200, `doubles start ${started.status} ${started.json?.error}`)
  const views = []
  for (const seat of seats) {
    const view = await call('GET', `/api/games/doubles?code=${code}&token=${seat.token}`)
    views.push({ token: seat.token, body: view.json })
    assert(view.json?.self?.isOriginal === null, 'doubles revealed original before the end')
    assert(view.json?.self?.hiddenIdentity === null, 'doubles revealed hidden identity before the end')
    assert(view.json?.players?.every((player) => player.archetype === null), 'doubles leaked archetypes')
    const ack = await call('POST', '/api/games/doubles', { body: { action: 'acknowledge', code, token: seat.token } })
    assert(ack.status === 200, `doubles ack ${ack.status}`)
  }
  const witness = views.find((view) => view.body.self.archetype === 'witness')
  const erased = views.find((view) => view.body.self.archetype === 'erased')
  const claimants = views.filter((view) => view.body.self.archetype === 'claimant')
  assert(witness && erased && claimants.length === 2, 'doubles cast was not 2/1/1')
  if (!witness || !erased) return
  assert(!erased.body.identityOptions.includes(witness.body.self.identityTitle) || erased.body.identityOptions.length > 1, 'erased options missing')
  assert(erased.body.identityOptions.includes(witness.body.self.identityTitle), 'witness title missing from erased options')
  const hiddenCandidates = erased.body.identityOptions.filter((title) => title !== witness.body.self.identityTitle)
  assert(hiddenCandidates.length >= 1, 'hidden identity was not a separate option')

  for (const phase of ['testimony', 'interrogation', 'evidence', 'vote']) {
    const advanced = await call('POST', '/api/games/doubles', {
      body: { action: 'advance', code, token: seats[0].token, hostToken },
    })
    assert(advanced.status === 200, `doubles advance ${phase} ${advanced.status} ${advanced.json?.error}`)
  }
  for (const claimant of claimants) {
    const vote = await call('POST', '/api/games/doubles', {
      body: { action: 'vote', code, token: claimant.token, targetId: claimant.body.self.id },
    })
    assert(vote.status === 200, `doubles self vote ${vote.status} ${vote.json?.error}`)
  }
  const witnessVote = await call('POST', '/api/games/doubles', {
    body: { action: 'vote', code, token: witness.token, targetId: claimants[0].body.self.id },
  })
  assert(witnessVote.status === 200, `doubles witness vote ${witnessVote.status}`)
  const guess = hiddenCandidates[0]
  const erasedVote = await call('POST', '/api/games/doubles', {
    body: {
      action: 'vote',
      code,
      token: erased.token,
      targetId: claimants[1].body.self.id,
      identityGuess: guess,
    },
  })
  assert(erasedVote.status === 200, `doubles erased vote ${erasedVote.status} ${erasedVote.json?.error}`)
  const finished = await call('POST', '/api/games/doubles', {
    body: { action: 'advance', code, token: seats[0].token, hostToken },
  })
  assert(finished.status === 200, `doubles finish ${finished.status} ${finished.json?.error}`)
  const refresh = await call('GET', `/api/games/doubles?code=${code}&token=${erased.token}`)
  assert(refresh.json?.room?.phase === 'finished', `doubles phase ${refresh.json?.room?.phase}`)
  const hidden = refresh.json?.result?.erased?.hiddenIdentity
  assert(hidden && hidden !== witness.body.self.identityTitle, `hidden identity collapsed to witness: ${hidden}`)
  assert(erased.body.identityOptions.includes(hidden), `hidden identity was not offered: ${hidden}`)
}

async function playInfected(initData) {
  const created = await call('POST', '/api/games/infected', {
    headers: { 'x-telegram-init-data': initData },
    body: { mode: 'create', name: 'Хост' },
  })
  assert(created.status === 201, `infected create ${created.status} ${JSON.stringify(created.json)}`)
  if (created.status !== 201) return
  const host = created.json.session
  const seats = [host]
  for (const name of ['Рита', 'Олег', 'Кира']) {
    const joined = await call('POST', '/api/games/infected', { body: { mode: 'join', code: host.code, name } })
    assert(joined.status === 201, `infected join ${name} ${joined.status} ${joined.json?.error}`)
    seats.push(joined.json?.session)
  }
  const auth = (seat) => ({ 'x-infected-player-id': seat.playerId, 'x-infected-token': seat.token })
  const action = (seat, name, payload) => call('POST', '/api/games/infected', {
    headers: auth(seat),
    body: { mode: 'action', action: name, payload },
  })
  const started = await action(host, 'start')
  assert(started.status === 200 && started.json?.room?.phase === 'briefing', `infected start ${started.status} ${started.json?.error}`)
  assert(started.json?.room?.taskTarget === 3, `infected target ${started.json?.room?.taskTarget}`)
  assert(started.json?.room?.crewScore === 0, 'infected crew score was not separate')
  for (const seat of seats) {
    const ready = await action(seat, 'ready')
    assert(ready.status === 200, `infected ready ${ready.status} ${ready.json?.error}`)
  }
  const operations = await call('GET', '/api/games/infected', { headers: auth(host) })
  assert(operations.json?.room?.phase === 'operations', `infected operations ${operations.json?.room?.phase}`)
  const task = await action(seats[1], 'task')
  assert(task.status === 200 && task.json?.room?.tasksDone === 1 && task.json?.room?.taskTarget === 3, 'infected task counter')
  const healthy = seats.map(async (seat) => {
    const view = await call('GET', '/api/games/infected', { headers: auth(seat) })
    assert(view.json?.players?.every((player) => player.finalRole === undefined), 'infected leaked final roles')
    if (view.json?.me?.infectionStatus !== 'active') {
      assert((view.json?.me?.teammates ?? []).length === 0, 'healthy player saw infected teammates')
    }
  })
  await Promise.all(healthy)
  const council = await action(host, 'council')
  assert(council.status === 200 && council.json?.room?.phase === 'council', `infected council ${council.status} ${council.json?.error}`)
  assert(council.json?.room?.crewScore === 0, 'early council counted a failed cycle')
  assert(council.json?.room?.infectionLevel > operations.json.room.infectionLevel, 'early council had no penalty')
  for (const [index, seat] of seats.entries()) {
    const target = seats[(index + 1) % seats.length]
    const vote = await action(seat, 'vote', { targetId: target.playerId })
    assert(vote.status === 200, `infected vote ${vote.status} ${vote.json?.error}`)
  }
  let state = await action(host, 'resolve')
  assert(state.status === 200, `infected resolve ${state.status} ${state.json?.error}`)
  for (let guard = 0; guard < 24 && state.json?.room?.phase !== 'ended'; guard += 1) {
    if (state.json?.room?.phase === 'result') state = await action(host, 'next')
    else if (state.json?.room?.phase === 'operations') state = await action(host, 'council')
    else if (state.json?.room?.phase === 'council') {
      for (const [index, seat] of seats.entries()) {
        if (state.json?.players?.find((player) => player.id === seat.playerId)?.quarantined) continue
        const target = seats.find((candidate) => candidate.playerId !== seat.playerId)
        await action(seat, 'vote', { targetId: target.playerId })
      }
      state = await action(host, 'resolve')
    } else break
    assert(state.status === 200, `infected loop ${state.status} ${state.json?.error ?? state.json?.room?.phase}`)
  }
  const refresh = await call('GET', '/api/games/infected', { headers: auth(seats[1]) })
  assert(refresh.json?.room?.phase === 'ended' && refresh.json?.room?.winner, `infected finish ${refresh.json?.room?.phase}`)
  assert(refresh.json?.players?.every((player) => player.finalRole === 'crew' || player.finalRole === 'infected'), 'infected finale hid roles')
}

async function checkPrivileges() {
  const ca = fs.readFileSync(process.env.DATABASE_TLS_CA_FILE)
  const ssl = { rejectUnauthorized: true, minVersion: 'TLSv1.2', ca }
  const app = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl })
  const none = new pg.Pool({ connectionString: process.env.GNH_NONE_URL, ssl })
  const seen = await app.query('SELECT current_user AS user, count(*)::int AS rooms FROM sled_rooms')
  assert(seen.rows[0].user === 'gnh_app', `app role ${seen.rows[0].user}`)
  let denied = false
  try {
    await none.query('SELECT 1 FROM infected_rooms')
  } catch (error) {
    denied = error.code === '42501'
  }
  assert(denied, 'role without grants could read infected tables')
  await app.end()
  await none.end()
  const ready = await call('GET', '/api/games/infected/ready')
  assert(ready.status === 200 && ready.json?.ok === true, `infected ready ${ready.status} ${JSON.stringify(ready.json)}`)
  for (const path of ['/api/sled/ready', '/api/games/mafia-shadows/ready', '/api/games/doubles/ready']) {
    const result = await call('GET', path)
    assert(result.status === 200 && result.json?.ok === true, `${path} ${result.status}`)
  }
}

const botToken = process.env.BOT_TOKEN
const initData = signInitData(botToken, 900000001)
const premium = await call('GET', '/api/me', { headers: { 'x-telegram-init-data': initData } })
assert(premium.status === 200 && premium.json?.premium === true, `local premium ${premium.status} ${JSON.stringify(premium.json)}`)
const guestCreate = await call('POST', '/api/games/doubles', { body: { action: 'create', name: 'Гость' } })
assert(guestCreate.status === 403, `guest create ${guestCreate.status}`)

await checkPrivileges()
await playSled(initData)
await playMafia(initData)
await playManiac(initData)
await playDoubles(initData)
await playInfected(initData)

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'))
  process.exit(1)
}
console.log('party-play: ok')
