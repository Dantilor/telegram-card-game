const fs = require('fs')

// --- Crystal: combine bob+tilt into one transform animation ---
{
  const p = 'src/shell/WebAuthGate.css'
  let s = fs.readFileSync(p, 'utf8')
  s = s.replace(
    /animation: wag-crystal-bob 3\.8s ease-in-out infinite, wag-crystal-tilt 6\.4s ease-in-out infinite;/g,
    'animation: wag-crystal-float 4.2s ease-in-out infinite;'
  )
  s = s.replace(
    /animation:\s*wag-crystal-bob 3\.8s ease-in-out infinite,\s*wag-crystal-tilt 6\.4s ease-in-out infinite,\s*wag-pulse 1\.8s ease-in-out infinite;/g,
    'animation: wag-crystal-float 4.2s ease-in-out infinite, wag-pulse 1.8s ease-in-out infinite;'
  )
  if (!s.includes('@keyframes wag-crystal-float')) {
    s = s.replace(
      `@keyframes wag-crystal-tilt {
  0%, 100% { transform: rotate(-2.2deg) rotateY(-8deg); }
  50% { transform: rotate(2.4deg) rotateY(8deg); }
}

@keyframes wag-spark {
  0%, 100% { transform: translateY(0) scale(0.85); opacity: 0.35; }
  50% { transform: translateY(-6px) scale(1.15); opacity: 0.95; }
}

@keyframes wag-crystal-bob {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -10px, 0); }
}`,
      `@keyframes wag-crystal-float {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-2deg) rotateY(-7deg); }
  50% { transform: translate3d(0, -11px, 0) rotate(2.2deg) rotateY(7deg); }
}

@keyframes wag-spark {
  0%, 100% { transform: translateY(0) scale(0.85); opacity: 0.35; }
  50% { transform: translateY(-6px) scale(1.15); opacity: 0.95; }
}`
    )
  }
  // appear animation on loading stack
  if (!s.includes('wag-crystal-appear')) {
    s = s.replace(
      '.web-auth-gate__loading-stack {',
      `.web-auth-gate__loading-stack {
  animation: wag-crystal-appear 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.web-auth-gate__loading-stack--legacy {`
    )
    // Oops that might break - check. Better append keyframe and apply to stack properly.
  }
  fs.writeFileSync(p, s)
  console.log('crystal anim', fs.statSync(p).size)
}

// Fix accidental broken selector if created
{
  const p = 'src/shell/WebAuthGate.css'
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes('.web-auth-gate__loading-stack--legacy')) {
    s = s.replace(
`.web-auth-gate__loading-stack {
  animation: wag-crystal-appear 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.web-auth-gate__loading-stack--legacy {
  position: relative;
  z-index: 3;
  display: grid;
  justify-items: center;
  gap: 18px;
}`,
`.web-auth-gate__loading-stack {
  position: relative;
  z-index: 3;
  display: grid;
  justify-items: center;
  gap: 18px;
  animation: wag-crystal-appear 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}`
    )
  }
  if (!s.includes('@keyframes wag-crystal-appear')) {
    s = s.replace(
      '@keyframes wag-enter {',
      `@keyframes wag-crystal-appear {
  from { opacity: 0; transform: translate3d(0, 14px, 0) scale(0.94); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}

@keyframes wag-enter {`
    )
  }
  if (!s.includes('wag-crystal-appear') || true) {
    s = s.replace(
      `.web-auth-gate__aurora,
  .web-auth-gate__particles span,
  .web-auth-crystal__float,
  .web-auth-crystal__glow,
  .web-auth-crystal__spark,
  .web-auth-gate__cta-sheen,
  .web-auth-gate__enter {
    animation: none !important;
  }`,
      `.web-auth-gate__aurora,
  .web-auth-gate__particles span,
  .web-auth-crystal__float,
  .web-auth-crystal__glow,
  .web-auth-crystal__spark,
  .web-auth-gate__cta-sheen,
  .web-auth-gate__enter,
  .web-auth-gate__loading-stack {
    animation: none !important;
  }`
    )
  }
  fs.writeFileSync(p, s)
  console.log('crystal appear ok')
}
