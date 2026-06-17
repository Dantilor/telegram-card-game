import { Link, useLocation } from 'react-router-dom'
import { hapticSelection } from '../utils/haptics'
import './CatalogTabs.css'

type CatalogTabId = 'games' | 'comics'

type CatalogTabsProps = {
  active?: CatalogTabId
}

const TABS: { id: CatalogTabId; label: string; to: string }[] = [
  { id: 'games', label: 'Игры', to: '/games' },
  { id: 'comics', label: 'Комиксы', to: '/comics' },
]

function CatalogTabs({ active }: CatalogTabsProps) {
  const location = useLocation()
  const current: CatalogTabId =
    active ?? (location.pathname.startsWith('/comics') ? 'comics' : 'games')

  return (
    <nav className="catalog-tabs" aria-label="Раздел каталога">
      <div className="catalog-tabs__group" role="tablist">
        {TABS.map(({ id, label, to }) => (
          <Link
            key={id}
            to={to}
            role="tab"
            aria-selected={current === id}
            className={`catalog-tabs__btn ${current === id ? 'catalog-tabs__btn--active' : ''}`}
            onClick={() => hapticSelection()}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export default CatalogTabs
