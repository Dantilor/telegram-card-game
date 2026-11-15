/** Lightweight holographic crystal — SVG + CSS 3D parent, no WebGL. */
export function WebAuthCrystal({ className = '' }: { className?: string }) {
  return (
    <div className={`web-auth-crystal ${className}`.trim()} aria-hidden="true">
      <div className="web-auth-crystal__glow" />
      <div className="web-auth-crystal__spin">
        <svg
          className="web-auth-crystal__svg"
          viewBox="0 0 160 200"
          width="160"
          height="200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="wag-face-a" x1="20" y1="20" x2="140" y2="180" gradientUnits="userSpaceOnUse">
              <stop stopColor="#c4b5fd" stopOpacity="0.95" />
              <stop offset="0.45" stopColor="#7c5cff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="wag-face-b" x1="140" y1="30" x2="40" y2="170" gradientUnits="userSpaceOnUse">
              <stop stopColor="#67e8f9" stopOpacity="0.7" />
              <stop offset="0.5" stopColor="#818cf8" stopOpacity="0.55" />
              <stop offset="1" stopColor="#312e81" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="wag-edge" x1="80" y1="8" x2="80" y2="192" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff" stopOpacity="0.95" />
              <stop offset="0.4" stopColor="#a5b4fc" stopOpacity="0.5" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0.15" />
            </linearGradient>
            <filter id="wag-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Back facets */}
          <path d="M80 12 L132 72 L80 188 L28 72 Z" fill="url(#wag-face-b)" opacity="0.55" />
          {/* Front left / right */}
          <path d="M80 12 L28 72 L80 108 Z" fill="url(#wag-face-a)" opacity="0.9" />
          <path d="M80 12 L132 72 L80 108 Z" fill="url(#wag-face-b)" opacity="0.88" />
          <path d="M28 72 L80 108 L80 188 Z" fill="url(#wag-face-b)" opacity="0.75" />
          <path d="M132 72 L80 108 L80 188 Z" fill="url(#wag-face-a)" opacity="0.7" />
          {/* Highlights */}
          <path
            d="M80 18 L118 68 L80 98 L42 68 Z"
            fill="url(#wag-edge)"
            opacity="0.35"
            filter="url(#wag-soft)"
          />
          <path d="M54 48 L80 22 L78 70 Z" fill="#fff" opacity="0.45" />
          <path d="M80 12 L132 72 L80 108 L28 72 Z" stroke="url(#wag-edge)" strokeWidth="1.2" opacity="0.7" />
          <path d="M28 72 L80 188 L132 72" stroke="#a5f3fc" strokeWidth="0.8" opacity="0.45" />
        </svg>
      </div>
    </div>
  )
}
