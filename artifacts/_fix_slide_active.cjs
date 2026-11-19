const fs = require('fs')
let tsx = fs.readFileSync('src/pages/HomeWeb.tsx', 'utf8')
tsx = tsx.replace(
  `<article
              key={slide.id}
              className="home-web-hero__slide"
              aria-hidden={i !== heroIndex}
            >`,
  `<article
              key={slide.id}
              className={\`home-web-hero__slide\${i === heroIndex ? ' is-active' : ''}\`}
              aria-hidden={i !== heroIndex}
            >`
)
fs.writeFileSync('src/pages/HomeWeb.tsx', tsx)

let css = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')
if (!css.includes('.home-web-hero__slide:not(.is-active)')) {
  css = css.replace(
    `.home-web-hero__slide {
  position: relative;
  flex: 0 0 100%;
  width: 100%;
  min-width: 100%;
  height: 100%;
  display: block;
  overflow: hidden;
}`,
    `.home-web-hero__slide {
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
}`
  )
  fs.writeFileSync('src/pages/HomeWeb.css', css)
}
console.log('slide active class ok')
