const fs = require('fs')
let css = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')

css = css.replace(
  `  .home-web-nav {
    flex-direction: column;
    align-items: stretch;
    border-radius: 1.1rem;
    padding: 0.6rem 0.65rem;
  }

  .home-web-nav__links {
    justify-content: flex-start;
    gap: 0.2rem;
  }`,
  `  .home-web-nav {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    border-radius: 1.1rem;
    padding: 0.55rem 0.65rem;
    gap: 0.35rem 0.5rem;
  }

  .home-web-nav__brand {
    font-size: 0.9rem;
  }

  .home-web-nav__links {
    justify-content: flex-start;
    gap: 0.15rem;
    flex: 1 1 auto;
  }`
)

css = css.replace(
  `.home-web-quick__icon {
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 0.75rem;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
  background: rgba(139, 92, 255, 0.18);
}`,
  `.home-web-quick__icon {
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  line-height: 1;
  background: rgba(139, 92, 255, 0.18);
}`
)

css = css.replace(
  `.home-web-premium-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 0.95rem;`,
  `.home-web-premium-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3.4rem;
  padding: 0.85rem 0.95rem;`
)

fs.writeFileSync('src/pages/HomeWeb.css', css)
console.log('nav/quick polish')
