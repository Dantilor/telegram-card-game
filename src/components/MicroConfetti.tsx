import { useEffect, useState, useMemo } from 'react'
import './MicroConfetti.css'

const PARTICLE_COUNT = 20
const COLORS = ['var(--primary)', 'var(--primary2)', 'var(--secondary)']

function MicroConfetti({ duration = 2000 }: { duration?: number }) {
  const [visible, setVisible] = useState(true)
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 5 + Math.random() * 5,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.3,
    dx: (Math.random() - 0.5) * 40,
    duration: 1.2 + Math.random() * 0.6,
  })),
    []
  )

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(t)
  }, [duration])

  if (!visible) return null

  return (
    <div className="micro-confetti" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="micro-confetti__particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--confetti-dx' as string]: `${p.dx}px`,
          }}
        />
      ))}
    </div>
  )
}

export default MicroConfetti
