const fs = require('fs')
const p = 'src/shell/WebAuthGate.css'
let s = fs.readFileSync(p, 'utf8')
const start = s.indexOf('.web-auth-crystal {')
const end = s.indexOf('.web-auth-gate__eyebrow {')
if (start < 0 || end < 0) { console.error('markers missing'); process.exit(1) }
const block = `.web-auth-crystal {
  position: relative;
  width: 176px;
  height: 220px;
  display: grid;
  place-items: center;
}

.web-auth-crystal__glow {
  position: absolute;
  inset: 14% 4% 6%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 40% 35%, rgba(34, 211, 238, 0.42) 0%, transparent 55%),
    radial-gradient(circle at 60% 65%, rgba(236, 72, 153, 0.38) 0%, transparent 58%),
    radial-gradient(circle, rgba(124, 92, 255, 0.35) 0%, transparent 70%);
  filter: blur(16px);
  animation: wag-glow 4.5s ease-in-out infinite alternate;
  will-change: opacity, transform;
  pointer-events: none;
}

.web-auth-crystal__float {
  position: relative;
  width: 176px;
  height: 220px;
  animation: wag-crystal-bob 3.8s ease-in-out infinite, wag-crystal-tilt 6.4s ease-in-out infinite;
  will-change: transform;
  filter: drop-shadow(0 18px 30px rgba(124, 58, 237, 0.42));
}

.web-auth-crystal__img {
  display: block;
  width: 176px;
  height: 220px;
  object-fit: contain;
  object-position: center;
  user-select: none;
  -webkit-user-drag: none;
}

.web-auth-crystal__spark {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, rgba(167, 139, 250, 0.8) 45%, transparent 70%);
  pointer-events: none;
  animation: wag-spark 3.2s ease-in-out infinite;
  opacity: 0.85;
}

.web-auth-crystal__spark--a { top: 18%; right: 8%; animation-delay: 0s; }
.web-auth-crystal__spark--b { top: 42%; left: 6%; width: 4px; height: 4px; animation-delay: 0.8s; }
.web-auth-crystal__spark--c { bottom: 22%; right: 18%; width: 5px; height: 5px; animation-delay: 1.4s; }

.web-auth-gate__crystal--pulse .web-auth-crystal__float {
  animation:
    wag-crystal-bob 3.8s ease-in-out infinite,
    wag-crystal-tilt 6.4s ease-in-out infinite,
    wag-pulse 1.8s ease-in-out infinite;
}

`
s = s.slice(0, start) + block + s.slice(end)
if (!s.includes('@keyframes wag-crystal-tilt')) {
  s = s.replace('@keyframes wag-crystal-bob {', `@keyframes wag-crystal-tilt {
  0%, 100% { transform: rotate(-2.2deg) rotateY(-8deg); }
  50% { transform: rotate(2.4deg) rotateY(8deg); }
}

@keyframes wag-spark {
  0%, 100% { transform: translateY(0) scale(0.85); opacity: 0.35; }
  50% { transform: translateY(-6px) scale(1.15); opacity: 0.95; }
}

@keyframes wag-crystal-bob {`)
}
// reduced motion: disable tilt/spark
if (!s.includes('wag-crystal-tilt') || true) {
  s = s.replace(
    '.web-auth-crystal__float,\n  .web-auth-crystal__glow,',
    '.web-auth-crystal__float,\n  .web-auth-crystal__glow,\n  .web-auth-crystal__spark,'
  )
}
fs.writeFileSync(p, s)
console.log('crystal css ok', fs.statSync(p).size)
