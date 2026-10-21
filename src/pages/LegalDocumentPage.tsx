import { useParams } from 'react-router-dom'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import { LegalDocumentPanel } from '../components/LegalDocumentView'
import { useBack } from '../hooks/useBack'
import { isMenuDocumentId } from '../legal/catalog'
import '../styles/GamePageShell.css'
import './Legal.css'

export default function LegalDocumentPage({ documentId }: { documentId?: string }) {
  const params = useParams()
  const requested = documentId || params.documentId || ''
  const handleBack = useBack('/profile')
  const known = isMenuDocumentId(requested)

  return (
    <div className="game-page legal-page game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>
      {known ? (
        <LegalDocumentPanel documentId={requested} version={params.version} />
      ) : (
        <p className="legal-doc__error">Утверждённый текст документа недоступен. Подтверждение не сохранено.</p>
      )}
    </div>
  )
}
