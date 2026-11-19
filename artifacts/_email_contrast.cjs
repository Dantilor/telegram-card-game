const fs = require('fs')
const p = 'src/styles/web-desktop.css'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('profile email theme contrast')) {
  s += `

/* profile email theme contrast */
.app.app--web .profile-pass__email-label {
  color: var(--web-ink-muted, var(--muted));
}

.app.app--web .profile-pass__email-input {
  color: var(--web-ink, var(--text));
  background: color-mix(in srgb, var(--web-surface-elevated, var(--panel)) 90%, transparent);
  border-color: var(--web-border, var(--border));
}

html[data-theme="neon-light"] .app.app--web .profile-pass__email-input,
html[data-theme="sunset"] .app.app--web .profile-pass__email-input,
html[data-theme="minimal-calm"] .app.app--web .profile-pass__email-input {
  background: rgba(255, 255, 255, 0.88);
}
`
  fs.writeFileSync(p, s)
  console.log('email contrast ok')
}
