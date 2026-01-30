/**
 * Preload Play route chunk. Path must match lazy import in App.
 */
export function preloadPlayRoute(): Promise<typeof import('../pages/Play')> {
  return import('../pages/Play')
}
