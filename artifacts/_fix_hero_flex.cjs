const fs = require('fs')
let css = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')

css = css.replace(
  `/* Hero carousel */
.home-web-hero {
  position: relative;
  border-radius: var(--gnh-radius-lg);
  overflow: hidden;
  aspect-ratio: 16 / 11;
  min-height: 0;
  height: auto;
  border: 1px solid var(--gnh-card-border);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  background: #0a0c18;
  touch-action: pan-y;
}

.home-web-hero__track {
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.home-web-hero__slide {
  position: relative;
  flex: 0 0 100%;
  width: 100%;
  min-width: 100%;
  height: 100%;
  display: block;
  overflow: hidden;
}

.home-web-hero__slide:not(.is-active) .home-web-hero__copy {
  visibility: hidden;
}`,
  `/* Hero carousel — aspect box + absolute track (flex-safe) */
.home-web-hero {
  position: relative;
  width: 100%;
  flex: 0 0 auto;
  align-self: stretch;
  aspect-ratio: 16 / 11;
  min-height: 13.5rem;
  border-radius: var(--gnh-radius-lg);
  overflow: hidden;
  border: 1px solid var(--gnh-card-border);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  background: #0a0c18;
  touch-action: pan-y;
}

.home-web-hero__track {
  position: absolute;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.home-web-hero__slide {
  position: relative;
  flex: 0 0 100%;
  width: 100%;
  min-width: 100%;
  height: 100%;
  overflow: hidden;
}

.home-web-hero__slide:not(.is-active) .home-web-hero__copy a {
  visibility: hidden;
}`
)

css = css.replace(
  `  .home-web-hero {
    aspect-ratio: 4 / 3;
  }`,
  `  .home-web-hero {
    aspect-ratio: 4 / 3;
    min-height: 14.5rem;
  }`
)

css = css.replace(
  `  .home-web-hero {
    aspect-ratio: 16 / 9;
  }`,
  `  .home-web-hero {
    aspect-ratio: 16 / 9;
    min-height: 18rem;
  }`
)

// Cards shouldn't shrink oddly in flex page
css = css.replace(
  `.home-web-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}`,
  `.home-web-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
  flex: 0 0 auto;
}`
)

css = css.replace(
  `.home-web-quicks {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}`,
  `.home-web-quicks {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
  flex: 0 0 auto;
  width: 100%;
}`
)

fs.writeFileSync('src/pages/HomeWeb.css', css)

// Landing itself shouldn't shrink in app flex
css = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')
if (!css.includes('flex: 1 0 auto')) {
  css = css.replace(
    `.home-web-landing {
  --gnh-pink: #ff4fd8;`,
    `.home-web-landing {
  flex: 1 0 auto;
  width: 100%;
  --gnh-pink: #ff4fd8;`
  )
  fs.writeFileSync('src/pages/HomeWeb.css', css)
}

console.log('hero flex-safe ok')
