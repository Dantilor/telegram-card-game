const fs = require('fs')

// Home.tsx early return
{
  let s = fs.readFileSync('src/pages/Home.tsx', 'utf8')
  if (!s.includes("import HomeWeb from './HomeWeb'")) {
    s = s.replace("import './Home.css'", "import HomeWeb from './HomeWeb'\nimport './Home.css'")
  }
  if (!s.includes('if (web) {\n    return <HomeWeb />')) {
    s = s.replace(
      '  const legacyPremiumBlock = (!isPremium || loading) ? (',
      `  if (web) {\n    return <HomeWeb />\n  }\n\n  const legacyPremiumBlock = (!isPremium || loading) ? (`
    )
  }
  // remove unused web HomeWebNav branches - still used? after early return web is false so HomeWebNav never used in remaining - OK leave dead code or clean. Dead code with web? false means web branches never hit - fine for Mini App.
  fs.writeFileSync('src/pages/Home.tsx', s)
  console.log('Home.tsx wired', s.includes('return <HomeWeb />'))
}

// fonts for web
{
  let s = fs.readFileSync('index.html', 'utf8')
  if (!s.includes('family=Montserrat')) {
    s = s.replace(
      'family=Manrope:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap',
      'family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700&family=Manrope:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap'
    )
    s = s.replaceAll(
      'family=Manrope:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap',
      'family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700&family=Manrope:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap'
    )
    fs.writeFileSync('index.html', s)
    console.log('fonts ok')
  }
}

// Play page class + WEB styles append
{
  let s = fs.readFileSync('src/pages/Play.tsx', 'utf8')
  if (!s.includes('isWebShell')) {
    s = s.replace("import './Play.css'", "import { isWebShell } from '../config/shell'\nimport './Play.css'")
    s = s.replace(
      '<div className="play-page">',
      '<div className={`play-page${isWebShell() ? \' play-page--web\' : \'\'}`}>'
    )
    fs.writeFileSync('src/pages/Play.tsx', s)
    console.log('Play class ok')
  }
}

// Profile WEB class
{
  let s = fs.readFileSync('src/pages/Profile.tsx', 'utf8')
  if (!s.includes('profile-page--web')) {
    s = s.replace(
      '<div className="profile-page" aria-label="Профиль">',
      '<div className={`profile-page${web ? \' profile-page--web\' : \'\'}`} aria-label="Профиль">'
    )
    // Soften email block copy for WEB - Telegram restore primary
    s = s.replace(
      `Email необязателен. Без него покупка остаётся только в cookie этого устройства —
              очистка браузера может привести к потере доступа.`,
      `Основной способ восстановления — привязка Telegram. Email необязателен и не требуется для Premium.`
    )
    fs.writeFileSync('src/pages/Profile.tsx', s)
    console.log('Profile class ok')
  }
}
