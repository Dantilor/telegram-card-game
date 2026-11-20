import { lazy, Suspense } from 'react'
import { isWebShell } from '../config/shell'

const HomeWebEntry = lazy(() => import('./HomeWebEntry'))
const HomeTelegram = lazy(() => import('./HomeTelegram'))

/** Split WEB vs Mini App home so first paint does not download both shells. */
export default function Home() {
  const Comp = isWebShell() ? HomeWebEntry : HomeTelegram
  return (
    <Suspense fallback={null}>
      <Comp />
    </Suspense>
  )
}
