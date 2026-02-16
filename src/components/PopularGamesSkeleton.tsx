import './PopularGamesSkeleton.css'

function PopularGamesSkeleton() {
  return (
    <section className="popular-games-skeleton" aria-hidden>
      <div className="popular-games-skeleton__title" />
      <div className="popular-games-skeleton__subtitle" />
      <div className="popular-games-skeleton__scroll">
        {[1, 2, 3].map((i) => (
          <div key={i} className="popular-games-skeleton__card">
            <div className="popular-games-skeleton__icon" />
            <div className="popular-games-skeleton__name" />
          </div>
        ))}
      </div>
    </section>
  )
}

export default PopularGamesSkeleton
