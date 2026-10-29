import assert from 'node:assert/strict'
import test from 'node:test'
import {
  erasedGuessOptions,
  infectedCycleOutcome,
  infectedWaitingFor,
  numericRoomCode,
  mafiaWinner,
  maniacTieWinner,
  missingNightActors,
  sledStartRefusal,
  splitSupportCast,
} from './partyRules.js'

test('sled start allows 3 and 8 and refuses 1, 2 and 9', () => {
  assert.match(sledStartRefusal(1) ?? '', /Нужно ещё 2/)
  assert.match(sledStartRefusal(2) ?? '', /Нужно ещё 1/)
  assert.equal(sledStartRefusal(3), null)
  assert.equal(sledStartRefusal(8), null)
  assert.equal(sledStartRefusal(9), 'В комнате уже 8 игроков.')
})

test('night waits only for living roles that act at night', () => {
  const players = [
    { id: 'don', name: 'Дон', alive: true, role: 'don' },
    { id: 'doc', name: 'Доктор', alive: true, role: 'doctor' },
    { id: 'dead', name: 'Детектив', alive: false, role: 'detective' },
    { id: 'city', name: 'Житель', alive: true, role: 'citizen' },
  ]
  const missing = missingNightActors(players, new Set(['don']))
  assert.deepEqual(missing.map((player) => player.id), ['doc'])
  assert.equal(missingNightActors(players, new Set(['don', 'doc'])).length, 0)
})

test('maniac wins only as the last living player', () => {
  const maniac = { alive: true, team: 'neutral' as const, role: 'maniac' }
  const citizen = { alive: true, team: 'city' as const, role: 'citizen' }
  assert.equal(mafiaWinner([maniac, citizen]), null)
  assert.equal(mafiaWinner([maniac, { ...citizen, alive: false }]), 'neutral')
  assert.equal(mafiaWinner([{ ...maniac, alive: false }, { ...citizen, alive: false }]), 'mutual')
  assert.equal(
    mafiaWinner([
      { alive: true, team: 'mafia', role: 'don' },
      { alive: true, team: 'city', role: 'citizen' },
    ]),
    'mafia',
  )
})

test('a tied vote at two players ends the loner duel after the night', () => {
  const players = [
    { alive: true, team: 'neutral' as const, role: 'maniac' },
    { alive: true, team: 'city' as const, role: 'doctor' },
  ]
  assert.equal(maniacTieWinner(players, false), 'city')
  assert.equal(maniacTieWinner(players, true), null)
})

test('erased identity is not a witness, including a four-player table', () => {
  const identities = ['a', 'b', 'c', 'd', 'e']
  const fourPlayer = splitSupportCast(identities, 1)
  assert.deepEqual(fourPlayer.witnesses, ['a'])
  assert.equal(fourPlayer.hidden, 'b')
  assert.equal(fourPlayer.witnesses.includes(fourPlayer.hidden), false)

  const full = splitSupportCast(identities, 4)
  assert.equal(full.witnesses.includes(full.hidden), false)
  assert.throws(() => splitSupportCast(identities, 5))
})

test('infected council waits for every player outside quarantine', () => {
  const players = [
    { name: 'Хост', quarantined: true, done: false },
    { name: 'Рита', quarantined: false, done: true },
    { name: 'Олег', quarantined: false, done: false },
  ]
  assert.deepEqual(infectedWaitingFor(players, (player) => player.done), ['Олег'])
  assert.deepEqual(infectedWaitingFor(players.slice(0, 2), (player) => player.done), [])
})

test('one secret sabotage fails the infected cycle', () => {
  assert.deepEqual(infectedCycleOutcome(4, 4), { success: true, sabotaged: 0 })
  assert.deepEqual(infectedCycleOutcome(4, 3), { success: false, sabotaged: 1 })
})

test('infected room code is six digits', () => {
  assert.equal(numericRoomCode(() => 0), '100000')
  assert.equal(numericRoomCode(() => 899999), '999999')
  assert.match(numericRoomCode((max) => Math.floor(Math.random() * max)), /^\d{6}$/)
})

test('erased guess list hides the answer among the witness and decoys', () => {
  const options = erasedGuessOptions({
    witnessTitles: ['Мила Карева'],
    hiddenTitle: 'Платон Крайс',
    unusedTitles: ['Ника Вега', 'Север'],
  })
  assert.equal(options.includes('Платон Крайс'), true)
  assert.equal(options.includes('Мила Карева'), true)
  assert.equal(options.includes('Ника Вега'), true)
  assert.equal(options.length, 4)
})
