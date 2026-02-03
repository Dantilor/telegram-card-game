import { Outlet } from 'react-router-dom'
import { TruthDareProvider } from '../games/truth-dare/TruthDareContext'
import '../styles/truth-dare-readability.css'

export default function TruthDareLayout() {
  return (
    <TruthDareProvider>
      <div className="truth-dare">
        <Outlet />
      </div>
    </TruthDareProvider>
  )
}
