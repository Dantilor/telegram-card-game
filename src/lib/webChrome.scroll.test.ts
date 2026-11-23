/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { isImmersiveWebPath, scrollWebShellToTop } from './webChrome'

describe('webChrome scroll helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="app app--web"><div class="gnh-inside" style="height:200px;overflow:auto"></div></div>'
    const root = document.querySelector('.gnh-inside') as HTMLElement
    root.scrollTop = 240
    window.scrollTo(0, 180)
  })

  it('marks game routes as immersive', () => {
    expect(isImmersiveWebPath('/mafia')).toBe(true)
    expect(isImmersiveWebPath('/who-is-who')).toBe(true)
    expect(isImmersiveWebPath('/russia-travel/play/x')).toBe(true)
    expect(isImmersiveWebPath('/games')).toBe(false)
  })

  it('scrollWebShellToTop resets shell and window scroll', () => {
    const spy = vi.spyOn(window, 'scrollTo')
    scrollWebShellToTop('auto')
    const root = document.querySelector('.gnh-inside') as HTMLElement
    expect(root.scrollTop).toBe(0)
    expect(spy).toHaveBeenCalled()
  })
})