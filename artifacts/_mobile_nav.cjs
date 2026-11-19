const fs = require('fs')
let css = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')
if (!css.includes('home-web-nav--mobile')) {
  css = css.replace(
    `@media (max-width: 767px) {
  .app.app--web .home-web-nav { display: none; }`,
    `@media (max-width: 767px) {
  .app.app--web .home-web-nav {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    border-radius: 1.15rem;
    padding: 0.65rem 0.75rem;
  }
  .app.app--web .home-web-nav__links {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
  }
  .app.app--web .home-web-nav__link {
    text-align: center;
    justify-content: center;
  }`
  )
  fs.writeFileSync('src/pages/HomeWeb.css', css)
  console.log('mobile nav ok')
}
