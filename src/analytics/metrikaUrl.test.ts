import { describe, expect, it } from 'vitest'
import { inspectMetrikaSearch, isMetrikaUrlSafe, safeMetrikaAdsSearch } from './metrikaUrl'

describe('metrikaUrl ads allowlist', () => {
  it('allows empty search and rejects any hash', () => {
    expect(isMetrikaUrlSafe('')).toBe(true)
    expect(isMetrikaUrlSafe('?')).toBe(true)
    expect(isMetrikaUrlSafe('', '#room=1')).toBe(false)
    expect(inspectMetrikaSearch('', '#x')).toEqual({ ok: false, reason: 'hash' })
  })

  it('allows validated UTM and yclid combinations', () => {
    const search =
      '?utm_source=yandex&utm_medium=cpc&utm_campaign=direct_nov&utm_content=banner&utm_term=mafia&yclid=1234567890123456789'
    expect(isMetrikaUrlSafe(search)).toBe(true)
    expect(safeMetrikaAdsSearch(search)).toContain('utm_source=yandex')
    expect(safeMetrikaAdsSearch(search)).toContain('yclid=1234567890123456789')
    expect(isMetrikaUrlSafe('?ysclid=42&utm_id=camp1')).toBe(true)
  })

  it('rejects dangerous, unknown or malformed values even next to UTM', () => {
    expect(inspectMetrikaSearch('?utm_source=yandex&token=abc').reason).toBe('dangerous_name')
    expect(inspectMetrikaSearch('?utm_source=yandex&code=ROOM1').reason).toBe('dangerous_name')
    expect(inspectMetrikaSearch('?utm_source=yandex&email=a@b.c').reason).toBe('dangerous_name')
    expect(inspectMetrikaSearch('?utm_source=yandex&payment=return').reason).toBe('dangerous_name')
    expect(inspectMetrikaSearch('?utm_source=yandex&foo=1').reason).toBe('unknown_param')
    expect(inspectMetrikaSearch('?yclid=not-a-number').reason).toBe('bad_value')
    expect(inspectMetrikaSearch('?utm_source=a@b').reason).toBe('bad_value')
    expect(inspectMetrikaSearch('?utm_campaign=path/secret').reason).toBe('bad_value')
    expect(isMetrikaUrlSafe('?utm_source=yandex&token=SECRET')).toBe(false)
    expect(safeMetrikaAdsSearch('?utm_source=yandex&token=SECRET')).toBe('')
  })
})