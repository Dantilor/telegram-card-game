import { Outlet } from 'react-router-dom'
import { TruthDareProvider } from '../games/truth-dare/TruthDareContext'

export default function TruthDareLayout() {
  return (
    <TruthDareProvider>
      <Outlet />
    </TruthDareProvider>
  )
}
