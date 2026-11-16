import crystalUrl from '../assets/optimized/web-loader-crystal.webp'

/** Fixed-size WEB loader crystal — image asset + CSS float (reduced-motion safe). */
export function WebAuthCrystal({ className = '' }: { className?: string }) {
  return (
    <div className={`web-auth-crystal ${className}`.trim()} aria-hidden="true">
      <div className="web-auth-crystal__glow" />
      <div className="web-auth-crystal__float">
        <img
          className="web-auth-crystal__img"
          src={crystalUrl}
          alt=""
          width={160}
          height={200}
          decoding="async"
          draggable={false}
        />
      </div>
    </div>
  )
}
