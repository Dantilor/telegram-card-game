/**
 * Mini App build mode helpers (production vs development React/Vite output).
 *
 * Why: a terminal with NODE_ENV=development makes `vite build` emit dev React
 * (jsxDEV, DEV:true, PROD:false) even though Vite reports MODE:"production".
 */

export const MINIAPP_BUILD_NODE_ENV = 'production'

/**
 * Environment for every child process of the Mini App production build.
 * Does not mutate the passed object and never touches the OS/user environment.
 */
export function withProductionBuildEnv(baseEnv = process.env) {
  return { ...baseEnv, NODE_ENV: MINIAPP_BUILD_NODE_ENV }
}

// Vite inlines import.meta.env as an object literal: {BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,...}
const ENV_LITERAL = /DEV:(!0|!1|true|false),[^{}]*?PROD:(!0|!1|true|false)/g

/** True when at least one inlined import.meta.env literal with DEV/PROD flags exists. */
export function hasViteEnvLiteral(jsText) {
  return new RegExp(ENV_LITERAL.source).test(jsText)
}

/**
 * Inspect one compiled JS file and return human-readable development markers.
 * Empty array means no development output was found.
 */
export function findDevelopmentMarkers(jsText) {
  const issues = []

  for (const m of jsText.matchAll(ENV_LITERAL)) {
    const dev = m[1] === '!0' || m[1] === 'true'
    const prod = m[2] === '!0' || m[2] === 'true'
    if (dev) issues.push('import.meta.env DEV is true')
    if (!prod) issues.push('import.meta.env PROD is false')
  }

  if (/\bjsxDEV\s*\(/.test(jsText) || /\bjsxDEV\b\s*[,:=]/.test(jsText)) {
    issues.push('development JSX runtime (jsxDEV) present')
  }
  if (/react(-dom)?\.development\.js/.test(jsText)) {
    issues.push('React development build banner (react*.development.js) present')
  }
  if (/jsx-dev-runtime/.test(jsText)) {
    issues.push('react/jsx-dev-runtime present')
  }
  // @vitejs/plugin-react dev transform embeds absolute source locations.
  if (/fileName:"[A-Za-z]:[\\/]/.test(jsText) || /fileName:"\/(Users|home)\//.test(jsText)) {
    issues.push('JSX __source/fileName with local absolute paths present')
  }
  return [...new Set(issues)]
}