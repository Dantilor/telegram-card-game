import crystalUrl from '../assets/gnh-loading-crystal.webp'

/** Premium WEB loader crystal — new asset + CSS float/tilt/particles (reduced-motion safe). */
export function WebAuthCrystal({ className = '' }: { className?: string }) {
  return (
    <div className={`web-auth-crystal ${className}`.trim()} aria-hidden="true">
      <div className="web-auth-crystal__glow" />
      <span className="web-auth-crystal__spark web-auth-crystal__spark--a" />
      <span className="web-auth-crystal__spark web-auth-crystal__spark--b" />
      <span className="web-auth-crystal__spark web-auth-crystal__spark--c" />
      <div className="web-auth-crystal__float">
        <img
          className="web-auth-crystal__img"
          src={crystalUrl}
          alt=""
          width={176}
          height={220}
          decoding="async"
          draggable={false}
        />
      </div>
    </div>
  )
}
